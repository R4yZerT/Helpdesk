// Dashboard queries — paths fallback (sin RPC) con cliente mockeado + RPC cuando existe.
import { describe, it, expect } from 'vitest';
import {
  getKPIs,
  getStatsPorEstado,
  getStatsPorPrioridad,
  getCargaHoraria,
  listAlertasIA,
  marcarAlertaIA,
  generarAlertasIA,
  getPronosticoSemanal,
} from './dashboard.js';

// Builder encadenable thenable con todos los filtros usados por dashboard.ts
function mockQuery(result: { data?: unknown; count?: number | null; error?: { message: string } | null }) {
  const q: Record<string, (...args: unknown[]) => unknown> = {};
  for (const m of ['select', 'order', 'limit', 'eq', 'gte', 'lte', 'in', 'update']) {
    q[m] = () => q;
  }
  (q as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: result.data ?? null, count: result.count ?? null, error: result.error ?? null }).then(resolve);
  return q;
}
// Cliente cuyo rpc siempre falla (fuerza fallback cliente) salvo override
function mockClientFallback(tickets: unknown[], opts: { count?: number } = {}) {
  const rpc = async () => { throw new Error('sin rpc'); };
  return { rpc, from: () => mockQuery({ data: tickets, count: opts.count ?? (tickets as unknown[]).length }) } as never;
}

const hoyISO = new Date().toISOString();
const ayerISO = new Date(Date.now() - 86400000).toISOString();

describe('dashboard getKPIs', () => {
  it('usa RPC dashboard_kpis cuando existe', async () => {
    const rpc = async () => ({ data: [{ abiertos: 5, total: 9, sla_riesgo: 2, ttr_horas: 3.1, ingresados_hoy: 1, sla_vencidos: 1, sla_por_vencer: 1 }], error: null });
    const k = await getKPIs({ rpc } as never, {});
    expect(k).toEqual({ abiertos: 5, total: 9, slaRiesgo: 2, ttrHoras: 3.1, ingresadosHoy: 1, slaVencidos: 1, slaPorVencer: 1 });
  });
  it('fallback cliente agrega abiertos/SLA/hoy', async () => {
    const rows = [
      { id: '1', estado: 'abierto', prioridad: 'critica', creado_en: hoyISO, sla_vence_en: new Date(Date.now() - 1000).toISOString() }, // vencido
      { id: '2', estado: 'en_proceso', prioridad: 'media', creado_en: hoyISO, sla_vence_en: new Date(Date.now() + 3600000).toISOString() }, // vigente (24h)
      { id: '3', estado: 'cerrado', prioridad: 'alta', creado_en: ayerISO, sla_vence_en: ayerISO }, // cerrado: no cuenta SLA
    ];
    const k = await getKPIs(mockClientFallback(rows), {});
    expect(k.total).toBe(3);
    expect(k.abiertos).toBe(2);
    expect(k.ingresadosHoy).toBe(2);
    expect(k.slaVencidos).toBe(1);
    expect(k.slaRiesgo).toBe(k.slaVencidos! + k.slaPorVencer!);
  });
  it('fallback propaga error de tickets', async () => {
    const client = { rpc: async () => { throw new Error('x'); }, from: () => mockQuery({ error: { message: 'db caida' } }) } as never;
    await expect(getKPIs(client, {})).rejects.toThrow('db caida');
  });
});

describe('dashboard stats', () => {
  it('getStatsPorEstado agrupa por estado (fallback)', async () => {
    const s = await getStatsPorEstado(mockClientFallback([
      { estado: 'abierto' }, { estado: 'abierto' }, { estado: 'cerrado' },
    ]), {});
    expect(s).toContainEqual({ estado: 'abierto', count: 2 });
    expect(s).toContainEqual({ estado: 'cerrado', count: 1 });
  });
  it('getStatsPorPrioridad usa RPC cuando existe', async () => {
    const rpc = async () => ({ data: [{ prioridad: 'alta', cnt: 4 }], error: null });
    const s = await getStatsPorPrioridad({ rpc } as never, {});
    expect(s).toEqual([{ prioridad: 'alta', count: 4 }]);
  });
  it('getStatsPorPrioridad agrupa por prioridad (fallback)', async () => {
    const s = await getStatsPorPrioridad(mockClientFallback([{ prioridad: 'media' }, { prioridad: 'critica' }]), {});
    expect(s).toContainEqual({ prioridad: 'media', count: 1 });
  });
});

