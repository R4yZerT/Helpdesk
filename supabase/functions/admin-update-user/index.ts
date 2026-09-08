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
const COMMON_PASSWORDS = new Set(['password','123456','123456789','qwerty','12345678','12345','1234567','password1','123123','qwerty123','abc123','password123','admin','letmein','welcome','monkey','dragon','passw0rd','master','hello','freedom','whatever','qazwsx','trustno1','1234','1234567890','000000','1q2w3e4r','qwertyuiop','123qwe','zxcvbnm','superman','iloveyou','starwars','123321','654321','qwerty12345','password12','admin123','welcome123','login','princess','solo','qwerty1','baseball','football','jesus']);
function stripAccents(s: string){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function containsAttr(pwLower: string, attr?: string){
  if(!attr) return false;
  const clean = stripAccents(attr.toLowerCase().trim());
  if(clean.length<3) return false;
  const tokens = clean.split(/[@._\-\s]+/).filter(t=>t.length>=3);
  return tokens.some(t=> pwLower.includes(stripAccents(t.toLowerCase())));
}
function hasRepetitionOrSequence(pw: string){
  if(/(.)\1{3,}/.test(pw)) return true;
  const seq='abcdefghijklmnopqrstuvwxyz0123456789';
  const lower=pw.toLowerCase();
  for(let i=0;i<=lower.length-4;i++){ const sub=lower.slice(i,i+4); if(seq.includes(sub) || seq.split('').reverse().join('').includes(sub)) return true; }
  return false;
}
function validatePasswordNIST(pw: string, ctx:{email?:string;nombre?:string;rol?:string}){
  const reasons:string[]=[];
  const len=pw.length;
  if(len<8) reasons.push('Mínimo 8 caracteres');
  if(len>64) reasons.push('Máximo 64 caracteres');
  const lower=pw.toLowerCase();
  if(COMMON_PASSWORDS.has(lower)) reasons.push('Contraseña muy común, elige otra');
  if(hasRepetitionOrSequence(pw)) reasons.push('Evita repeticiones o secuencias (aaaa, 1234)');
  if(containsAttr(lower, ctx.email)) reasons.push('No debe contener tu correo');
  if(containsAttr(lower, ctx.nombre)) reasons.push('No debe contener tu nombre');
  if(containsAttr(lower, ctx.rol)) reasons.push('No debe contener tu rol');
  if(reasons.length===0){
    let score=0;
    if(len>=8) score++;
    if(len>=12) score++;
    const hasLower=/[a-z]/.test(pw), hasUpper=/[A-Z]/.test(pw), hasDigit=/[0-9]/.test(pw), hasSymbol=/[^a-zA-Z0-9]/.test(pw);
    const variety=[hasLower,hasUpper,hasDigit,hasSymbol].filter(Boolean).length;
    if(variety>=3) score++;
    if(variety===4 && len>=12) score++;
    if(score<2) reasons.push('Contraseña demasiado débil, añade longitud y variedad (mayúsculas, números, símbolos)');
  }
  return reasons;
}

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
    // obtener contexto para validar atributos (email/nombre si vienen en body, sino buscar profile)
    let ctxEmail = newEmail;
    let ctxNombre: string | undefined;
    if (!ctxEmail || !ctxNombre) {
      const { data: prof } = await adminClient.from('profiles').select('email, full_name, rol').eq('id', id).maybeSingle();
      if (prof) {
        ctxEmail = ctxEmail ?? (prof as { email: string }).email ?? undefined;
        ctxNombre = (prof as { full_name: string }).full_name ?? undefined;
      }
    }
    const reasons = validatePasswordNIST(pwd, { email: ctxEmail, nombre: ctxNombre });
    if (reasons.length) return Response.json({ error: reasons.join(' · ') }, { status: 400, headers });
    authPatch.password = pwd;
  }

  if (Object.keys(authPatch).length === 0 && newCedula === undefined) return Response.json({ error: 'Nada que actualizar' }, { status: 400, headers });

  // Si cambia cédula, verificar duplicado y actualizar profile
  if (newCedula !== undefined) {
    const { data: dup } = await adminClient.from('profiles').select('id').eq('cedula', newCedula).maybeSingle();
    if (dup && (dup as { id: string }).id !== id) return Response.json({ error: 'Cédula ya registrada' }, { status: 409, headers });
    if (newEmail !== undefined) {
      const { data: dupEmail } = await adminClient.from('profiles').select('id').eq('email', newEmail).maybeSingle();
      if (dupEmail && (dupEmail as { id: string }).id !== id) return Response.json({ error: 'Correo ya registrado' }, { status: 409, headers });
    }
    const updates: Record<string, unknown> = { cedula: newCedula };
    if (newEmail !== undefined) updates.email = newEmail;
    const { error: upErr } = await adminClient.from('profiles').update(updates).eq('id', id);
    if (upErr) {
      if (/duplicate|unique/i.test(upErr.message) && /cedula/i.test(upErr.message)) return Response.json({ error: 'Cédula ya registrada' }, { status: 409, headers });
      if (/duplicate|unique/i.test(upErr.message) && /email/i.test(upErr.message)) return Response.json({ error: 'Correo ya registrado' }, { status: 409, headers });
      return Response.json({ error: upErr.message }, { status: 400, headers });
    }
    // Si solo era cédula (sin email/password), ya terminamos
    if (Object.keys(authPatch).length === 0) return Response.json({ ok: true }, { headers });
  } else if (newEmail !== undefined && Object.keys(authPatch).length === 1 && authPatch.email) {
    // Verificar correo duplicado antes de actualizar
    const { data: dupEmail } = await adminClient.from('profiles').select('id').eq('email', newEmail).maybeSingle();
    if (dupEmail && (dupEmail as { id: string }).id !== id) return Response.json({ error: 'Correo ya registrado' }, { status: 409, headers });
    const { error: upErr } = await adminClient.from('profiles').update({ email: newEmail }).eq('id', id);
    if (upErr) {
      if (/duplicate|unique/i.test(upErr.message) && /email/i.test(upErr.message)) return Response.json({ error: 'Correo ya registrado' }, { status: 409, headers });
      return Response.json({ error: upErr.message }, { status: 400, headers });
    }
  }

  // Actualizar auth (email/password)
  if (Object.keys(authPatch).length > 0) {
    const { error } = await adminClient.auth.admin.updateUserById(id, authPatch);
    if (error) {
      if (/already.*exists|duplicate/i.test(error.message)) return Response.json({ error: 'Correo ya registrado' }, { status: 409, headers });
      return Response.json({ error: error.message }, { status: 400, headers });
    }
    // Si auth email cambió y no se actualizó profile aún (caso password+email sin cédula previa)
    if (newEmail !== undefined && newCedula === undefined) {
      await adminClient.from('profiles').update({ email: newEmail }).eq('id', id);
    }
  }

  return Response.json({ ok: true }, { headers });
});
