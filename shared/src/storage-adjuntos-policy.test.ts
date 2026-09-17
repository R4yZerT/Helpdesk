// QA-C1 — regresión: las policies de Storage ticket-adjuntos deben exigir
// visibilidad del ticket (puede_ver_ticket). Si alguien las relaja a solo
// bucket_id (cualquier authenticated lee/borra ajeno), este test falla.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const MIGRATION_URL = new URL(
  '../../supabase/migrations/20261018000000_storage_adjuntos_por_ticket.sql',
  import.meta.url,
);

describe('QA-C1 policies Storage ligadas al ticket', () => {
  const sql = readFileSync(MIGRATION_URL, 'utf-8');

  it('elimina las 4 policies abiertas por bucket_id', () => {
    for (const name of [
      'ticket_adjuntos_insert_authenticated',
      'ticket_adjuntos_select_authenticated',
      'ticket_adjuntos_update_authenticated',
      'ticket_adjuntos_delete_authenticated',
    ]) {
      expect(sql).toContain(`drop policy if exists "${name}" on storage.objects`);
    }
  });

  it('las 4 operaciones exigen puede_ver_ticket sobre el ticket del path', () => {
    const matches = sql.match(/puede_ver_ticket\(public\.storage_ticket_id\(name\)\)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });

  it('helper fail-closed: path sin UUID válido → null (deniega)', () => {
    expect(sql).toMatch(/returns uuid/);
    expect(sql).toMatch(/invalid_text_representation/);
    expect(sql).toMatch(/return null/);
  });

  it('helper con search_path fijado (higiene search_path)', () => {
    expect(sql).toMatch(/set search_path = public/);
  });
});
