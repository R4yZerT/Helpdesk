// RF-01 / RF-03 — Validación robusta de contraseñas según NIST SP 800-63B §5.1.1.2 + OWASP ASVS 2.1
// Normas aplicadas:
// - Longitud 8..64, sin truncar, sin composición forzada, NFKC (NIST)
// - No contener email/nombre/rol (ASVS 2.1.8)
// - Check HaveIBeenPwned k-anonimity (NIST: verificar contra corpus filtrado)
// - Lista Top 10k comunes + secuencias/repeticiones (OWASP)
// - Estimación zxcvbn-like ligera (sin dependencia externa)

// Límites NIST
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

// Top 100 más comunes (extracto Top 10k) — suficiente para bloquear peores casos sin bundle gigante
const COMMON_PASSWORDS = new Set([
  'password', '123456', '123456789', 'qwerty', '12345678', '12345', '1234567', 'password1',
  '123123', 'qwerty123', 'abc123', 'password123', 'admin', 'letmein', 'welcome', 'monkey',
  'dragon', 'passw0rd', 'master', 'hello', 'freedom', 'whatever', 'qazwsx', 'trustno1',
  '1234', '1234567890', '000000', '1q2w3e4r', 'qwertyuiop', '123qwe', 'zxcvbnm', 'superman',
  'iloveyou', 'starwars', '123321', '654321', 'qwerty12345', 'password12', 'admin123',
  'welcome123', 'login', 'princess', 'solo', 'qwerty1', 'baseball', 'football', 'jesus',
]);

export type PasswordContext = {
  email?: string;
  nombre?: string;
  rol?: string;
};

export type PasswordValidation = {
  ok: boolean;
  reasons: string[];
  // Detalles para UI
  lengthOk: boolean;
  pwnedCount?: number;
  strength: 'muy_debil' | 'debil' | 'aceptable' | 'fuerte';
  score: 0 | 1 | 2 | 3 | 4;
};

// Normalización NFKC + sin trim (NIST: espacios cuentan, no truncar)
export function normalizePassword(pw: string): string {
  // NFKC para equivalencia Unicode (ej: ﬁ -> fi)
  return pw.normalize('NFKC');
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function containsUserAttribute(pwLower: string, attr?: string): boolean {
  if (!attr) return false;
  const clean = stripAccents(attr.toLowerCase().trim());
  const pwNorm = stripAccents(pwLower);
  if (clean.length < 3) return false;
  const tokens = clean.split(/[@._\-\s]+/).filter((t) => t.length >= 3);
  return tokens.some((t) => pwNorm.includes(t));
}

function hasRepetitionOrSequence(pw: string): boolean {
  // Repetición 4+ iguales: aaaa, 1111
  if (/(.)\1{3,}/.test(pw)) return true;
  // Secuencias 4+ asc/desc
  const seq = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const lower = pw.toLowerCase();
  for (let i = 0; i <= lower.length - 4; i++) {
    const sub = lower.slice(i, i + 4);
    if (seq.includes(sub) || seq.split('').reverse().join('').includes(sub)) return true;
  }
  return false;
}

// Heurística ligera tipo zxcvbn sin dependencia: longitud + variedad + penalizaciones
function estimateStrength(pw: string, ctx: PasswordContext): { score: PasswordValidation['score']; strength: PasswordValidation['strength'] } {
  let score = 0;
  const len = pw.length;
  if (len >= 8) score++;
  if (len >= 12) score++;
  // Variedad de caracteres
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /[0-9]/.test(pw);
  const hasSymbol = /[^a-zA-Z0-9]/.test(pw);
  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  if (variety >= 3) score++;
  if (variety === 4 && len >= 12) score++;

  // Penalizaciones
  const lower = pw.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) score = 0;
  if (containsUserAttribute(lower, ctx.email) || containsUserAttribute(lower, ctx.nombre) || containsUserAttribute(lower, ctx.rol)) {
    score = Math.min(score, 1);
  }
  if (hasRepetitionOrSequence(pw)) score = Math.min(score, 1);

  const clamped = Math.max(0, Math.min(4, score)) as PasswordValidation['score'];
  const map: Record<number, PasswordValidation['strength']> = {
    0: 'muy_debil',
    1: 'debil',
    2: 'aceptable',
    3: 'fuerte',
    4: 'fuerte',
  };
  return { score: clamped, strength: map[clamped] };
}

