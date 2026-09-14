// Edge Function: send-push — despacha notificaciones pendientes vía Expo Push API (RF-23)
// Lee public.notificaciones con enviada_en IS NULL, hace join con public.push_tokens,
// envía a https://exp.host/--/api/v2/push/send y marca enviada_en (dedup).
// Auth: service_role directo (cron/scheduler) o JWT de jefe/administrador activo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function cors(origin?: string) {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

type Pendiente = {
  id: number;
  usuario_id: string;
  tipo: string;
  titulo: string;
  cuerpo: string | null;
  ticket_id: string | null;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

Deno.serve(async (req: Request) => {
  const headers = cors(req.headers.get('origin') ?? undefined);
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return Response.json({ error: 'Falta Authorization' }, { status: 401, headers });
  }
  const token = auth.slice(7);

  // Autorización: service_role directo o JWT de jefe/administrador activo.
  let autorizado = token === serviceKey;
  let uid: string | null = null;
  if (!autorizado) {
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    try {
      const { data: { user }, error } = await caller.auth.getUser(token);
      if (error || !user) throw error;
      uid = user.id;
    } catch {
      return Response.json({ error: 'Token inválido' }, { status: 401, headers });
    }
    const admin = createClient(url, serviceKey);
    const { data: prof } = await admin.from('profiles').select('rol,activo').eq('id', uid!).single();
    const rol = (prof as unknown as { rol?: string })?.rol;
    const activo = (prof as unknown as { activo?: boolean })?.activo;
    if (!activo || !['jefe', 'administrador'].includes(rol ?? '')) {
      return Response.json({ error: 'Solo jefe/administrador puede despachar pushes' }, { status: 403, headers });
    }
  }

  let limit = 100;
  let dryRun = false;
  try {
    const body = await req.json();
    if (typeof body?.limit === 'number' && body.limit > 0) limit = Math.min(Math.floor(body.limit), 500);
    if (body?.dryRun === true) dryRun = true;
  } catch {
    // Sin cuerpo JSON: usa defaults.
  }

  const admin = createClient(url, serviceKey);

  // 1) Pendientes (requiere migración RF-23 con columna enviada_en).
  const { data: pendientes, error: errPend } = await admin
    .from('notificaciones')
    .select('id,usuario_id,tipo,titulo,cuerpo,ticket_id')
    .is('enviada_en', null)
    .order('id', { ascending: true })
    .limit(limit);
  if (errPend) {
    const hint = /enviada_en/.test(errPend.message)
      ? 'Falta la columna notificaciones.enviada_en — aplica la migración RF-23 send-push.'
      : undefined;
    return Response.json({ error: errPend.message, hint }, { status: 500, headers });
  }
  const lista = ((pendientes ?? []) as unknown) as Pendiente[];
  if (lista.length === 0) {
    return Response.json({ enviadas: 0, omitidas_sin_token: 0, errores: 0, pendientes: 0 }, { headers });
  }

  // 2) Tokens por usuario.
  const userIds = [...new Set(lista.map((n) => n.usuario_id))];
  const { data: tokens, error: errTok } = await admin
    .from('push_tokens')
    .select('usuario_id,token,plataforma')
    .in('usuario_id', userIds);
  if (errTok) return Response.json({ error: errTok.message }, { status: 500, headers });
  const porUsuario = new Map<string, string[]>();
  for (const t of ((tokens ?? []) as unknown as { usuario_id: string; token: string }[])) {
    if (!t.token || !t.token.startsWith('ExponentPushToken[')) continue; // solo Expo push tokens
    const arr = porUsuario.get(t.usuario_id) ?? [];
    if (!arr.includes(t.token)) arr.push(t.token);
    porUsuario.set(t.usuario_id, arr);
  }

  const conToken = lista.filter((n) => (porUsuario.get(n.usuario_id) ?? []).length > 0);
  const sinToken = lista.filter((n) => (porUsuario.get(n.usuario_id) ?? []).length === 0);

  if (dryRun) {
    return Response.json({
      pendientes: lista.length,
      con_token: conToken.length,
      sin_token: sinToken.length,
      muestra: conToken.slice(0, 5).map((n) => ({ id: n.id, titulo: n.titulo, destinos: porUsuario.get(n.usuario_id)?.length ?? 0 })),
      dryRun: true,
    }, { headers });
  }

  // 3) Las sin token se marcan para no reprocesarlas (dedup: el in-app ya las muestra).
  let omitidas = 0;
  if (sinToken.length > 0) {
    const { error } = await admin
      .from('notificaciones')
      // deno-lint-ignore no-explicit-any
      .update({ enviada_en: new Date().toISOString() } as any)
      .in('id', sinToken.map((n) => n.id));
    if (!error) omitidas = sinToken.length;
  }

  // 4) Construye mensajes Expo (máx 100 por request).
  const mensajes = conToken.flatMap((n) =>
    (porUsuario.get(n.usuario_id) ?? []).map((to) => ({
      to,
      title: n.titulo.slice(0, 178),
      body: (n.cuerpo ?? '').slice(0, 300) || undefined,
      data: { notificacion_id: n.id, ticket_id: n.ticket_id, tipo: n.tipo },
      channelId: 'default',
    })),
  );

  let enviadas = 0;
  let errores = 0;
  const tokensInvalidos = new Set<string>();
  const idsIntentados = new Set<number>();

  for (const lote of chunk(mensajes, 100)) {
    let resp: Response;
    try {
      resp = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(lote),
      });
    } catch {
      // Fallo de red: no marca nada de este lote (reintenta en el próximo ciclo).
      errores += lote.length;
      continue;
    }
    if (!resp.ok) {
      errores += lote.length;
      continue; // no marca: reintenta luego
    }
    let tickets: { status: string; details?: { error?: string } }[] = [];
    try {
      const parsed = await resp.json();
      tickets = parsed?.data ?? [];
    } catch {
      errores += lote.length;
      continue;
    }
    lote.forEach((m, i) => {
      const t = tickets[i];
      const notifId = (m.data as { notificacion_id: number }).notificacion_id;
      if (t?.status === 'ok') {
        enviadas += 1;
        idsIntentados.add(notifId);
      } else {
        errores += 1;
        idsIntentados.add(notifId); // evita bucle venenoso: se marca igual
        if (t?.details?.error === 'DeviceNotRegistered') tokensInvalidos.add(m.to);
      }
    });
  }

  // 5) Limpia tokens muertos.
  let tokensEliminados = 0;
  if (tokensInvalidos.size > 0) {
    const { error } = await admin.from('push_tokens').delete().in('token', [...tokensInvalidos]);
    if (!error) tokensEliminados = tokensInvalidos.size;
  }

  // 6) Marca enviadas (las intentadas, ok o con error individual).
  let marcadas = 0;
  if (idsIntentados.size > 0) {
    const { error } = await admin
      .from('notificaciones')
      // deno-lint-ignore no-explicit-any
      .update({ enviada_en: new Date().toISOString() } as any)
      .in('id', [...idsIntentados]);
    if (!error) marcadas = idsIntentados.size;
  }

  return Response.json({
    pendientes: lista.length,
    enviadas,
    omitidas_sin_token: omitidas,
    errores,
    notificaciones_marcadas: marcadas,
    tokens_invalidos_eliminados: tokensEliminados,
  }, { headers });
});
