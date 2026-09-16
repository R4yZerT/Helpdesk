// RF-10/B1 — regresión: la policy RLS que permite al dueño cancelar
// (abierto -> cerrado sin técnico) debe existir con mínimo privilegio.
// Lee la migración SQL y verifica su forma: si alguien la elimina o la
// amplía (p. ej. WITH CHECK sin exigir estado='cerrado'), este test falla.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const MIGRATION_URL = new URL(
  '../../supabase/migrations/20261016000002_rf10_cancel_policy.sql',
  import.meta.url,
);

function loadMigration(): string {
  return readFileSync(MIGRATION_URL, 'utf8');
}

describe('RF-10 policy cancelar propia (B1)', () => {
  it('existe la policy tickets_update_empleado_cancelar', () => {
    expect(loadMigration()).toContain('tickets_update_empleado_cancelar');
  });

  it('USING exige dueño + abierto + sin técnico', () => {
    const sql = loadMigration();
    const using = sql.slice(sql.indexOf('using ('), sql.indexOf('with check ('));
    expect(using).toMatch(/usuario_id\s*=\s*auth\.uid\(\)/);
    expect(using).toMatch(/estado\s*=\s*'abierto'/);
    expect(using).toMatch(/tecnico_asignado_id\s+is\s+null/i);
  });

  it('WITH CHECK solo permite llegar a cerrado, sin reasignar ni transferir', () => {
    const sql = loadMigration();
    const check = sql.slice(sql.indexOf('with check ('));
    expect(check).toMatch(/usuario_id\s*=\s*auth\.uid\(\)/);
    expect(check).toMatch(/estado\s*=\s*'cerrado'/);
    expect(check).toMatch(/tecnico_asignado_id\s+is\s+null/i);
    // No debe abrir la puerta a otros estados
    expect(check).not.toMatch(/'(solucionado|devuelto|en_proceso|programado)'/);
  });
});
