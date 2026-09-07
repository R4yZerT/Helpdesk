// Edge Function: admin-create-user — RF-27 cierre
// Solo rol administrador (activo) puede crear usuarios.
// Requiere service_role; valida y crea auth.users + actualiza profiles.mesa_id.
//
// Env vars supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const ALLOWED_ROLES_DB = new Set(['empleado', 'tecnico', 'jefe', 'administrador']);
const MAP_ROL: Record<string, string> = { usuario: 'empleado', empleado: 'empleado', tecnico: 'tecnico', jefe: 'jefe', administrador: 'administrador' };

function corsHeaders(origin?: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function isEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get('origin') ?? undefined);
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Verificar caller es administrador activo (usa JWT del Authorization)
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return Response.json({ error: 'Falta Authorization Bearer' }, { status: 401, headers });
  }
  const jwt = authHeader.slice(7);

  // Client con JWT del caller para leer su profile
  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  let callerId: string | null = null;
  try {
    const { data: { user }, error } = await callerClient.auth.getUser(jwt);
    if (error || !user) throw error ?? new Error('no user');
    callerId = user.id;
  } catch (_e) {
    return Response.json({ error: 'Token inválido o expirado' }, { status: 401, headers });
  }

  // Verificar rol administrador activo
  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: callerProfile, error: profErr } = await adminClient.from('profiles').select('rol, activo').eq('id', callerId!).single();
  if (profErr || !callerProfile) return Response.json({ error: 'No se pudo verificar rol' }, { status: 403, headers });
  const cRol = callerProfile as { rol: string; activo: boolean };
  if (!cRol.activo || cRol.rol !== 'administrador') {
    return Response.json({ error: 'Solo administrador puede crear usuarios' }, { status: 403, headers });
  }

  // Parse body
  let body: { fullName?: string; email?: string; password?: string; rol?: string; mesaId?: number | null };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400, headers }); }

  const fullName = (body.fullName ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const rolIn = (body.rol ?? '').trim().toLowerCase();
  const mesaId = body.mesaId ?? null;

  // Validación espejo de shared/src/admin.ts validateCreateUser
  const errs: Record<string, string> = {};
  if (fullName.length < 3) errs.fullName = 'Nombre mínimo 3 caracteres';
  else if (fullName.length > 80) errs.fullName = 'Nombre máximo 80 caracteres';
  if (!isEmail(email)) errs.email = 'Email inválido';
  if (!password || password.length < 8) errs.password = 'Mínimo 8 caracteres';
  else if (password.length > 72) errs.password = 'Máximo 72 caracteres';
  const rolDb = MAP_ROL[rolIn];
  if (!rolDb || !ALLOWED_ROLES_DB.has(rolDb)) errs.rol = 'Rol inválido';
  if (mesaId !== null && (!Number.isInteger(mesaId) || mesaId <= 0)) errs.mesaId = 'Mesa inválida';
  if (Object.keys(errs).length) return Response.json({ error: 'Validación', details: errs }, { status: 400, headers });

  // Si mesaId se mandó, verificar que existe y está activa (opcional pero útil)
  if (mesaId !== null) {
    const { data: mesa, error: mesaErr } = await adminClient.from('mesas').select('id').eq('id', mesaId).single();
    if (mesaErr || !mesa) return Response.json({ error: 'Mesa no existe' }, { status: 400, headers });
  }

  // Crear auth user
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, rol: rolDb },
  });
  if (error) {
    // Duplicado
    if (/already.*exists|duplicate/i.test(error.message)) {
      return Response.json({ error: 'Email ya registrado' }, { status: 409, headers });
    }
    return Response.json({ error: error.message }, { status: 400, headers });
  }
  const newId = data.user?.id;
  if (!newId) return Response.json({ error: 'No se pudo crear usuario' }, { status: 500, headers });

  // Trigger handle_new_user ya creó profile con rolDb; si mesaId, actualizar
  if (mesaId !== null) {
    const { error: upErr } = await adminClient.from('profiles').update({ mesa_id: mesaId }).eq('id', newId);
    if (upErr) {
      // No revertir auth user; informar
      return Response.json({ id: newId, warning: `Usuario creado pero no se asignó mesa: ${upErr.message}` }, { status: 201, headers });
    }
  }

  return Response.json({ id: newId }, { status: 201, headers });
});
