// H9 — Búsqueda full-text español con fallback a ILIKE.
import { describe, expect, it, vi } from 'vitest';
import { listAssignedTickets, listMyTickets } from './tickets.js';

// Builder thenable que registra llamadas y resuelve lo programado.
function mockQuery(resueltas: { data?: any[]; error?: any; count?: number }) {
  const llamadas: Record<string, any[]> = {};
  const q: any = {
    eq: vi.fn((...a: any[]) => (llamadas.eq = a, q)),
    ilike: vi.fn((...a: any[]) => (llamadas.ilike = a, q)),
    or: vi.fn((...a: any[]) => (llamadas.or = a, q)),
    textSearch: vi.fn((...a: any[]) => (llamadas.textSearch = a, q)),
    order: vi.fn(() => q),
    range: vi.fn(() => q),
    is: vi.fn(() => q),
    not: vi.fn(() => q),
    select: vi.fn(() => q),
    then: (res: any, rej: any) => Promise.resolve({
      data: resueltas.data ?? [],
      error: resueltas.error ?? null,
      count: resueltas.count ?? 0,
    }).then(res, rej),
  };
  return { q, llamadas };
}

function mockClient(resueltas: { data?: any[]; error?: any; count?: number }, extra: any = {}) {
  const { q, llamadas } = mockQuery(resueltas);
  const client: any = {
    from: vi.fn(() => q),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
    ...extra,
  };
  return { client, llamadas };
}

const fila = {
  id: 't1', numero: 7, usuario_id: 'u1', mesa_id: 1, categoria_id: 2,
  asunto: 'Wifi caído', descripcion: 'Se cae cada 10 min', prioridad: 'alta',
  estado: 'abierto', tecnico_asignado_id: null, fecha_resolucion: null,
  solucion_aplicada: null, creado_en: new Date().toISOString(),
  actualizado_en: new Date().toISOString(), sla_vence_en: null,
};

describe('listMyTickets con full-text', () => {
  it('usa textSearch español ante q de texto', async () => {
    const { client, llamadas } = mockClient({ data: [fila], count: 1 });
    const r = await listMyTickets(client, { q: 'wifi caido', page: 0, pageSize: 20 });
    expect(llamadas.textSearch[0]).toBe('search_vector');
    expect(llamadas.textSearch[1]).toBe('wifi caido');
    expect(llamadas.textSearch[2]).toMatchObject({ type: 'websearch', config: 'spanish' });
    expect(r.data).toHaveLength(1);
  });

  it('cae a ILIKE si la columna search_vector aún no existe', async () => {
    const { q } = mockQuery({ data: [], error: null, count: 0 });
    // Primera resolución (textSearch) falla por columna ausente; segunda (ilike) ok
    let n = 0;
    q.then = (res: any, rej: any) => {
      n += 1;
      if (n === 1) return Promise.resolve({ data: null, error: { message: 'column "search_vector" does not exist' }, count: null }).then(res, rej);
      return Promise.resolve({ data: [fila], error: null, count: 1 }).then(res, rej);
    };
    const client: any = { from: vi.fn(() => q) };
    const r = await listMyTickets(client, { q: 'impresora', page: 0, pageSize: 20 });
    expect(q.ilike).toHaveBeenCalledWith('asunto', '%impresora%');
    expect(r.data).toHaveLength(1);
  });

  it('q numérico mantiene búsqueda por número sin textSearch', async () => {
    const { client, llamadas } = mockClient({ data: [fila], count: 1 });
    await listMyTickets(client, { q: '#7', page: 0, pageSize: 20 });
    expect(llamadas.or[0]).toContain('numero.eq.7');
    expect(llamadas.textSearch).toBeUndefined();
  });

  it('avisa vía onFallbackFulltext al caer a ILIKE', async () => {
    const { q } = mockQuery({ data: [], error: null, count: 0 });
    let n = 0;
    q.then = (res: any, rej: any) => {
      n += 1;
      if (n === 1) return Promise.resolve({ data: null, error: { message: 'column "search_vector" does not exist' }, count: null }).then(res, rej);
      return Promise.resolve({ data: [fila], error: null, count: 1 }).then(res, rej);
    };
    const client: any = { from: vi.fn(() => q) };
    const avisos: { consulta: string; motivo: string }[] = [];
    await listMyTickets(client, { q: 'impresora', onFallbackFulltext: (i) => avisos.push(i) });
    expect(avisos).toHaveLength(1);
    expect(avisos[0].consulta).toBe('impresora');
    expect(avisos[0].motivo).toContain('search_vector');
  });
});

describe('listAssignedTickets con full-text', () => {
  it('usa textSearch y cae a ILIKE ante error de columna', async () => {
    const { q } = mockQuery({ data: [], error: null, count: 0 });
    let n = 0;
    q.then = (res: any, rej: any) => {
      n += 1;
      if (n === 1) return Promise.resolve({ data: null, error: { message: 'search_vector missing' }, count: null }).then(res, rej);
      return Promise.resolve({ data: [fila], error: null, count: 1 }).then(res, rej);
    };
    const client: any = {
      from: vi.fn(() => q),
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
    };
    const r = await listAssignedTickets(client, { q: 'wifi', page: 0, pageSize: 20 });
    expect(q.textSearch).toHaveBeenCalledWith('search_vector', 'wifi', { type: 'websearch', config: 'spanish' });
    expect(q.ilike).toHaveBeenCalledWith('asunto', '%wifi%');
    expect(r.data).toHaveLength(1);
  });
});
