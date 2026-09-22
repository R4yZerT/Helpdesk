// Cobertura para src/mesas.ts y src/categorias.ts (funciones async no cubiertas).
// Usa mocks de cliente Supabase con vi.fn (patrón fakeClient chainable + thenable).
import { describe, expect, it, vi } from 'vitest';
import {
  asignarTecnicoAMesa,
  createMesa,
  getMesaById,
  listMesasPaginated,
  listTecnicosPorMesa,
  setMesaActiva,
  updateMesa,
  validateUpdateMesa,
} from './mesas.js';
import {
  createCategoria,
  getCategoriaById,
  isCreateCategoriaValid,
  isDominioCategoria,
  isUpdateCategoriaValid,
  listCategoriasPaginated,
  setCategoriaActiva,
  updateCategoria,
  validateCreateCategoria,
  validateUpdateCategoria,
} from './categorias.js';

// Crea un query-builder encadenable: ilike/eq/order/select devuelven el builder,
// range/single devuelven promesa, y el builder es thenable para `await q`.
function makeBuilder(result: { data: unknown; error: unknown; count?: number }) {
  const b: Record<string, unknown> = {};
  b.ilike = vi.fn(() => b);
  b.eq = vi.fn(() => b);
  b.order = vi.fn(() => b);
  b.range = vi.fn(() => Promise.resolve(result));
  b.select = vi.fn(() => b);
  b.single = vi.fn(() => Promise.resolve(result));
  b.insert = vi.fn(() => b);
  b.update = vi.fn(() => b);
  b.then = (res: unknown, rej: unknown) =>
    Promise.resolve(result).then(res as never, rej as never);
  return b as never;
}

// Cliente falso: from() expone select/insert/update que devuelven el builder.
// Los spies de insert/update viven en `client.__api` (no en el builder).
function fakeClient(builder: never) {
  const b = builder as unknown as Record<string, (...a: never[]) => unknown>;
  const api = {
    select: vi.fn(() => b),
    insert: vi.fn(() => b),
    update: vi.fn(() => b),
  };
  return {
    from: vi.fn(() => api),
    __api: api,
  } as never;
}

type ApiCalls = { __api: { insert: { mock: { calls: unknown[][] } }; update: { mock: { calls: unknown[][] } } } };

