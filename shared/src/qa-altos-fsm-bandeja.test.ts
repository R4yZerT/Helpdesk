// QA-H3/H-4/H-5/H-6 — regresión: bandeja ordenada en DB, transición
// anti-TOCTOU, fecha_resolucion al reabrir y destino de reasignación validado.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validarDestinoReasignacion } from './tickets.js';

const TICKETS_URL = new URL('./tickets.ts', import.meta.url);
const PESO_URL = new URL(
  '../../supabase/migrations/20261018000002_tickets_prioridad_peso.sql',
  import.meta.url,
);
const FECHA_URL = new URL(
  '../../supabase/migrations/20261018000003_fecha_resolucion_reapertura.sql',
  import.meta.url,
);

describe('QA-H3 bandeja ordenada en DB', () => {
  const client = readFileSync(TICKETS_URL, 'utf-8').replace(/^\/\/.*$/gm, '');
  const sql = readFileSync(PESO_URL, 'utf-8');

  it('migración crea prioridad_peso generada espejando PRIORIDAD_PESO', () => {
    expect(sql).toMatch(/add column if not exists prioridad_peso/);
    expect(sql).toMatch(/when 'critica' then 4/);
    expect(sql).toMatch(/when 'alta' then 3/);
    expect(sql).toMatch(/when 'media' then 2/);
    expect(sql).toMatch(/when 'baja' then 1/);
  });

  it('migración indexa la bandeja del técnico', () => {
    expect(sql).toMatch(/idx_tickets_bandeja_tecnico/);
    expect(sql).toMatch(/prioridad_peso desc/);
  });

  it('listAssignedTickets ordena por prioridad_peso antes de .range()', () => {
    const start = client.indexOf('export async function listAssignedTickets');
    expect(start).toBeGreaterThan(-1);
    const body = client.slice(start, client.indexOf('export async function', start + 1));
    const orderIdx = body.indexOf("order('prioridad_peso'");
    const rangeIdx = body.indexOf('.range(from, to)');
    expect(orderIdx).toBeGreaterThan(-1);
    expect(rangeIdx).toBeGreaterThan(-1);
    expect(orderIdx).toBeLessThan(rangeIdx);
  });

  it('sin reorden en memoria tras paginar', () => {
    expect(client).not.toMatch(/Orden prioridad descendente \+ antigüedad ascendente \(memoria/);
  });
});

describe('QA-H4 transición anti-TOCTOU', () => {
  const client = readFileSync(TICKETS_URL, 'utf-8').replace(/^\/\/.*$/gm, '');

  it('update condicional al estado leído', () => {
    expect(client).toMatch(/\.eq\('id', ticketId\)\.eq\('estado', actual\)/);
    expect(client).toMatch(/maybeSingle\(\)/);
  });

  it('0 filas → error “cambió de estado” en vez de éxito silencioso', () => {
    expect(client).toMatch(/cambió de estado mientras lo editabas/);
  });
});

describe('QA-H5 fecha_resolucion al reabrir', () => {
  const sql = readFileSync(FECHA_URL, 'utf-8');

  it('limpia fecha_resolucion al salir de estado resuelto', () => {
    expect(sql).toMatch(/elsif old\.estado in \('solucionado', 'cerrado'\)/);
    expect(sql).toMatch(/new\.fecha_resolucion := null/);
  });

  it('sigue fijando fecha al resolver (primera resolución)', () => {
    expect(sql).toMatch(/if new\.estado in \('solucionado', 'cerrado'\)/);
    expect(sql).toMatch(/new\.fecha_resolucion := now\(\)/);
  });

  it('fija search_path (cierra regresión H-13)', () => {
    expect(sql).toMatch(/set search_path = public/);
  });
});

describe('QA-H6 validarDestinoReasignacion', () => {
  const ok = { id: 't1', rol: 'tecnico', activo: true, mesaId: 2 };

  it('acepta técnico activo de la mesa destino', () => {
    expect(() => validarDestinoReasignacion(ok, 2)).not.toThrow();
  });

  it('rechaza destino inexistente', () => {
    expect(() => validarDestinoReasignacion(null, 2)).toThrow('Técnico no encontrado');
  });

  it('rechaza rol no técnico', () => {
    expect(() => validarDestinoReasignacion({ ...ok, rol: 'usuario' }, 2)).toThrow('rol técnico');
    expect(() => validarDestinoReasignacion({ ...ok, rol: 'jefe' }, 2)).toThrow('rol técnico');
  });

  it('rechaza técnico inactivo', () => {
    expect(() => validarDestinoReasignacion({ ...ok, activo: false }, 2)).toThrow('inactivo');
  });

  it('rechaza técnico de otra mesa', () => {
    expect(() => validarDestinoReasignacion({ ...ok, mesaId: 3 }, 2)).toThrow('no pertenece a la mesa');
  });

  it('reassignTicket consulta el perfil antes de mutar', () => {
    const client = readFileSync(TICKETS_URL, 'utf-8').replace(/^\/\/.*$/gm, '');
    expect(client).toMatch(/from\('profiles'\)\.select\('id,rol,activo,mesa_id'\)/);
    expect(client).toMatch(/validarDestinoReasignacion\(/);
  });
});
