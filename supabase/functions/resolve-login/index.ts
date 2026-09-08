// Edge Function: resolve-login — resuelve cédula→email para login
// Permite login con cédula (5-15 dígitos) o email. Retorna email para luego hacer signInWithPassword.
// Anon permitido (no verifica rol), rate-limit implícito por supabase.
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

  let body: { cedulaOrEmail?: string; identifier?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400, headers }); }
  const raw = (body.cedulaOrEmail ?? body.identifier ?? '').trim();
  if (!raw) return Response.json({ error: 'Identificador requerido' }, { status: 400, headers });

  // Si es email, devolver lower directamente (no lookup)
  if (isEmail(raw)) return Response.json({ email: raw.toLowerCase() }, { headers });

  // Si no es email, debe ser cédula
  if (!isCedula(raw)) return Response.json({ error: 'Identificador debe ser email o cédula 5-15 dígitos' }, { status: 400, headers });

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data, error } = await adminClient.from('profiles').select('email').eq('cedula', raw).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 400, headers });
  if (!data || !(data as { email: string | null }).email) return Response.json({ error: 'Cédula no encontrada' }, { status: 404, headers });

  return Response.json({ email: (data as { email: string }).email.toLowerCase() }, { headers });
});
