// H10 — bulk: 50 tickets con concurrencia acotada, fallos parciales y validación.
import { describe, expect, it, vi } from 'vitest';
import { ejecutarBulk } from './bulk.js';

const fila = {
  id: 't', numero: 1, usuario_id: 'u', mesa_id: 1, categoria_id: 1,
  asunto: 'Asunto ticket', descripcion: 'Descripcion del ticket', prioridad: 'alta',
  estado: 'abierto', tecnico_asignado_id: null, fecha_resolucion: null,
  solucion_aplicada: null, creado_en: new Date().toISOString(),
  actualizado_en: new Date().toISOString(), sla_vence_en: null,
};

// Mock con latencia programable y conteo de concurrencia máxima observada.
function mockClient(latenciaMs: number, fallaEn: Set<string>) {
  let enVuelo = 0;
  let maxVuelo = 0;
  const single = vi.fn(async () => {
    enVuelo++;
    maxVuelo = Math.max(maxVuelo, enVuelo);
    await new Promise((r) => setTimeout(r, latenciaMs));
    enVuelo--;
    return { data: fila, error: null };
  });
  const q: Record<string, unknown> = {};
  q.update = vi.fn(() => q);
  q.eq = vi.fn(() => q);
  q.select = vi.fn(() => q);
  q.single = single;
  const client = {
    from: vi.fn((tabla: string) => {
      if (tabla === 'tickets') return q;
      throw new Error('tabla inesperada ' + tabla);
    }),
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
  };
  void fallaEn;
  return { client, max: () => maxVuelo };
}

describe('ejecutarBulk prioridad', () => {
  it('50 tickets <10s con concurrencia ≤5', async () => {
    const ids = Array.from({ length: 50 }, (_, i) => `t-${i}`);
    const { client, max } = mockClient(50, new Set());
    const r = await ejecutarBulk(client as never, { ids, operacion: 'prioridad', prioridad: 'alta' });
    expect(r.total).toBe(50);
    expect(r.ok).toBe(50);
    expect(r.fallos).toBe(0);
    expect(r.ms).toBeLessThan(10000);
    expect(max()).toBeLessThanOrEqual(5);
    expect(max()).toBeGreaterThan(1);
  }, 15000);

  it('rechaza lote vacío y >100; lo demás es error por ítem', async () => {
    const { client } = mockClient(0, new Set());
    await expect(ejecutarBulk(client as never, { ids: [], operacion: 'prioridad', prioridad: 'alta' })).rejects.toThrow('al menos un ticket');
    await expect(ejecutarBulk(client as never, { ids: Array.from({ length: 101 }, (_, i) => `t-${i}`), operacion: 'cerrar', solucion: 'solucion valida' })).rejects.toThrow('100');
    const r = await ejecutarBulk(client as never, { ids: ['a'], operacion: 'prioridad', prioridad: 'x' as never });
    expect(r.ok).toBe(0);
    expect(r.items[0].error).toContain('Prioridad inválida');
  });

  it('cerrar exige solución mínima', async () => {
    const { client } = mockClient(0, new Set());
    const r = await ejecutarBulk(client as never, { ids: ['a', 'b'], operacion: 'cerrar', solucion: 'x' });
    expect(r.ok).toBe(0);
    expect(r.fallos).toBe(2);
    expect(r.items[0].error).toContain('5 caracteres');
  });

  it('reasignar sin destino falla por ítem', async () => {
    const { client } = mockClient(0, new Set());
    const r = await ejecutarBulk(client as never, { ids: ['a'], operacion: 'reasignar' });
    expect(r.ok).toBe(0);
    expect(r.items[0].error).toContain('Nada que reasignar');
  });
});
