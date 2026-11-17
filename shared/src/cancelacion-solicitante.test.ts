// RF-10 — regresión: la asignación es automática al crear, así que cancelar no
// puede depender de que el ticket siga sin técnico. Si alguien vuelve a atar la
// cancelación a `tecnico_asignado_id is null`, el solicitante pierde la acción.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function repo(rel: string): string {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
}

const MIGRACION = 'supabase/migrations/20261117120000_cancelacion_solicitante_abierto.sql';

describe('Cancelación del solicitante', () => {
  it('la política permite cancelar un ticket abierto ya asignado', () => {
    const sql = repo(MIGRACION).replace(/--.*$/gm, '');
    expect(sql).toContain('tickets_update_solicitante_cancelar');
    expect(sql).toMatch(/estado = 'abierto'/);
    expect(sql).toMatch(/estado = 'cerrado'/);
    expect(sql).toContain('ticket_inmutables_ok');
    // El técnico se asigna al insertar: no puede ser condición para cancelar.
    expect(sql).not.toMatch(/tecnico_asignado_id\s+is\s+null/i);
  });

  it('web y móvil ofrecen cancelar mientras el ticket esté abierto', () => {
    for (const rel of [
      'apps/web/src/features/tickets/TicketDetailScreen.tsx',
      'apps/mobile/src/features/tickets/TicketDetailScreen.tsx',
    ]) {
      const screen = repo(rel);
      expect(screen).toContain('const canCancel = isOwner && ticket.estado === \'abierto\';');
      expect(screen).toContain('const canEdit = canCancel && !ticket.tecnicoAsignadoId;');
      expect(screen).not.toContain("const canCancel = canEdit;");
    }
  });

  it('el formulario de creación no admite técnico', () => {
    const tickets = repo('shared/src/tickets.ts');
    const input = tickets.slice(tickets.indexOf('export type CreateTicketInput'));
    expect(input.slice(0, input.indexOf('};'))).not.toContain('tecnicoAsignadoId');
  });
});
