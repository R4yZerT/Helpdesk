// Edge Function: resolve-login — resuelve cédula→email para login
// QA-C3 — cierra el oráculo de enumeración cédula→email:
// - Siempre responde HTTP 200 (exista o no la cédula), mismo shape de error genérico.
// - Piso de latencia (TIMING_FLOOR_MS) para no distinguir por tiempo de respuesta.
// - Rate-limit en memoria por IP (ventana deslizante) → 429 genérico.
// Anon permitido (es pre-login); la protección es el rate-limit + respuesta genérica.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const RATE_LIMIT_MAX = 20; // peticiones por ventana e IP
const RATE_LIMIT_WINDOW_MS = 60_000;
const TIMING_FLOOR_MS = 500; // piso de latencia para igualar exista/no-exista

const hits = new Map<string, number[]>();

function corsHeaders(origin?: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}
function isEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function isCedula(v: string) { return /^[0-9]{5,15}$/.test(v); }
function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  // Limpieza oportunista para no crecer sin cota
  if (hits.size > 10_000) {
    for (const [k, v] of hits) {
      if (v.length === 0 || now - v[v.length - 1] > RATE_LIMIT_WINDOW_MS) hits.delete(k);
      if (hits.size <= 5_000) break;
    }
  }
  return arr.length > RATE_LIMIT_MAX;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get('origin') ?? undefined);
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return Response.json({ error: 'Método no permitido' }, { status: 405, headers });

  const started = Date.now();
  const settle = () => sleep(Math.max(0, TIMING_FLOOR_MS - (Date.now() - started)));

  if (rateLimited(clientIp(req))) {
    await settle();
    return Response.json({ error: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.' }, { status: 429, headers });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  let body: { cedulaOrEmail?: string; identifier?: string; cedula?: string };
  try { body = await req.json(); } catch { await settle(); return Response.json({ error: 'Solicitud inválida' }, { headers }); }
  const raw = (body.cedulaOrEmail ?? body.identifier ?? body.cedula ?? '').trim();
  if (!raw) { await settle(); return Response.json({ error: 'Identificador requerido' }, { headers }); }

  // Si es email, devolver lower directamente (no lookup, no distingue nada)
  if (isEmail(raw)) { await settle(); return Response.json({ email: raw.toLowerCase() }, { headers }); }

  // Si no es email, debe ser cédula
  if (!isCedula(raw)) { await settle(); return Response.json({ error: 'Identificador debe ser email o cédula de 5 a 15 dígitos' }, { headers }); }

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data, error } = await adminClient.from('profiles').select('email').eq('cedula', raw).maybeSingle();
  await settle();
  // Respuesta genérica en ambos casos (error interno o no encontrada): no revelar existencia
  if (error || !data || !(data as { email: string | null }).email) {
    console.warn('[resolve-login] lookup fallido (genérico, sin PII en logs)');
    return Response.json({ error: 'No se encontró una cuenta con ese identificador' }, { headers });
  }

  return Response.json({ email: (data as { email: string }).email.toLowerCase() }, { headers });
});
