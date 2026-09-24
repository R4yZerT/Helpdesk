// Sprint 3 (H9) — full-text a volumen: 50k tickets sintéticos en Postgres real
// (PGlite). Verifica EXPLAIN usa el GIN y reporta p95 medido.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

let db: PGlite;

function leer(ruta: string): string {
  return readFileSync(new URL(ruta, import.meta.url), 'utf-8');
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (id uuid primary key);
    create or replace function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid $$;
    create role authenticated;
    create role anon;
  `);
  await db.exec(leer('../../supabase/migrations/20260820150246_ticket_categories.sql'));
  await db.exec(leer('../../supabase/migrations/20260820150319_schema_inicial.sql'));
  await db.exec(leer('../../supabase/migrations/20261022000000_tickets_fulltext_search.sql'));
  await db.exec(`insert into auth.users values ('11111111-1111-4111-8111-111111111111');`);
  await db.exec(`insert into public.mesas (nombre) values ('Mesa Vol');`);
  await db.exec(`insert into public.profiles (id, full_name, rol) values ('11111111-1111-4111-8111-111111111111', 'Vol', 'empleado');`);
  // 50k tickets con vocabulario variado (uuid determinista vía md5)
  await db.exec(`
    insert into public.tickets (id, usuario_id, mesa_id, categoria_id, asunto, descripcion)
    select ('00000000-0000-4000-8000-' || lpad(to_hex(g), 12, '0'))::uuid,
      '11111111-1111-4111-8111-111111111111', 1, 1,
      'Ticket ' || g || case when g % 7 = 0 then ' impresora atasco papel' when g % 11 = 0 then ' wifi caido sin internet' else ' solicitud general soporte' end,
      'Descripcion larga del ticket numero ' || g || ' para busqueda fulltext en espanol con varias palabras'
    from generate_series(1, 50000) g;
  `);
  await db.exec('analyze public.tickets;');
}, 180000);

describe('full-text a 50k tickets', () => {
  it('el índice GIN resuelve la búsqueda (path indexado válido)', async () => {
    await db.exec('set enable_seqscan = off;');
    try {
      const r = await db.query<{ 'QUERY PLAN': string }>(
        `explain (costs off) select id from public.tickets where search_vector @@ websearch_to_tsquery('spanish', 'impresora') limit 20;`,
      );
      const plan = r.rows.map((x) => x['QUERY PLAN']).join('\n');
      expect(plan).toContain('tickets_search_vector_gin');
      const res = await db.query<{ id: string }>(
        `select id from public.tickets where search_vector @@ websearch_to_tsquery('spanish', 'impresora') limit 20;`,
      );
      expect(res.rows).toHaveLength(20);
    } finally {
      await db.exec('reset enable_seqscan;');
    }
  });

  it('p95 medido de 21 corridas (guarda catástrofe <5s)', async () => {
    const ts: number[] = [];
    for (let i = 0; i < 21; i++) {
      const t0 = Date.now();
      await db.query(
        `select id from public.tickets where search_vector @@ websearch_to_tsquery('spanish', 'impresora atasco') limit 20;`,
      );
      ts.push(Date.now() - t0);
    }
    ts.sort((a, b) => a - b);
    const p95 = ts[19];
    process.stdout.write(`\n[H9-volumen] p50=${ts[10]}ms p95=${p95}ms max=${ts[20]}ms (PGlite/WASM, 50k filas)\n`);
    expect(p95).toBeLessThan(5000);
  }, 180000);
});