describe('mesas: listMesasPaginated', () => {
  it('retorna data y count con paginación por defecto (0-19)', async () => {
    const rows = [{ id: 1, nombre: 'Mesa A', activa: true }];
    const builder = makeBuilder({ data: rows, error: null, count: 1 });
    const client = fakeClient(builder);
    const out = await listMesasPaginated(client as never);
    expect(out).toEqual({ data: rows, count: 1 });
    const b = builder as unknown as Record<string, { mock: { calls: unknown[][] } } & ((...a: never[]) => unknown)>;
    // Rango por defecto page=1 pageSize=20
    expect((b.range as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]).toEqual([0, 19]);
  });

  it('aplica filtros search/activa/secretariaId y página 2', async () => {
    const builder = makeBuilder({ data: [], error: null, count: 0 });
    const client = fakeClient(builder);
    await listMesasPaginated(client as never, { search: '  tic ', activa: false, secretariaId: 5, page: 2, pageSize: 10 });
    const b = builder as unknown as Record<string, { mock: { calls: unknown[][] } }>;
    const ilikeCalls = b.ilike.mock.calls.flat().join(' ');
    expect(ilikeCalls).toContain('tic');
    // eq llamado para activa y secretariaId
    expect(b.eq.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect((b.range as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]).toEqual([10, 19]);
  });

  it('usa fallback de count cuando es null y [] cuando data es null', async () => {
    const builder = makeBuilder({ data: null, error: null, count: null });
    const out = await listMesasPaginated(fakeClient(builder) as never);
    expect(out).toEqual({ data: [], count: 0 });
  });

  it('lanza el error de supabase', async () => {
    const builder = makeBuilder({ data: null, error: { message: 'boom' }, count: 0 });
    await expect(listMesasPaginated(fakeClient(builder) as never)).rejects.toEqual({ message: 'boom' });
  });
});

describe('mesas: getMesaById', () => {
  it('retorna la mesa', async () => {
    const row = { id: 2, nombre: 'Mesa B', activa: true };
    const out = await getMesaById(fakeClient(makeBuilder({ data: row, error: null })) as never, 2);
    expect(out).toEqual(row);
  });

  it('retorna null ante PGRST116', async () => {
    const out = await getMesaById(
      fakeClient(makeBuilder({ data: null, error: { code: 'PGRST116' } })) as never,
      99,
    );
    expect(out).toBeNull();
  });

  it('relanza otros errores', async () => {
    await expect(
      getMesaById(fakeClient(makeBuilder({ data: null, error: { message: 'db' } })) as never, 1),
    ).rejects.toEqual({ message: 'db' });
  });
});

describe('mesas: createMesa', () => {
  it('crea con nombre recortado', async () => {
    const row = { id: 1, nombre: 'TIC', activa: true };
    const builder = makeBuilder({ data: row, error: null });
    const client = fakeClient(builder);
    const out = await createMesa(client as never, { nombre: '  TIC  ' });
    expect(out).toEqual(row);
    expect((client as unknown as ApiCalls).__api.insert.mock.calls[0][0]).toEqual({ nombre: 'TIC' });
  });

  it('falla validación con nombre corto', async () => {
    await expect(createMesa(fakeClient(makeBuilder({ data: null, error: null })) as never, { nombre: 'ab' })).rejects.toThrow(
      /Validación/,
    );
  });

  it('traduce duplicado por código 23505', async () => {
    const builder = makeBuilder({ data: null, error: { code: '23505', message: 'x' } });
    await expect(createMesa(fakeClient(builder) as never, { nombre: 'Mesa X' })).rejects.toThrow(
      'Ya existe una mesa con ese nombre',
    );
  });

  it('traduce duplicado por mensaje unique', async () => {
    const builder = makeBuilder({ data: null, error: { code: '00000', message: 'duplicate key value' } });
    await expect(createMesa(fakeClient(builder) as never, { nombre: 'Mesa X' })).rejects.toThrow(
      'Ya existe una mesa con ese nombre',
    );
  });

  it('relanza error no duplicado', async () => {
    const builder = makeBuilder({ data: null, error: { code: 'XX', message: 'otro' } });
    await expect(createMesa(fakeClient(builder) as never, { nombre: 'Mesa X' })).rejects.toEqual({
      code: 'XX',
      message: 'otro',
    });
  });
});

describe('mesas: updateMesa / setMesaActiva', () => {
  it('actualiza nombre y activa con trim', async () => {
    const row = { id: 1, nombre: 'Nuevo', activa: false };
    const builder = makeBuilder({ data: row, error: null });
    const client = fakeClient(builder);
    const out = await updateMesa(client as never, 1, { nombre: '  Nuevo  ', activa: false });
    expect(out).toEqual(row);
    expect((client as unknown as ApiCalls).__api.update.mock.calls[0][0]).toEqual({ nombre: 'Nuevo', activa: false });
  });

  it('lanza Sin cambios con patch vacío', async () => {
    await expect(updateMesa(fakeClient(makeBuilder({ data: null, error: null })) as never, 1, {})).rejects.toThrow(
      'Sin cambios',
    );
  });

  it('falla validación con nombre largo', async () => {
    expect(validateUpdateMesa({ nombre: 'a'.repeat(61) }).nombre).toBeDefined();
    await expect(
      updateMesa(fakeClient(makeBuilder({ data: null, error: null })) as never, 1, { nombre: 'ab' }),
    ).rejects.toThrow(/Validación/);
  });

  it('traduce duplicado en update', async () => {
    const builder = makeBuilder({ data: null, error: { code: '23505', message: 'dup' } });
    await expect(updateMesa(fakeClient(builder) as never, 1, { nombre: 'Otro' })).rejects.toThrow(
      'Ya existe una mesa con ese nombre',
    );
  });

  it('relanza error no duplicado en update', async () => {
    const builder = makeBuilder({ data: null, error: { code: 'XX', message: 'falla' } });
    await expect(updateMesa(fakeClient(builder) as never, 1, { activa: true })).rejects.toEqual({
      code: 'XX',
      message: 'falla',
    });
  });

  it('setMesaActiva delega con { activa }', async () => {
    const row = { id: 3, nombre: 'M', activa: false };
    const builder = makeBuilder({ data: row, error: null });
    const client = fakeClient(builder);
    const out = await setMesaActiva(client as never, 3, false);
    expect(out).toEqual(row);
    expect((client as unknown as ApiCalls).__api.update.mock.calls[0][0]).toEqual({ activa: false });
  });
});

describe('mesas: técnicos', () => {
  it('listTecnicosPorMesa mapea snake_case y email null a ""', async () => {
    const rows = [{ id: 'u1', full_name: 'Ana', email: null, activo: true, mesa_id: 2 }];
    const out = await listTecnicosPorMesa(fakeClient(makeBuilder({ data: rows, error: null })) as never, 2);
    expect(out).toEqual([{ id: 'u1', fullName: 'Ana', email: '', activo: true, mesaId: 2 }]);
  });

  it('listTecnicosPorMesa retorna [] con data null y lanza ante error', async () => {
    expect(await listTecnicosPorMesa(fakeClient(makeBuilder({ data: null, error: null })) as never, 1)).toEqual([]);
    await expect(
      listTecnicosPorMesa(fakeClient(makeBuilder({ data: null, error: { message: 'e' } })) as never, 1),
    ).rejects.toEqual({ message: 'e' });
  });

  it('asignarTecnicoAMesa ok con mesaId y con null', async () => {
    await expect(
      asignarTecnicoAMesa(fakeClient(makeBuilder({ data: null, error: null })) as never, 'u1', 4),
    ).resolves.toBeUndefined();
    await expect(
      asignarTecnicoAMesa(fakeClient(makeBuilder({ data: null, error: null })) as never, 'u1', null),
    ).resolves.toBeUndefined();
  });

  it('asignarTecnicoAMesa rechaza mesa inválida', async () => {
    const client = fakeClient(makeBuilder({ data: null, error: null })) as never;
    await expect(asignarTecnicoAMesa(client, 'u1', 0)).rejects.toThrow('Mesa inválida');
    await expect(asignarTecnicoAMesa(client, 'u1', -2)).rejects.toThrow('Mesa inválida');
    await expect(asignarTecnicoAMesa(client, 'u1', 1.5)).rejects.toThrow('Mesa inválida');
  });

  it('asignarTecnicoAMesa relanza error', async () => {
    const client = fakeClient(makeBuilder({ data: null, error: { message: 'rls' } })) as never;
    await expect(asignarTecnicoAMesa(client, 'u1', 2)).rejects.toEqual({ message: 'rls' });
  });
});

describe('categorias: validación pura', () => {
  it('isDominioCategoria distingue válidos', () => {
    expect(isDominioCategoria('tic')).toBe(true);
    expect(isDominioCategoria('general')).toBe(true);
    expect(isDominioCategoria('foo')).toBe(false);
  });

  it('isCreate/isUpdate valid', () => {
    expect(isCreateCategoriaValid({ dominio: 'tic', subcategoria: 'Redes' })).toBe(true);
    expect(isCreateCategoriaValid({ dominio: 'tic', subcategoria: 'ab' })).toBe(false);
    expect(isUpdateCategoriaValid({})).toBe(true);
    expect(isUpdateCategoriaValid({ dominio: 'bad' as never })).toBe(false);
  });

  it('create: orden fuera de rango y no entero', () => {
    expect(validateCreateCategoria({ dominio: 'tic', subcategoria: 'Redes', orden: 1001 }).orden).toBeDefined();
    expect(validateCreateCategoria({ dominio: 'tic', subcategoria: 'Redes', orden: 1.5 }).orden).toBeDefined();
    expect(validateCreateCategoria({ dominio: 'tic', subcategoria: '  Redes  ' })).toEqual({});
  });

  it('update: sub corta/larga y orden inválido', () => {
    expect(validateUpdateCategoria({ subcategoria: 'ab' }).subcategoria).toBeDefined();
    expect(validateUpdateCategoria({ subcategoria: 'a'.repeat(81) }).subcategoria).toBeDefined();
    expect(validateUpdateCategoria({ orden: -1 }).orden).toBeDefined();
    expect(validateUpdateCategoria({ dominio: 'tic', subcategoria: '  Ok trim  ', orden: 5, activa: true })).toEqual({});
  });
});

describe('categorias: listCategoriasPaginated', () => {
  it('retorna data y count por defecto', async () => {
    const rows = [{ id: 1, dominio: 'tic', subcategoria: 'Redes', orden: 0, activa: true }];
    const builder = makeBuilder({ data: rows, error: null, count: 1 });
    const out = await listCategoriasPaginated(fakeClient(builder) as never);
    expect(out).toEqual({ data: rows, count: 1 });
    const b = builder as unknown as { range: { mock: { calls: unknown[][] } } };
    expect(b.range.mock.calls[0]).toEqual([0, 19]);
  });

  it('aplica search/dominio/activa y omite dominio=todos', async () => {
    const builder = makeBuilder({ data: [], error: null, count: 0 });
    await listCategoriasPaginated(fakeClient(builder) as never, {
      search: ' red ',
      dominio: 'tic',
      activa: true,
      page: 3,
      pageSize: 5,
    });
    const b = builder as unknown as Record<string, { mock: { calls: unknown[][] } }>;
    expect(b.ilike.mock.calls.flat().join(' ')).toContain('red');
    expect(b.eq.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(b.range.mock.calls[0]).toEqual([10, 14]);
  });

  it('no filtra dominio cuando es todos', async () => {
    const builder = makeBuilder({ data: [], error: null, count: 0 });
    await listCategoriasPaginated(fakeClient(builder) as never, { dominio: 'todos' });
    const b = builder as unknown as { eq: { mock: { calls: unknown[][] } } };
    expect(b.eq.mock.calls).toEqual([]);
  });

  it('fallback count y lanza error', async () => {
    const out = await listCategoriasPaginated(
      fakeClient(makeBuilder({ data: [{ id: 1 }], error: null, count: null })) as never,
    );
    expect(out.count).toBe(1);
    await expect(
      listCategoriasPaginated(fakeClient(makeBuilder({ data: null, error: { message: 'x' } })) as never),
    ).rejects.toEqual({ message: 'x' });
  });
});

describe('categorias: getCategoriaById', () => {
  it('retorna fila, null ante PGRST116 y relanza otros', async () => {
    const row = { id: 1, dominio: 'tic', subcategoria: 'Redes', orden: 0, activa: true };
    expect(await getCategoriaById(fakeClient(makeBuilder({ data: row, error: null })) as never, 1)).toEqual(row);
    expect(
      await getCategoriaById(fakeClient(makeBuilder({ data: null, error: { code: 'PGRST116' } })) as never, 9),
    ).toBeNull();
    await expect(
      getCategoriaById(fakeClient(makeBuilder({ data: null, error: { message: 'db' } })) as never, 1),
    ).rejects.toEqual({ message: 'db' });
  });
});

describe('categorias: createCategoria', () => {
  it('crea con trim y orden por defecto 0', async () => {
    const row = { id: 1, dominio: 'tic', subcategoria: 'Redes', orden: 0, activa: true };
    const builder = makeBuilder({ data: row, error: null });
    const client = fakeClient(builder);
    const out = await createCategoria(client as never, { dominio: 'tic', subcategoria: '  Redes  ' });
    expect(out).toEqual(row);
    expect((client as unknown as ApiCalls).__api.insert.mock.calls[0][0]).toEqual({ dominio: 'tic', subcategoria: 'Redes', orden: 0 });
  });

  it('falla validación', async () => {
    await expect(
      createCategoria(fakeClient(makeBuilder({ data: null, error: null })) as never, {
        dominio: 'tic',
        subcategoria: 'ab',
      }),
    ).rejects.toThrow(/Validación/);
  });

  it('traduce duplicado por código y por mensaje, relanza otros', async () => {
    await expect(
      createCategoria(
        fakeClient(makeBuilder({ data: null, error: { code: '23505', message: 'x' } })) as never,
        { dominio: 'tic', subcategoria: 'Redes' },
      ),
    ).rejects.toThrow('Ya existe esa categoría en el dominio');
    await expect(
      createCategoria(
        fakeClient(makeBuilder({ data: null, error: { code: '0', message: 'Unique violation' } })) as never,
        { dominio: 'tic', subcategoria: 'Redes' },
      ),
    ).rejects.toThrow('Ya existe esa categoría en el dominio');
    await expect(
      createCategoria(fakeClient(makeBuilder({ data: null, error: { message: 'otro' } })) as never, {
        dominio: 'tic',
        subcategoria: 'Redes',
      }),
    ).rejects.toEqual({ message: 'otro' });
  });
});

describe('categorias: updateCategoria / setCategoriaActiva', () => {
  it('arma payload con trim', async () => {
    const row = { id: 1, dominio: 'tic', subcategoria: 'Nuevo', orden: 3, activa: false };
    const builder = makeBuilder({ data: row, error: null });
    const client = fakeClient(builder);
    const out = await updateCategoria(client as never, 1, {
      subcategoria: '  Nuevo  ',
      orden: 3,
      activa: false,
      dominio: 'tic',
    });
    expect(out).toEqual(row);
    expect((client as unknown as ApiCalls).__api.update.mock.calls[0][0]).toEqual({ dominio: 'tic', subcategoria: 'Nuevo', orden: 3, activa: false });
  });

  it('lanza Sin cambios y falla validación', async () => {
    await expect(
      updateCategoria(fakeClient(makeBuilder({ data: null, error: null })) as never, 1, {}),
    ).rejects.toThrow('Sin cambios');
    await expect(
      updateCategoria(fakeClient(makeBuilder({ data: null, error: null })) as never, 1, { orden: -5 }),
    ).rejects.toThrow(/Validación/);
  });

  it('traduce duplicado y relanza otros', async () => {
    await expect(
      updateCategoria(
        fakeClient(makeBuilder({ data: null, error: { code: '23505', message: 'x' } })) as never,
        1,
        { subcategoria: 'Redes' },
      ),
    ).rejects.toThrow('Ya existe esa categoría en el dominio');
    await expect(
      updateCategoria(fakeClient(makeBuilder({ data: null, error: { message: 'falla' } })) as never, 1, {
        activa: true,
      }),
    ).rejects.toEqual({ message: 'falla' });
  });

  it('setCategoriaActiva delega', async () => {
    const row = { id: 2, dominio: 'tic', subcategoria: 'R', orden: 0, activa: false };
    const builder = makeBuilder({ data: row, error: null });
    const client = fakeClient(builder);
    expect(await setCategoriaActiva(client as never, 2, false)).toEqual(row);
    expect((client as unknown as ApiCalls).__api.update.mock.calls[0][0]).toEqual({ activa: false });
  });
});
