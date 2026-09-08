// Edge Function: generate-alertas — dispara public.generar_alertas_ia() (RF-21)
// Solo jefe/administrador (verifica profiles.rol). Service-role ejecuta insert (bypass RLS via SECURITY DEFINER).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

function cors(origin?: string) {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

Deno.serve(async (req: Request) => {
  const headers = cors(req.headers.get('origin') ?? undefined);
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return Response.json({ error: 'Falta Authorization' }, { status: 401, headers });
  const jwt = auth.slice(7);

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  let uid: string | null = null;
  try {
    const { data: { user }, error } = await caller.auth.getUser(jwt);
    if (error || !user) throw error;
    uid = user.id;
  } catch {
    return Response.json({ error: 'Token inválido' }, { status: 401, headers });
  }

  const admin = createClient(url, serviceKey);
  const { data: prof } = await admin.from('profiles').select('rol,activo').eq('id', uid!).single();
  const rol = (prof as any)?.rol;
  const activo = (prof as any)?.activo;
  if (!activo || !['jefe','administrador'].includes(rol)) {
    return Response.json({ error: 'Solo jefe/administrador puede generar alertas' }, { status: 403, headers });
  }

  const { data, error } = await admin.rpc('generar_alertas_ia');
  if (error) return Response.json({ error: error.message }, { status: 500, headers });
  const insertados = Array.isArray(data) ? (data[0]?.insertados ?? data.length) : (data as any)?.insertados ?? 0;
  return Response.json({ insertados, data }, { headers });
});
