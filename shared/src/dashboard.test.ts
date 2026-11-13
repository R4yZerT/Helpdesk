// Dashboard queries — paths fallback (sin RPC) con cliente mockeado + RPC cuando existe.
import { describe, it, expect } from 'vitest';
import {
  getKPIs,
  getDashboardSnapshot,
  fetchTicketsFiltrados,
  getStatsPorEstado,
  getStatsPorPrioridad,
  getCargaHoraria,
  listAlertasIA,
  marcarAlertaIA,
  generarAlertasIA,
  getPronosticoSemanal,
  resumirPronosticoML,
} from './dashboard.js';

// Builder encadenable thenable con todos los filtros usados por dashboard.ts
function mockQuery(result: { data?: unknown; count?: number | null; error?: { message: string } | null }) {
  const q: Record<string, (...args: unknown[]) => unknown> = {};
  let start = 0;
  let end = Number.POSITIVE_INFINITY;
  const filters: Array<(row: Record<string, unknown>) => boolean> = [];
  for (const m of ['select', 'order', 'limit', 'update']) {
    q[m] = () => q;
  }
  q.eq = (...args: unknown[]) => { filters.push((row) => row[String(args[0])] === args[1]); return q; };
  q.gte = (...args: unknown[]) => { filters.push((row) => String(row[String(args[0])] ?? '') >= String(args[1])); return q; };
  q.lte = (...args: unknown[]) => { filters.push((row) => String(row[String(args[0])] ?? '') <= String(args[1])); return q; };
  q.in = (...args: unknown[]) => { filters.push((row) => (args[1] as unknown[]).includes(row[String(args[0])])); return q; };
  q.range = (...args: unknown[]) => { start = Number(args[0]); end = Number(args[1]); return q; };
  (q as { then: unknown }).then = (resolve: (v: unknown) => unknown) => {
    const data = Array.isArray(result.data)
      ? result.data.filter((row) => filters.every((filter) => filter(row as Record<string, unknown>))).slice(start, end + 1)
      : result.data ?? null;
    return Promise.resolve({
      data,
      count: result.count ?? null,
      error: result.error ?? null,
    }).then(resolve);
  };
  return q;
}
// Cliente cuyo rpc siempre falla (fuerza fallback cliente) salvo override
function mockClientFallback(tickets: unknown[], opts: { count?: number } = {}) {
  const rpc = async () => { throw new Error('sin rpc'); };
  return { rpc, from: () => mockQuery({ data: tickets, count: opts.count ?? (tickets as unknown[]).length }) } as never;
}

const hoyISO = new Date().toISOString();
const ayerISO = new Date(Date.now() - 86400000).toISOString();

describe('dashboard snapshot agregado', () => {
  it('trae los cinco agregados desde un RPC y aplica todos los filtros', async () => {
    let rpcName = '';
    let rpcArgs: unknown;
    const client = {
      rpc: async (name: string, args: unknown) => {
        rpcName = name;
        rpcArgs = args;
        return {
          data: {
            kpis: { abiertos: 2, total: 4, sla_riesgo: 1, ttr_horas: null, ingresados_hoy: 1 },
            estados: [{ estado: 'abierto', count: 2 }],
            prioridades: [{ prioridad: 'alta', count: 2 }],
            evolucion: [{ dia: '2026-11-13', mesa_id: 3, count: 2 }],
            carga_horaria: [{ dow: 0, hour: 9, count: 4 }],
          },
          error: null,
        };
      },
    } as never;
    const snapshot = await getDashboardSnapshot(client, {
      desde: '2026-11-01T00:00:00Z',
      mesaIds: [3],
      categoriaId: 4,
      estado: 'abierto',
      prioridad: 'alta',
      tecnicoId: 'tech-1',
    });

    expect(rpcName).toBe('dashboard_snapshot_filtrado');
    expect(rpcArgs).toMatchObject({
      p_mesa_ids: [3],
      p_categoria_id: 4,
      p_estado: 'abierto',
      p_prioridad: 'alta',
      p_tecnico_id: 'tech-1',
    });
    expect(snapshot.kpis.ttrHoras).toBeNull();
    expect(snapshot.porEstado).toEqual([{ estado: 'abierto', count: 2 }]);
    expect(snapshot.porPrioridad).toEqual([{ prioridad: 'alta', count: 2 }]);
    expect(snapshot.evolucion).toEqual([{ dia: '2026-11-13', mesaId: 3, count: 2 }]);
    expect(snapshot.carga).toEqual([{ dow: 0, hour: 9, count: 4, nivel: 'media' }]);
  });
});

