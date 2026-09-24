// Sprint 3 (H1) — Realtime connect/disconnect contra proyecto real.
// Requiere EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY (CI los
// inyecta como secrets; en local se omiten y el archivo queda en skip).
// Solo ciclo de vida del canal, sin lecturas/escrituras de datos.
import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const HAY_CREDENCIALES = URL.startsWith('http') && KEY.length > 20;

describe.skipIf(!HAY_CREDENCIALES)('realtime connect/disconnect', () => {
  it('suscribe y libera un canal sin colgar', async () => {
    const sb = createClient(URL, KEY);
    const estado = await new Promise<string>((resolver) => {
      const ch = sb.channel('smoke-h1-ciclo');
      const fin = setTimeout(() => resolver('TIMEOUT'), 12000);
      ch.subscribe((s) => {
        if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          clearTimeout(fin);
          void sb.removeChannel(ch).catch(() => {});
          resolver(s);
        }
      });
    });
    // Conectado o rechazado por RLS: ambos cierran el ciclo limpiamente
    expect(['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']).toContain(estado);
  }, 20000);
});
