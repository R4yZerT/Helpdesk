// RF-24/B5 — regresión: el trigger de notificación debe cubrir ticket_estancado
// de severidad alta/crítica (antes solo picos; los estancados se creaban pero el
// jefe nunca era avisado). Si alguien reescribe la función y pierde el tercer tipo,
// este test falla.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const MIGRATION_URL = new URL(
  '../../supabase/migrations/20261016000003_rf24_estancado_notify.sql',
  import.meta.url,
);

describe('RF-24/B5 trigger ticket_estancado', () => {
  const sql = readFileSync(MIGRATION_URL, 'utf-8');

  it('la función incluye ticket_estancado junto a los picos', () => {
    expect(sql).toMatch(/'ticket_estancado'::public\.tipo_alerta_ia/);
    expect(sql).toMatch(/'pico_inusual'::public\.tipo_alerta_ia/);
    expect(sql).toMatch(/'pico_esperado'::public\.tipo_alerta_ia/);
  });

  it('mantiene el guard de severidad alta/crítica (mínimo privilegio de ruido)', () => {
    expect(sql).toMatch(/NEW\.severidad in \('alta', 'critica'\)/);
  });

  it('notifica a jefes/administradores activos vía notificaciones', () => {
    expect(sql).toMatch(/insert into public\.notificaciones/);
    expect(sql).toMatch(/p\.rol in \('jefe', 'administrador'\)/);
  });

  it('recrea el trigger sobre alertas_ia (idempotente)', () => {
    expect(sql).toMatch(/drop trigger if exists trg_alerta_ia_notificar/);
    expect(sql).toMatch(/create trigger trg_alerta_ia_notificar/);
  });
});
