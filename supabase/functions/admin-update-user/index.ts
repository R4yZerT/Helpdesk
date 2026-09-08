// Edge Function: admin-update-user — RF-27.1 cambio email/password/cedula
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

function corsHeaders(origin?: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}
function isEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function isCedula(v: string) { return /^[0-9]{5,15}$/.test(v); }

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get('origin') ?? undefined);
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return Response.json({ error: 'Falta Authorization Bearer' }, { status: 401, headers });
  }
  const jwt = authHeader.slice(7);

  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  let callerId: string | null = null;
  try {
    const { data: { user }, error } = await callerClient.auth.getUser(jwt);
    if (error || !user) throw error ?? new Error('no user');
    callerId = user.id;
  } catch (_e) {
    return Response.json({ error: 'Token inválido o expirado' }, { status: 401, headers });
  }

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: callerProfile, error: profErr } = await adminClient.from('profiles').select('rol, activo').eq('id', callerId!).single();
  if (profErr || !callerProfile) return Response.json({ error: 'No se pudo verificar rol' }, { status: 403, headers });
  const c = callerProfile as { rol: string; activo: boolean };
  if (!c.activo || c.rol !== 'administrador') {
    return Response.json({ error: 'Solo administrador puede actualizar usuarios' }, { status: 403, headers });
  }

  let body: { id?: string; email?: string; cedula?: string; password?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400, headers }); }

  const id = (body.id ?? '').trim();
  if (!id) return Response.json({ error: 'id requerido' }, { status: 400, headers });

  const authPatch: Record<string, string> = {};
  let newCedula: string | undefined;
  let newEmail: string | undefined;

  if (body.email !== undefined) {
    const email = body.email.trim().toLowerCase();
    if (!isEmail(email)) return Response.json({ error: 'Email inválido' }, { status: 400, headers });
    authPatch.email = email;
    newEmail = email;
  }
  if (body.cedula !== undefined) {
    const ced = body.cedula.trim();
    if (!isCedula(ced)) return Response.json({ error: 'Cédula 5-15 dígitos' }, { status: 400, headers });
    newCedula = ced;
  }
  if (body.password !== undefined) {
    const pwd = body.password;
    if (pwd.length < 8) return Response.json({ error: 'Mínimo 8 caracteres' }, { status: 400, headers });
    if (pwd.length > 72) return Response.json({ error: 'Máximo 72 caracteres' }, { status: 400, headers });
    authPatch.password = pwd;
  }

  if (Object.keys(authPatch).length === 0 && newCedula === undefined) return Response.json({ error: 'Nada que actualizar' }, { status: 400, headers });

  // Si cambia cédula, verificar duplicado y actualizar profile
  if (newCedula !== undefined) {
    const { data: dup } = await adminClient.from('profiles').select('id').eq('cedula', newCedula).maybeSingle();
    if (dup && (dup as { id: string }).id !== id) return Response.json({ error: 'Cédula ya registrada' }, { status: 409, headers });
    const updates: Record<string, unknown> = { cedula: newCedula };
    if (newEmail !== undefined) updates.email = newEmail;
    const { error: upErr } = await adminClient.from('profiles').update(updates).eq('id', id);
    if (upErr) {
      if (/duplicate|unique/i.test(upErr.message) && /cedula/i.test(upErr.message)) return Response.json({ error: 'Cédula ya registrada' }, { status: 409, headers });
      return Response.json({ error: upErr.message }, { status: 400, headers });
    }
    // Si solo era cédula (sin email/password), ya terminamos
    if (Object.keys(authPatch).length === 0) return Response.json({ ok: true }, { headers });
  } else if (newEmail !== undefined && Object.keys(authPatch).length === 1 && authPatch.email) {
    // Si solo cambió email (sin password/cedula), también espejar en profile antes de auth
    const { error: upErr } = await adminClient.from('profiles').update({ email: newEmail }).eq('id', id);
    if (upErr) return Response.json({ error: upErr.message }, { status: 400, headers });
  }

  // Actualizar auth (email/password)
  if (Object.keys(authPatch).length > 0) {
    const { error } = await adminClient.auth.admin.updateUserById(id, authPatch);
    if (error) {
      if (/already.*exists|duplicate/i.test(error.message)) return Response.json({ error: 'Email ya registrado' }, { status: 409, headers });
      return Response.json({ error: error.message }, { status: 400, headers });
    }
    // Si auth email cambió y no se actualizó profile aún (caso password+email sin cédula previa)
    if (newEmail !== undefined && newCedula === undefined) {
      await adminClient.from('profiles').update({ email: newEmail }).eq('id', id);
    }
  }

  return Response.json({ ok: true }, { headers });
});
