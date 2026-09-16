// RF-23/B2 — regresión: la cadena de despacho push debe permanecer cableada.
// Eslabones: (1) migración SQL con sender + cron cada 5 min (con guards si falta
// pg_net/pg_cron/config); (2) Edge send-push que despacha vía Expo Push API y marca
// enviada_en (dedup). Si alguien elimina el cron, el guard pg_net o el despacho Expo,
// este test falla.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SENDER_URL = new URL(
  '../../supabase/migrations/20261001000000_rf23_send_push.sql',
  import.meta.url,
);
const EDGE_URL = new URL(
  '../../supabase/functions/send-push/index.ts',
  import.meta.url,
);

describe('RF-23 cadena push (B2)', () => {
  it('sender SQL existe con cron cada 5 minutos', () => {
    const sql = readFileSync(SENDER_URL, 'utf8');
    expect(sql).toContain('send_push_cada_5min');
    expect(sql).toMatch(/\*\/5 \* \* \* \*/);
  });

  it('sender es fail-safe sin pg_net ni configuración (in-app intacto)', () => {
    const sql = readFileSync(SENDER_URL, 'utf8');
    expect(sql).toMatch(/pg_net/);
    expect(sql).toContain('app.settings.functions_url');
    expect(sql).toContain('app.settings.service_role_key');
    expect(sql).toMatch(/in-app/i);
  });

  it('Edge despacha vía Expo Push API y marca enviada_en (dedup)', () => {
    const edge = readFileSync(EDGE_URL, 'utf8');
    expect(edge).toContain('https://exp.host/--/api/v2/push/send');
    expect(edge).toContain('push_tokens');
    expect(edge).toContain('enviada_en');
    expect(edge).toMatch(/ExponentPushToken\[/);
  });
});