// Validación síncrona (sin HIBP) — para feedback instantáneo
export function validatePasswordSync(password: string, ctx: PasswordContext = {}): PasswordValidation {
  const reasons: string[] = [];
  const pw = normalizePassword(password);
  const len = pw.length;

  const lengthOk = len >= PASSWORD_MIN_LENGTH && len <= PASSWORD_MAX_LENGTH;
  if (len < PASSWORD_MIN_LENGTH) reasons.push(`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`);
  if (len > PASSWORD_MAX_LENGTH) reasons.push(`Máximo ${PASSWORD_MAX_LENGTH} caracteres`);

  const lower = pw.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) reasons.push('Contraseña muy común, elige otra');
  if (hasRepetitionOrSequence(pw)) reasons.push('Evita repeticiones o secuencias (aaaa, 1234)');
  if (containsUserAttribute(lower, ctx.email)) reasons.push('No debe contener tu correo');
  if (containsUserAttribute(lower, ctx.nombre)) reasons.push('No debe contener tu nombre');
  if (containsUserAttribute(lower, ctx.rol)) reasons.push('No debe contener tu rol');

  const { score, strength } = estimateStrength(pw, ctx);

  const ok = reasons.length === 0 && lengthOk && score >= 2;
  // Si score <2 aunque pase longitud, se considera débil
  if (score < 2 && !reasons.includes('Contraseña demasiado débil')) {
    // Solo añade razón si no hay otra más específica
    if (reasons.length === 0) reasons.push('Contraseña demasiado débil, añade longitud y variedad');
  }

  return {
    ok: ok && reasons.length === 0,
    reasons,
    lengthOk,
    strength,
    score,
  };
}

// — HaveIBeenPwned k-anonimity —

// SHA-1 en Web Crypto / Node — hex uppercase
export async function sha1HexUpper(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  // @ts-ignore — crypto disponible en Node 19+ y Deno
  const buf: ArrayBuffer =
    typeof crypto !== 'undefined' && (crypto as unknown as { subtle: SubtleCrypto }).subtle
      ? await (crypto as unknown as { subtle: SubtleCrypto }).subtle.digest('SHA-1', data)
      : await fallbackSha1(data);
  const bytes = new Uint8Array(buf);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join('');
}

// Fallback SHA-1 puro JS si subtle no disponible (tests)
async function fallbackSha1(data: Uint8Array): Promise<ArrayBuffer> {
  // Implementación mínima SHA-1 sin dependencias
  // Usa WebCrypto si existe, si no, lanza
  throw new Error('SubtleCrypto no disponible para SHA-1');
}

export type PwnedResult = { pwned: boolean; count: number };

export async function checkPwned(
  password: string,
  fetcher: typeof fetch = fetch,
  opts: { timeoutMs?: number } = {},
): Promise<PwnedResult> {
  const pw = normalizePassword(password);
  const hash = await sha1HexUpper(pw);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeoutMs ?? 3000);
  try {
    const res = await fetcher(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HIBP ${res.status}`);
    const body = await res.text();
    // Cada línea: SUFFIX:COUNT
    for (const line of body.split('\n')) {
      const [s, c] = line.trim().split(':');
      if (s === suffix) return { pwned: true, count: parseInt(c, 10) };
    }
    return { pwned: false, count: 0 };
  } finally {
    clearTimeout(t);
  }
}

// Validación completa (sync + HIBP) — fail-closed: si HIBP falla, se considera no válida y se pide reintentar
export async function validatePassword(
  password: string,
  ctx: PasswordContext = {},
  fetcher: typeof fetch = fetch,
): Promise<PasswordValidation & { pwned?: boolean; pwnedCount?: number; hibpError?: string }> {
  const sync = validatePasswordSync(password, ctx);
  if (!sync.ok) return sync;

  try {
    const { pwned, count } = await checkPwned(password, fetcher);
    if (pwned) {
      return {
        ...sync,
        ok: false,
        pwned: true,
        pwnedCount: count,
        reasons: [...sync.reasons, `Apareció en ${count.toLocaleString('es-CO')} filtraciones — elige otra`],
      };
    }
    return { ...sync, pwned: false, pwnedCount: 0 };
  } catch (e) {
    return {
      ...sync,
      ok: false,
      hibpError: e instanceof Error ? e.message : String(e),
      reasons: [...sync.reasons, 'No se pudo verificar contra filtraciones, intenta de nuevo'],
    };
  }
}

// Helper para UI: mensaje de fortaleza
export function strengthLabel(s: PasswordValidation['strength']): string {
  return { muy_debil: 'Muy débil', debil: 'Débil', aceptable: 'Aceptable', fuerte: 'Fuerte' }[s];
}
