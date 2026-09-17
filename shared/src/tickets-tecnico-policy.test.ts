// QA-C4 — regresión: tickets_update_tecnico no debe volver a WITH CHECK (true).
// El técnico solo muta estado/solución (FSM), asignación y mesa (RF-14);
// usuario_id, numero, categoria_id, prioridad, asunto, descripcion y creado_en
// quedan fijados a sus valores previos.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const MIGRATION_URL = new URL(
  '../../supabase/migrations/20261018000001_tecnico_update_inmutables.sql',
  import.meta.url,
);

const PINNED = [
  'usuario_id',
  'numero',
  'categoria_id',
  'prioridad',
  'asunto',
  'descripcion',
  'creado_en',
];

describe('QA-C4 tecnico no muta columnas inmutables', () => {
  const sql = readFileSync(MIGRATION_URL, 'utf-8');
  // Sin comentarios: el header explica el problema, no debe contar como código
  const code = sql.replace(/^--.*$/gm, '');

  it('recrea la policy tickets_update_tecnico (drop + create)', () => {
    expect(code).toMatch(/drop policy if exists "tickets_update_tecnico" on public\.tickets/);
    expect(code).toMatch(/create policy "tickets_update_tecnico" on public\.tickets/);
  });

  it('USING sigue exigiendo técnico asignado, activo y rol tecnico', () => {
    expect(code).toMatch(/tecnico_asignado_id = auth\.uid\(\)/);
    expect(code).toMatch(/p\.rol = 'tecnico'/);
    expect(code).toMatch(/p\.activo/);
  });

  it('WITH CHECK fija cada columna inmutable a su valor previo', () => {
    expect(code).not.toMatch(/with check\s*\(\s*true\s*\)/i);
    for (const col of PINNED) {
      expect(code).toContain(`${col} = (select t.${col} from public.tickets t where t.id = tickets.id)`);
    }
  });
});