describe('dashboard getKPIs', () => {
  it('usa RPC agregado filtrado y conserva TTR nulo cuando no hay muestra', async () => {
    let calledWith: unknown[] = [];
    const rpc = async (...args: unknown[]) => {
      calledWith = args;
      return { data: [{ abiertos: 5, total: 9, sla_riesgo: 2, ttr_horas: 3.1, ingresados_hoy: 1, sla_vencidos: 1, sla_por_vencer: 1 }], error: null };
    };
    const k = await getKPIs({ rpc } as never, {
      desde: '2026-11-01T00:00:00Z',
      hasta: '2026-11-10T23:59:59Z',
      mesaIds: [3],
      categoriaId: 4,
      estado: 'cerrado',
      prioridad: 'alta',
      tecnicoId: 'tech-1',
    });
    expect(calledWith).toEqual(['dashboard_kpis_filtrado', {
      p_desde: '2026-11-01T00:00:00Z',
      p_hasta: '2026-11-10T23:59:59Z',
      p_mesa_ids: [3],
      p_categoria_id: 4,
      p_estado: 'cerrado',
      p_prioridad: 'alta',
      p_tecnico_id: 'tech-1',
    }]);
    expect(k).toEqual({ abiertos: 5, total: 9, slaRiesgo: 2, ttrHoras: 3.1, ingresadosHoy: 1, slaVencidos: 1, slaPorVencer: 1 });
  });
  it('no convierte TTR SQL nulo en cero', async () => {
    const rpc = async () => ({ data: [{ abiertos: 0, total: 0, sla_riesgo: 0, ttr_horas: null, ingresados_hoy: 0, sla_vencidos: 0, sla_por_vencer: 0 }], error: null });
    const k = await getKPIs({ rpc } as never, {});
    expect(k.ttrHoras).toBeNull();
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
    expect(k.ttrHoras).toBeNull();
  });
  it('calcula TTR solo con resoluciones disponibles; sin fecha no inventa un valor', async () => {
    const rows = [
      { estado: 'cerrado', creado_en: '2026-01-01T00:00:00Z', fecha_resolucion: '2026-01-01T04:00:00Z' },
      { estado: 'solucionado', creado_en: '2026-01-01T00:00:00Z', fecha_resolucion: '2026-01-01T06:00:00Z' },
    ];
    const kpis = await getKPIs(mockClientFallback(rows), {});
    expect(kpis.ttrHoras).toBe(5);
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
  it('pagina más allá del límite REST y evita RPC que ignora filtros operativos', async () => {
    const rows = Array.from({ length: 1001 }, () => ({ estado: 'cerrado' }));
    let llamadasRpc = 0;
    const client = {
      rpc: async () => { llamadasRpc++; return { data: [], error: null }; },
      from: () => mockQuery({ data: rows }),
    } as never;
    const stats = await getStatsPorEstado(client, { estado: 'cerrado' });
    expect(llamadasRpc).toBe(0);
    expect(stats).toEqual([{ estado: 'cerrado', count: 1001 }]);
  });
});

describe('exportación del dashboard', () => {
  it('pagina el resultado para respetar el límite solicitado por encima del máximo REST', async () => {
    const tickets = Array.from({ length: 1001 }, (_, index) => ({ numero: index + 1 }));
    const result = await fetchTicketsFiltrados(mockClientFallback(tickets), {}, 1500);
    expect(result).toHaveLength(1001);
    expect(result[1000]).toEqual({ numero: 1001 });
  });

  it('respeta los filtros operativos al exportar', async () => {
    const tickets = [
      { numero: 1, estado: 'abierto', prioridad: 'alta', tecnico_asignado_id: 't1' },
      { numero: 2, estado: 'cerrado', prioridad: 'alta', tecnico_asignado_id: 't1' },
      { numero: 3, estado: 'abierto', prioridad: 'baja', tecnico_asignado_id: 't1' },
    ];
    const result = await fetchTicketsFiltrados(
      mockClientFallback(tickets),
      { estado: 'abierto', prioridad: 'alta', tecnicoId: 't1' },
    );
    expect(result.map((ticket) => ticket.numero)).toEqual([1]);
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
  it('mapea filas con lo/hi/generado_en y retorna [] sin datos o con error', async () => {
    const fecha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const ok = { from: () => mockQuery({ data: [{ fecha, serie: 'global', forecast: 12.5, nivel: 'alta', es_pico: true, modelo_version: 'v1', lo: 9.1, hi: 16.2, generado_en: '2026-09-14T06:00:00Z' }] }) } as never;
    expect(await getPronosticoSemanal(ok)).toEqual([{ fecha, serie: 'global', forecast: 12.5, nivel: 'alta', esPico: true, modeloVersion: 'v1', lo: 9.1, hi: 16.2, generadoEn: '2026-09-14T06:00:00Z' }]);
    const legacy = { from: () => mockQuery({ data: [{ fecha, serie: 'global', forecast: 12.5, nivel: 'alta', es_pico: true, modelo_version: 'v1' }] }) } as never;
    expect(await getPronosticoSemanal(legacy)).toEqual([{ fecha, serie: 'global', forecast: 12.5, nivel: 'alta', esPico: true, modeloVersion: 'v1', lo: null, hi: null, generadoEn: null }]);
    const vacio = { from: () => mockQuery({ data: null }) } as never;
    expect(await getPronosticoSemanal(vacio)).toEqual([]);
  });

  it('resumirPronosticoML agrupa por serie: total 7d, picos, peor día y versión', () => {
    const dias = [
      { fecha: '2026-09-16', serie: 'global', forecast: 10, nivel: 'baja', esPico: false, modeloVersion: 'v1' },
      { fecha: '2026-09-17', serie: 'global', forecast: 30, nivel: 'pico', esPico: true, modeloVersion: 'v1' },
      { fecha: '2026-09-16', serie: 'dep', forecast: 5, nivel: 'baja', esPico: false, modeloVersion: 'v1' },
    ];
    const r = resumirPronosticoML(dias);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ serie: 'global', total7d: 40, diasPico: 1, maxForecast: 30, maxFecha: '2026-09-17', modeloVersion: 'v1' });
    expect(r[1].serie).toBe('dep');
    expect(resumirPronosticoML([])).toEqual([]);
  });
});
