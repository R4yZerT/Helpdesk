// Edge Function auth-validate — RF-01 / RF-03 robusto NIST 800-63B + OWASP ASVS 2.1
// Valida contraseña contra HIBP k-anonimity (fail-closed) + checks síncronos
// Se invoca desde el cliente antes de signUp / update password; también como fallback del hook
// Si HIBP falla por red, responde 503 para que UI pida reintentar (no aceptar password dudoso)

const COMMON = new Set([
  'password','123456','123456789','qwerty','12345678','12345','1234567','password1',
  '123123','qwerty123','abc123','password123','admin','letmein','welcome','monkey',
  'dragon','passw0rd','master','hello','freedom','whatever','qazwsx','trustno1',
  '1234','1234567890','000000','1q2w3e4r','qwertyuiop','123qwe','zxcvbnm','superman',
  'iloveyou','starwars','123321','654321','qwerty12345','password12','admin123',
  'welcome123','login','princess','solo','qwerty1','baseball','football','jesus',
]);

function containsAttr(pwLower: string, attr?: string): boolean {
  if (!attr || attr.trim().length < 3) return false;
  const tokens = attr.toLowerCase().trim().split(/[@._\-\s]+/).filter(t=>t.length>=3);
  return tokens.some(t=> pwLower.includes(t));
}

async function sha1HexUpper(text: string): Promise<string> {
  const data = new TextEncoder().encode(text.normalize('NFKC'));
  const buf = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0').toUpperCase()).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  let body: { password?: string; email?: string; nombre?: string; rol?: string };
  try { body = await req.json(); } catch { return Response.json({ ok:false, reasons:['JSON inválido'] }, { status:400 }); }
  const raw = body.password ?? '';
  const pw = raw.normalize('NFKC');
  const reasons: string[] = [];

  if (pw.length < 8) reasons.push('Mínimo 8 caracteres');
  if (pw.length > 64) reasons.push('Máximo 64 caracteres');
  if (COMMON.has(pw.toLowerCase())) reasons.push('Contraseña muy común, elige otra');
  if (/(.)\1{3,}/.test(pw)) reasons.push('Evita repeticiones (aaaa)');
  const lower = pw.toLowerCase();
  if (containsAttr(lower, body.email)) reasons.push('No debe contener tu correo');
  if (containsAttr(lower, body.nombre)) reasons.push('No debe contener tu nombre');
  if (containsAttr(lower, body.rol)) reasons.push('No debe contener tu rol');

  // Secuencia 4
  const seq = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (let i=0; i<=lower.length-4; i++) {
    const sub = lower.slice(i,i+4);
    if (seq.includes(sub) || seq.split('').reverse().join('').includes(sub)) { reasons.push('Evita secuencias (abcd, 1234)'); break; }
  }

  if (reasons.length > 0) {
    return Response.json({ ok:false, reasons }, { status:200 });
  }

  // HIBP k-anonimity — fail-closed
  try {
    const hash = await sha1HexUpper(pw);
    const prefix = hash.slice(0,5);
    const suffix = hash.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, { headers:{'Add-Padding':'true'} , signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`HIBP ${res.status}`);
    const text = await res.text();
    for (const line of text.split('\n')) {
      const [s,c] = line.trim().split(':');
      if (s === suffix) {
        return Response.json({ ok:false, reasons:[`Apareció en ${parseInt(c,10).toLocaleString('es-CO')} filtraciones — elige otra`], pwned:true, count: parseInt(c,10) }, { status:200 });
      }
    }
    return Response.json({ ok:true, reasons:[] }, { status:200 });
  } catch (e) {
    // Fail-closed: no aceptar si no se pudo verificar
    return Response.json({ ok:false, reasons:['No se pudo verificar contra filtraciones, intenta de nuevo'], hibpError: e instanceof Error ? e.message : String(e) }, { status:503 });
  }
});
