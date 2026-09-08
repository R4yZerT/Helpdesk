// Edge Function: admin-create-user — cierre + cédula
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const ALLOWED_ROLES_DB = new Set(['usuario', 'tecnico', 'jefe', 'administrador']);
const MAP_ROL: Record<string, string> = { usuario: 'usuario', empleado: 'usuario', tecnico: 'tecnico', jefe: 'jefe', administrador: 'administrador' };

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
  // score <2 fallback
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
  const cRol = callerProfile as { rol: string; activo: boolean };
  if (!cRol.activo || cRol.rol !== 'administrador') {
    return Response.json({ error: 'Solo administrador puede crear usuarios' }, { status: 403, headers });
  }

  let body: { fullName?: string; email?: string; cedula?: string; password?: string; rol?: string; mesaId?: number | null };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400, headers }); }

  const fullName = (body.fullName ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const cedula = (body.cedula ?? '').trim();
  const password = body.password ?? '';
  const rolIn = (body.rol ?? '').trim().toLowerCase();
  const mesaId = body.mesaId ?? null;

  const errs: Record<string, string> = {};
  if (fullName.length < 3) errs.fullName = 'Nombre mínimo 3 caracteres';
  else if (fullName.length > 80) errs.fullName = 'Nombre máximo 80 caracteres';
  if (!isEmail(email)) errs.email = 'Email inválido';
  if (!isCedula(cedula)) errs.cedula = 'Cédula 5-15 dígitos';
  if (!password) errs.password = 'Contraseña requerida';
  else {
    const pwReasons = validatePasswordNIST(password, { email, nombre: fullName, rol: rolIn });
    if (pwReasons.length) errs.password = pwReasons.join(' · ');
  }
  const rolDb = MAP_ROL[rolIn];
  if (!rolDb || !ALLOWED_ROLES_DB.has(rolDb)) errs.rol = 'Rol inválido';
  if (mesaId !== null && (!Number.isInteger(mesaId) || mesaId <= 0)) errs.mesaId = 'Mesa inválida';
  if (Object.keys(errs).length) return Response.json({ error: 'Validación', details: errs }, { status: 400, headers });

  if (mesaId !== null) {
    const { data: mesa, error: mesaErr } = await adminClient.from('mesas').select('id').eq('id', mesaId).single();
    if (mesaErr || !mesa) return Response.json({ error: 'Mesa no existe' }, { status: 400, headers });
  }
  // Verificar cédula y correo duplicados antes de crear auth
  const { data: dupCed } = await adminClient.from('profiles').select('id').eq('cedula', cedula).maybeSingle();
  if (dupCed) return Response.json({ error: 'Cédula ya registrada' }, { status: 409, headers });
  const { data: dupEmail } = await adminClient.from('profiles').select('id').eq('email', email).maybeSingle();
  if (dupEmail) return Response.json({ error: 'Correo ya registrado' }, { status: 409, headers });

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, rol: rolDb, cedula },
  });
  if (error) {
    if (/already.*exists|duplicate/i.test(error.message)) return Response.json({ error: 'Correo ya registrado' }, { status: 409, headers });
    return Response.json({ error: error.message }, { status: 400, headers });
  }
  const newId = data.user?.id;
  if (!newId) return Response.json({ error: 'No se pudo crear usuario' }, { status: 500, headers });

  // Trigger handle_new_user ya creó profile; actualizar cedula/email/mesa_id por si acaso
  const { error: upErr } = await adminClient.from('profiles').update({ cedula, email, mesa_id: mesaId }).eq('id', newId);
  if (upErr) {
    if (/duplicate|unique/i.test(upErr.message) && /cedula/i.test(upErr.message)) return Response.json({ error: 'Cédula ya registrada' }, { status: 409, headers });
    if (/duplicate|unique/i.test(upErr.message)) return Response.json({ error: 'Correo ya registrado' }, { status: 409, headers });
    return Response.json({ id: newId, warning: `Usuario creado pero no se asignó cédula/mesa: ${upErr.message}` }, { status: 201, headers });
  }

  return Response.json({ id: newId }, { status: 201, headers });
});