describe('dashboard carga horaria', () => {
  it('retorna grilla 5x15 con niveles y cuenta fechas locales', async () => {
    // Lunes 10:00 hora local x4 -> dow 0, hour 10, count 4, nivel media
    const lunes10 = new Date(2026, 0, 5, 10, 0, 0).toISOString();
    const c = await getCargaHoraria(mockClientFallback([
      { creado_en: lunes10 }, { creado_en: lunes10 }, { creado_en: lunes10 }, { creado_en: lunes10 },
    ]), {});
    expect(c).toHaveLength(75); // 5 días x 15 horas
    const celda = c.find((x) => x.dow === 0 && x.hour === 10)!;
    expect(celda.count).toBe(4);
    expect(celda.nivel).toBe('media');
    for (const x of c) {
      expect(x.dow).toBeGreaterThanOrEqual(0); expect(x.dow).toBeLessThanOrEqual(4);
      expect(x.hour).toBeGreaterThanOrEqual(7); expect(x.hour).toBeLessThanOrEqual(21);
      expect(['baja', 'media', 'alta', 'pico']).toContain(x.nivel);
    }
  });
});

describe('dashboard alertas IA', () => {
  it('listAlertasIA mapea columnas snake->camel', async () => {
    const rows = [{ id: 1, tipo: 'pico', mensaje: 'm', severidad: 'alta', estado: 'nueva', creado_en: 'c', mesa_id: 2 }];
    const list = await listAlertasIA(mockClientFallback(rows), { estado: 'nueva' });
    expect(list).toEqual([{ id: 1, tipo: 'pico', mensaje: 'm', severidad: 'alta', estado: 'nueva', creadoEn: 'c', mesaId: 2 }]);
  });
  it('listAlertasIA retorna [] ante bloqueo RLS y lanza ante otro error', async () => {
    const rls = { rpc: async () => { throw new Error('x'); }, from: () => mockQuery({ error: { message: 'row-level security policy' } }) } as never;
    expect(await listAlertasIA(rls, {})).toEqual([]);
    const otro = { rpc: async () => { throw new Error('x'); }, from: () => mockQuery({ error: { message: 'timeout' } }) } as never;
    await expect(listAlertasIA(otro, {})).rejects.toThrow('timeout');
  });
  it('marcarAlertaIA resuelve y propaga error', async () => {
    await expect(marcarAlertaIA(mockClientFallback([]), 1, 'resuelta')).resolves.toBeUndefined();
    const malo = { from: () => mockQuery({ error: { message: 'nope' } }) } as never;
    await expect(marcarAlertaIA(malo, 1, 'vista')).rejects.toThrow('nope');
  });
  it('generarAlertasIA acepta objeto o arreglo', async () => {
    expect(await generarAlertasIA({ rpc: async () => ({ data: { insertados: 2 }, error: null }) } as never)).toBe(2);
    expect(await generarAlertasIA({ rpc: async () => ({ data: [{ insertados: 3 }], error: null }) } as never)).toBe(3);
    await expect(generarAlertasIA({ rpc: async () => ({ data: null, error: { message: 'f' } }) } as never)).rejects.toThrow('f');
  });
});

describe('dashboard pronóstico semanal', () => {
  it('mapea filas y retorna [] sin datos o con error', async () => {
    const ok = { from: () => mockQuery({ data: [{ fecha: '2026-09-20', serie: 'global', forecast: 12.5, nivel: 'alta', es_pico: true, modelo_version: 'v1' }] }) } as never;
    expect(await getPronosticoSemanal(ok)).toEqual([{ fecha: '2026-09-20', serie: 'global', forecast: 12.5, nivel: 'alta', esPico: true, modeloVersion: 'v1' }]);
    const vacio = { from: () => mockQuery({ data: null }) } as never;
    expect(await getPronosticoSemanal(vacio)).toEqual([]);
  });
});
