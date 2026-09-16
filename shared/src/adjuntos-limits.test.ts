// RF-07/B6 — regresión: los topes de adjuntos deben existir server-side
// (el cliente los valida, pero un bypass insertaba N archivos o metadatos
// gigantes). Si alguien elimina el trigger o la cota, este test falla.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const MIGRATION_URL = new URL(
  '../../supabase/migrations/20261016000004_rf07_adjuntos_server_limits.sql',
  import.meta.url,
);

describe('RF-07/B6 topes adjuntos server-side', () => {
  const sql = readFileSync(MIGRATION_URL, 'utf-8');

  it('trigger BEFORE INSERT limita a 5 archivos por ticket', () => {
    expect(sql).toMatch(/before insert on public\.ticket_adjuntos/);
    expect(sql).toMatch(/v_n >= 5/);
    expect(sql).toMatch(/Máximo 5 archivos/);
  });

  it('cota declarativa de 10 MB espeja el bucket y el cliente', () => {
    expect(sql).toMatch(/tamano_bytes <= 10485760/);
    expect(sql).toMatch(/ticket_adjuntos_tamano_max/);
  });

  it('trigger idempotente (drop + create)', () => {
    expect(sql).toMatch(/drop trigger if exists trg_ticket_adjuntos_check/);
    expect(sql).toMatch(/create trigger trg_ticket_adjuntos_check/);
  });
});
