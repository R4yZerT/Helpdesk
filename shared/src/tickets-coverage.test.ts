// Cobertura de src/tickets.ts — funciones NO cubiertas por tickets.test.ts ni validation.test.ts.
// Patrón fakeClient con from/select/order mockeados con vi.fn. Comentarios en español.
import { describe, expect, it, vi } from 'vitest';
import {
  ADJUNTO_ALLOWED_EXTS,
  ADJUNTO_ALLOWED_MIMES,
  ADJUNTO_MAX_BYTES,
  ADJUNTO_MAX_COUNT,
  PRIORIDAD_PESO,
  addComentario,
  cancelTicket,
  createTicket,
  fetchAdjuntos,
  fetchCategorias,
  fetchMesas,
  fetchTecnicoNombres,
  getTicketDetail,
  isEstadoTicket,
  isPrioridadTicket,
  listAssignedTickets,
  listMyTickets,
  reassignTicket,
  transitionTicket,
  updateTicket,
  validateAdjunto,
  validateAdjuntos,
  validateComentario,
  validateCreateTicket,
  validateUpdateTicket,
  validarDestinoReasignacion,
} from './tickets.js';

// Eslabón encadenable estilo Supabase: cada filtro retorna el mismo objeto y `await` resuelve `result`.
function chainable(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ['eq', 'order', 'range', 'ilike', 'or', 'is', 'not', 'in', 'neq', 'textSearch']) {
    q[m] = vi.fn(() => q);
  }
  q['select'] = vi.fn(() => q);
  q['single'] = vi.fn(async () => result);
  q['maybeSingle'] = vi.fn(async () => result);
  q['then'] = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  return q as never as {
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
    ilike: ReturnType<typeof vi.fn>;
    textSearch: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    not: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: unknown;
  };
}

// Cliente mínimo para selects encadenados (.from().select()... + await).
function selectClient(result: unknown) {
  const q = chainable(result);
  return {
    client: { from: vi.fn(() => ({ select: vi.fn(() => q) })) } as never,
    query: q,
  };
}

// Fila ticket snake_case típica.
function ticketRow(over: Record<string, unknown> = {}) {
  return {
    id: 't-1',
    numero: 7,
    usuario_id: 'u-1',
    mesa_id: 2,
    categoria_id: 3,
    asunto: 'Impresora no responde',
    descripcion: 'La impresora del aula no responde desde ayer',
    prioridad: 'alta',
    estado: 'abierto',
    tecnico_asignado_id: null,
    fecha_resolucion: null,
    solucion_aplicada: null,
    creado_en: '2026-01-01T00:00:00Z',
    actualizado_en: '2026-01-02T00:00:00Z',
    sla_vence_en: null,
    ...over,
  };
}

const baseCreate = {
  categoriaId: 3,
  asunto: 'Equipo no enciende en aula 301',
  descripcion: 'El equipo no enciende desde esta mañana, ya se probó otro toma corriente',
  prioridad: 'media' as const,
  mesaId: 2,
};

describe('isPrioridadTicket / isEstadoTicket', () => {
  it('acepta valores válidos y rechaza otros', () => {
    expect(isPrioridadTicket('alta')).toBe(true);
    expect(isPrioridadTicket('urgente')).toBe(false);
    expect(isEstadoTicket('abierto')).toBe(true);
    expect(isEstadoTicket('programado')).toBe(true);
    expect(isEstadoTicket('inexistente')).toBe(false);
  });
});

describe('validateCreateTicket (bordes no cubiertos)', () => {
  it('asunto >200 y descripcion >5000 fallan', () => {
    expect(validateCreateTicket({ ...baseCreate, asunto: 'x'.repeat(201) }).asunto).toBeDefined();
    expect(validateCreateTicket({ ...baseCreate, descripcion: 'x'.repeat(5001) }).descripcion).toBeDefined();
  });
  it('categoriaId no entero o negativo falla', () => {
    expect(validateCreateTicket({ ...baseCreate, categoriaId: 1.5 }).categoriaId).toBeDefined();
    expect(validateCreateTicket({ ...baseCreate, categoriaId: -2 }).categoriaId).toBeDefined();
  });
  it('mesaId 0 o no entero falla; tecnico null pasa y blancos fallan', () => {
    expect(validateCreateTicket({ ...baseCreate, mesaId: 0 }).mesaId).toBeDefined();
    expect(validateCreateTicket({ ...baseCreate, tecnicoAsignadoId: null }).tecnicoAsignadoId).toBeUndefined();
    expect(
      validateCreateTicket({ ...baseCreate, tecnicoAsignadoId: '   ' }).tecnicoAsignadoId,
    ).toBeDefined();
  });
});

describe('validateComentario', () => {
  it('vacío falla, >2000 falla, válido pasa (con trim)', () => {
    expect(validateComentario('   ')).toBe('Comentario requerido');
    expect(validateComentario('x'.repeat(2001))).toBe('Comentario máximo 2000 caracteres');
    expect(validateComentario('  hola mundo  ')).toBeNull();
  });
});

describe('validateAdjunto / validateAdjuntos', () => {
  it('acepta imagen válida y permite ext sin mime (pickers)', () => {
    expect(validateAdjunto({ name: 'foto.jpg', size: 100, type: 'image/jpeg' })).toBeNull();
    expect(validateAdjunto({ name: 'doc.pdf', size: 100, type: '' })).toBeNull();
  });
  it('rechaza mime+ext desconocidos, exceso de peso y vacío', () => {
    expect(validateAdjunto({ name: 'x.exe', size: 100, type: 'application/x-msdownload' })).toContain('Solo');
    expect(validateAdjunto({ name: 'g.png', size: ADJUNTO_MAX_BYTES + 1, type: 'image/png' })).toContain('Máximo');
    expect(validateAdjunto({ name: 'g.png', size: 0, type: 'image/png' })).toBe('Archivo vacío');
  });
  it('límite exacto pasa; más de 5 archivos falla; prefija nombre del archivo', () => {
    const f = { name: 'g.png', size: ADJUNTO_MAX_BYTES, type: 'image/png' };
    expect(validateAdjunto(f)).toBeNull();
    expect(validateAdjuntos(Array.from({ length: ADJUNTO_MAX_COUNT + 1 }, () => f))).toContain('Máximo');
    const bad = { name: 'mal.exe', size: 10, type: 'application/x-msdownload' };
    expect(validateAdjuntos([f, bad])).toContain('mal.exe');
    expect(validateAdjuntos([f, f])).toBeNull();
  });
  it('constantes de catálogo sanas', () => {
    expect(ADJUNTO_MAX_COUNT).toBe(5);
    expect(ADJUNTO_ALLOWED_MIMES).toContain('image/png');
    expect(ADJUNTO_ALLOWED_EXTS).toContain('.pdf');
  });
});

describe('PRIORIDAD_PESO', () => {
  it('ordena critica > alta > media > baja', () => {
    expect(PRIORIDAD_PESO.critica).toBeGreaterThan(PRIORIDAD_PESO.alta);
    expect(PRIORIDAD_PESO.alta).toBeGreaterThan(PRIORIDAD_PESO.media);
    expect(PRIORIDAD_PESO.media).toBeGreaterThan(PRIORIDAD_PESO.baja);
  });
});

describe('validateUpdateTicket', () => {
  it('cada campo inválido reporta error y patch vacío pasa', () => {
    expect(validateUpdateTicket({}).asunto).toBeUndefined();
    expect(validateUpdateTicket({ asunto: 'abc' }).asunto).toBeDefined();
    expect(validateUpdateTicket({ asunto: 'x'.repeat(201) }).asunto).toBeDefined();
    expect(validateUpdateTicket({ descripcion: 'corta' }).descripcion).toBeDefined();
    expect(validateUpdateTicket({ prioridad: 'urgente' as never }).prioridad).toBeDefined();
    expect(validateUpdateTicket({ categoriaId: 0 }).categoriaId).toBeDefined();
    expect(validateUpdateTicket({ mesaId: -1 }).mesaId).toBeDefined();
    expect(validateUpdateTicket({ asunto: 'Asunto válido amplio' })).toEqual({});
  });
});

describe('validarDestinoReasignacion', () => {
  const ok = { id: 't1', rol: 'tecnico', activo: true, mesaId: 2 };
  it('casos de rechazo puros', () => {
    expect(() => validarDestinoReasignacion(null, 2)).toThrow('no encontrado');
    expect(() => validarDestinoReasignacion({ ...ok, rol: 'jefe' }, 2)).toThrow('rol técnico');
    expect(() => validarDestinoReasignacion({ ...ok, activo: false }, 2)).toThrow('inactivo');
    expect(() => validarDestinoReasignacion({ ...ok, mesaId: 9 }, 2)).toThrow('no pertenece');
  });
  it('destino válido no lanza', () => {
    expect(() => validarDestinoReasignacion(ok, 2)).not.toThrow();
  });
});

describe('fetchCategorias / fetchMesas', () => {
  it('retorna filas y lanza ante error', async () => {
    const { client } = selectClient({ data: [{ id: 1 }], error: null });
    expect(await fetchCategorias(client)).toEqual([{ id: 1 }]);
    const { client: bad } = selectClient({ data: null, error: { message: 'boom' } });
    await expect(fetchCategorias(bad)).rejects.toThrow('boom');
  });
  it('mesas: ok y error', async () => {
    const { client } = selectClient({ data: [{ id: 2, nombre: 'Mesa' }], error: null });
    expect(await fetchMesas(client)).toEqual([{ id: 2, nombre: 'Mesa' }]);
    const { client: bad } = selectClient({ data: null, error: { message: 'falla mesas' } });
    await expect(fetchMesas(bad)).rejects.toThrow('falla mesas');
  });
});

describe('fetchAdjuntos', () => {
  it('mapea columnas canónicas y lanza ante error', async () => {
    const { client } = selectClient({
      data: [{ id: 1, ticket_id: 't1', storage_path: '/p/a.png', nombre_original: 'a.png', mime: 'image/png', tamano_bytes: 10, creado_en: ' hoy ' }],
      error: null,
    });
    const out = await fetchAdjuntos(client, 't1');
    expect(out[0]).toMatchObject({ ticketId: 't1', storagePath: '/p/a.png', nombre: 'a.png', mime: 'image/png', size: 10 });
    const { client: bad } = selectClient({ data: null, error: { message: 'adj err' } });
    await expect(fetchAdjuntos(bad, 't1')).rejects.toThrow('adj err');
  });
});

// Fake para createTicket: auth + catálogo + insert.
function createTicketClient(catSingle: unknown, insertSingle: unknown, userId: string | null = 'u-1', authThrows = false) {
  const insertSingleFn = vi.fn(async () => insertSingle);
  return {
    client: {
      auth: {
        getUser: authThrows ? vi.fn(async () => { throw new Error('off'); }) : vi.fn(async () => ({ data: { user: userId ? { id: userId } : null } })),
      },
      from: vi.fn((table: string) => {
        if (table === 'ticket_categories') {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => catSingle) })) })) };
        }
        if (table === 'tickets') {
          return { insert: vi.fn(() => ({ select: vi.fn(() => ({ single: insertSingleFn })) })) };
        }
        throw new Error('tabla inesperada ' + table);
      }),
    } as never,
    insertSingleFn,
  };
}

describe('createTicket', () => {
  it('rechaza input inválido sin tocar DB', async () => {
    const { client } = createTicketClient({}, {});
    await expect(createTicket(client, { ...baseCreate, asunto: 'x' })).rejects.toThrow();
    expect((client as unknown as { from: unknown }).from).not.toHaveBeenCalled();
  });
  it('resuelve prioridad por subcategoría (Eléctrica → critica)', async () => {
    const inserted: Record<string, unknown>[] = [];
    const { client } = createTicketClient(
      { data: { subcategoria: 'Eléctrica' }, error: null },
      { data: { id: 'nuevo', numero: 42 }, error: null },
    );
    const fromSpy = (client as unknown as { from: unknown }).from as unknown as ReturnType<typeof vi.fn>;
    fromSpy.mockImplementation((table: string) => {
      if (table === 'ticket_categories') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { subcategoria: 'Eléctrica' }, error: null })) })) })) };
      }
      return {
        insert: vi.fn((payload: Record<string, unknown>) => {
          inserted.push(payload);
          return { select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'nuevo', numero: 42 }, error: null })) })) };
        }),
      };
    });
    const out = await createTicket(client, baseCreate);
    expect(out).toEqual({ id: 'nuevo', numero: 42 });
    expect(inserted[0]['prioridad']).toBe('critica');
    expect(inserted[0]['usuario_id']).toBe('u-1');
  });
  it('fallback media si catálogo falla; propaga error de insert y respeta opts', async () => {
    const spyPayload: Record<string, unknown>[] = [];
    const mk = (insertSingle: unknown) => ({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u-9' } } })) },
      from: vi.fn((table: string) => {
        if (table === 'ticket_categories') {
          return { select: vi.fn(() => { throw new Error('sin catálogo'); }) };
        }
        return {
          insert: vi.fn((p: Record<string, unknown>) => {
            spyPayload.push(p);
            return { select: vi.fn(() => ({ single: vi.fn(async () => insertSingle) })) };
          }),
        };
      }),
    }) as never;
    await createTicket(mk({ data: { id: 'a', numero: 1 }, error: null }), {
      ...baseCreate, tecnicoAsignadoId: 'tec-1',
    }, { id: 'fijo' });
    expect(spyPayload[0]['prioridad']).toBe('media');
    expect(spyPayload[0]['tecnico_asignado_id']).toBe('tec-1');
    expect(spyPayload[0]['id']).toBe('fijo');
    await expect(createTicket(mk({ data: null, error: { message: 'insert mal' } }), baseCreate)).rejects.toThrow('insert mal');
  });
});

describe('listMyTickets', () => {
  it('pagina por defecto, mapea ticket y calcula hasMore', async () => {
    const rows = [ticketRow(), ticketRow({ id: 't-2', numero: 8 })];
    const { client, query } = selectClient({ data: rows, error: null, count: 30 });
    const out = await listMyTickets(client, {});
    expect(out.data).toHaveLength(2);
    expect(out.data[0]).toMatchObject({ id: 't-1', numero: 7, usuarioId: 'u-1' });
    expect(out).toMatchObject({ total: 30, hasMore: true, page: 0, pageSize: 20 });
    expect(query.range).toHaveBeenCalledWith(0, 19);
  });
  it('aplica filtros estado/prioridad/ids/tecnico y q numérico vs texto', async () => {
    const { client, query } = selectClient({ data: [], error: null, count: 0 });
    await listMyTickets(client, { estado: 'abierto', prioridad: 'alta', categoriaId: 3, numero: 7, mesaId: 2, tecnicoId: null, page: 1, pageSize: 5 });
    for (const args of [['estado', 'abierto'], ['prioridad', 'alta'], ['categoria_id', 3], ['numero', 7], ['mesa_id', 2]]) {
      expect(query.eq).toHaveBeenCalledWith(args[0], args[1]);
    }
    expect(query.is).toHaveBeenCalledWith('tecnico_asignado_id', null);
    const n2 = selectClient({ data: [], error: null, count: 0 });
    await listMyTickets(n2.client, { q: '#7' });
    expect(n2.query.or).toHaveBeenCalled();
    const n3 = selectClient({ data: [], error: null, count: 0 });
    await listMyTickets(n3.client, { q: 'impresora', tecnicoId: '__assigned' });
    expect(n3.query.textSearch).toHaveBeenCalledWith('search_vector', 'impresora', { type: 'websearch', config: 'spanish' });
    expect(n3.query.not).toHaveBeenCalled();
    const n4 = selectClient({ data: [], error: null, count: 0 });
    await listMyTickets(n4.client, { tecnicoId: 'tec-1' });
    expect(n4.query.eq).toHaveBeenCalledWith('tecnico_asignado_id', 'tec-1');
  });
  it('lanza ante error de query', async () => {
    const { client } = selectClient({ data: null, error: { message: 'list mal' }, count: 0 });
    await expect(listMyTickets(client, {})).rejects.toThrow('list mal');
  });
});

// Fake para addComentario.
function comentarioClient(userId: string | null, insertRes: unknown, authThrows = false) {
  return {
    auth: {
      getUser: authThrows ? vi.fn(async () => { throw new Error('off'); }) : vi.fn(async () => ({ data: { user: userId ? { id: userId } : null } })),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => insertRes) })) })),
    })),
  } as never;
}

describe('addComentario', () => {
  const row = { id: 1, ticket_id: 't1', usuario_id: 'u1', comentario: 'hola', interno: false, creado_en: 'hoy' };
  it('valida ticketId, mensaje y sesión', async () => {
    await expect(addComentario(comentarioClient('u1', {}), '', 'hola')).rejects.toThrow('ticketId');
    await expect(addComentario(comentarioClient('u1', {}), 't1', '   ')).rejects.toThrow('Comentario');
    await expect(addComentario(comentarioClient(null, {}), 't1', 'hola')).rejects.toThrow('Sesión');
  });
  it('éxito mapea comentario; RLS interno vs general', async () => {
    const ok = await addComentario(comentarioClient('u1', { data: row, error: null }), 't1', ' hola ');
    expect(ok).toMatchObject({ ticketId: 't1', comentario: 'hola' });
    await expect(
      addComentario(comentarioClient('u1', { data: null, error: { message: 'row-level security policy' } }), 't1', 'hola', { interno: true }),
    ).rejects.toThrow('Solo técnico');
    await expect(
      addComentario(comentarioClient('u1', { data: null, error: { message: 'policy violation' } }), 't1', 'hola'),
    ).rejects.toThrow('No autorizado');
    await expect(
      addComentario(comentarioClient('u1', { data: null, error: { message: 'otro' } }), 't1', 'hola'),
    ).rejects.toThrow('otro');
  });
});

describe('updateTicket / cancelTicket', () => {
  const row = ticketRow();
  function updateClient(res: unknown) {
    return {
      from: vi.fn(() => ({
        // Eco del payload sobre la fila base para verificar trim/mapeo.
        update: vi.fn((payload: Record<string, unknown>) => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                if (res !== null && typeof res === 'object' && 'data' in (res as Record<string, unknown>)) {
                  const r = res as { data: Record<string, unknown> | null; error: unknown };
                  if (r.data) return { data: { ...ticketRow(), ...r.data, ...payload }, error: null };
                  return r;
                }
                return res;
              }),
            })),
          })),
        })),
      })),
    } as never;
  }
  it('updateTicket valida entrada y exige cambios', async () => {
    const c = updateClient({ data: row, error: null });
    await expect(updateTicket(c, '', { asunto: 'Asunto válido amplio' })).rejects.toThrow('ticketId');
    await expect(updateTicket(c, 't1', { asunto: 'x' })).rejects.toThrow('mínimo');
    await expect(updateTicket(c, 't1', {})).rejects.toThrow('Sin cambios');
  });
  it('updateTicket éxito y mapeo RLS', async () => {
    const c = updateClient({ data: row, error: null });
    const out = await updateTicket(c, 't1', { asunto: '  Nuevo asunto válido  ' });
    expect(out.asunto).toBe('Nuevo asunto válido');
    await expect(updateTicket(updateClient({ data: null, error: { message: 'row-level security' } }), 't1', { asunto: 'Asunto válido x' })).rejects.toThrow('solo abierto');
    await expect(updateTicket(updateClient({ data: null, error: { message: 'otro' } }), 't1', { asunto: 'Asunto válido x' })).rejects.toThrow('otro');
  });
  it('cancelTicket éxito, requerido y RLS', async () => {
    const c = updateClient({ data: { ...row, estado: 'cerrado' }, error: null });
    expect((await cancelTicket(c, 't1')).estado).toBe('cerrado');
    await expect(cancelTicket(c, '')).rejects.toThrow('ticketId');
    await expect(cancelTicket(updateClient({ data: null, error: { message: 'policy denied' } }), 't1')).rejects.toThrow('cancelar');
    await expect(cancelTicket(updateClient({ data: null, error: { message: 'db' } }), 't1')).rejects.toThrow('db');
  });
});

describe('transitionTicket', () => {
  const row = ticketRow({ estado: 'en_proceso' });
  // Fake: lectura de estado actual + update condicional + insert de comentario.
  function transitionClient(actual: string, readError: string | null, updateData: unknown, updateError: string | null) {
    return {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
      from: vi.fn((table: string) => {
        if (table === 'tickets' && (globalThis as Record<string, unknown>)['__phase'] !== 'update') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => (readError ? { data: null, error: { message: readError } } : { data: { estado: actual }, error: null })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => (updateError ? { data: null, error: { message: updateError } } : { data: updateData, error: null })),
                  })),
                })),
              })),
            })),
          };
        }
        return { insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: { message: 'rls' } })) })) })) };
      }),
    } as never;
  }
  it('valida estado y solución requerida', async () => {
    const c = transitionClient('en_proceso', null, row, null);
    await expect(transitionTicket(c, '', 'x' as never)).rejects.toThrow('ticketId');
    await expect(transitionTicket(c, 't1', 'mal' as never)).rejects.toThrow('Estado inválido');
    await expect(transitionTicket(c, 't1', 'solucionado')).rejects.toThrow('requerida');
    await expect(transitionTicket(c, 't1', 'solucionado', { solucionAplicada: 'abc' })).rejects.toThrow('mínimo');
    await expect(transitionTicket(c, 't1', 'solucionado', { solucionAplicada: 'x'.repeat(5001) })).rejects.toThrow('máximo');
    await expect(transitionTicket(c, 't1', 'en_proceso', { solucionAplicada: 'ab' })).rejects.toThrow('mínimo');
  });
  it('rechaza FSM inválida y error de lectura', async () => {
    await expect(transitionTicket(transitionClient('abierto', null, row, null), 't1', 'solucionado', { solucionAplicada: 'Se cambió el fusible' })).rejects.toThrow('no permitida');
    await expect(transitionTicket(transitionClient('x', 'lectura mal', row, null), 't1', 'en_proceso')).rejects.toThrow('lectura mal');
  });
  it('éxito, TOCTOU y error de update', async () => {
    const okRow = ticketRow({ estado: 'solucionado' });
    const ok = await transitionTicket(transitionClient('en_proceso', null, okRow, null), 't1', 'solucionado', { solucionAplicada: 'Se cambió el fusible dañado' });
    expect(ok.estado).toBe('solucionado');
    await expect(transitionTicket(transitionClient('en_proceso', null, null, null), 't1', 'solucionado', { solucionAplicada: 'Se cambió el fusible' })).rejects.toThrow('Recarga');
    await expect(transitionTicket(transitionClient('en_proceso', null, null, 'update mal'), 't1', 'solucionado', { solucionAplicada: 'Se cambió el fusible' })).rejects.toThrow('update mal');
  });
});

describe('reassignTicket', () => {
  const row = ticketRow({ tecnico_asignado_id: 'tec-2' });
  function reassignClient(perfil: unknown, perfilErr: string | null, mesaId: number, ticketErr: string | null, updateRes: unknown) {
    return {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => (perfilErr ? { data: null, error: { message: perfilErr } } : { data: perfil, error: null })) })) })) };
        }
        if (table === 'tickets') {
          const sel = { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => (ticketErr ? { data: null, error: { message: ticketErr } } : { data: { mesa_id: mesaId }, error: null })) })) })) };
          return {
            ...sel,
            update: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => updateRes) })) })) })),
          };
        }
        throw new Error('tabla ' + table);
      }),
    } as never;
  }
  const perfilOk = { id: 'tec-2', rol: 'tecnico', activo: true, mesa_id: 5 };
  it('valida entrada y mesa inválida', async () => {
    const c = reassignClient(perfilOk, null, 5, null, { data: row, error: null });
    await expect(reassignTicket(c, '', { tecnicoId: 'x' })).rejects.toThrow('ticketId');
    await expect(reassignTicket(c, 't1', {})).rejects.toThrow('Nada que reasignar');
    await expect(reassignTicket(c, 't1', { mesaId: -1 })).rejects.toThrow('Mesa inválida');
  });
  it('reasigna técnico validando destino; propaga errores', async () => {
    const out = await reassignTicket(reassignClient(perfilOk, null, 5, null, { data: row, error: null }), 't1', { tecnicoId: 'tec-2' });
    expect(out.tecnicoAsignadoId).toBe('tec-2');
    await expect(reassignTicket(reassignClient(null, null, 5, null, { data: row, error: null }), 't1', { tecnicoId: 'tec-9' })).rejects.toThrow('no encontrado');
    await expect(reassignTicket(reassignClient(perfilOk, 'perfil mal', 5, null, { data: row, error: null }), 't1', { tecnicoId: 'tec-2' })).rejects.toThrow('perfil mal');
    await expect(reassignTicket(reassignClient(perfilOk, null, 5, 'ticket mal', { data: row, error: null }), 't1', { tecnicoId: 'tec-2' })).rejects.toThrow('ticket mal');
    await expect(reassignTicket(reassignClient(perfilOk, null, 5, null, { data: null, error: { message: 'upd mal' } }), 't1', { mesaId: 5 })).rejects.toThrow('upd mal');
  });
});

describe('listAssignedTickets', () => {
  it('filtra por uid, pagina y lanza ante error', async () => {
    const rows = [ticketRow({ tecnico_asignado_id: 'u-tec' })];
    const q = chainable({ data: rows, error: null, count: 1 });
    const client = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u-tec' } } })) },
      from: vi.fn(() => ({ select: vi.fn(() => q) })),
    } as never;
    const out = await listAssignedTickets(client, { estado: 'abierto', prioridad: 'alta', mesaId: 2, q: 'impresora' });
    expect(out.total).toBe(1);
    expect(out.data[0].tecnicoAsignadoId).toBe('u-tec');
    expect(q.eq).toHaveBeenCalledWith('tecnico_asignado_id', 'u-tec');
    expect(q.textSearch).toHaveBeenCalledWith('search_vector', 'impresora', { type: 'websearch', config: 'spanish' });
    const badQ = chainable({ data: null, error: { message: 'asg mal' }, count: 0 });
    const bad = {
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
      from: vi.fn(() => ({ select: vi.fn(() => badQ) })),
    } as never;
    await expect(listAssignedTickets(bad, {})).rejects.toThrow('asg mal');
  });
});

describe('getTicketDetail', () => {
  function detailClient(t: unknown, e: unknown, c: unknown, a: unknown) {
    return {
      from: vi.fn((table: string) => {
        const res = table === 'tickets' ? t : table === 'ticket_estados' ? e : table === 'ticket_comentarios' ? c : a;
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(async () => res), single: vi.fn(async () => res) })) })) };
      }),
    } as never;
  }
  const tRow = ticketRow();
  const eRows = [{ id: 1, ticket_id: 't-1', tipo_evento: 'estado', estado_anterior: null, estado_nuevo: 'abierto', tecnico_de: null, tecnico_para: null, mesa_de: null, mesa_para: null, categoria_de: null, categoria_para: null, usuario_id: 'u1', comentario: null, creado_en: 'hoy' }];
  const cRows = [{ id: 1, ticket_id: 't-1', usuario_id: 'u1', comentario: 'hola', interno: false, creado_en: 'hoy' }];
  const aRows = [{ id: 1, ticket_id: 't-1', storage_path: '/p', nombre_original: 'a.png', mime: 'image/png', tamano_bytes: 5, creado_en: 'hoy' }];
  it('ensambla ticket+estados+comentarios+adjuntos', async () => {
    const out = await getTicketDetail(
      detailClient({ data: tRow, error: null }, { data: eRows, error: null }, { data: cRows, error: null }, { data: aRows, error: null }),
      't-1',
    );
    expect(out.ticket.id).toBe('t-1');
    expect(out.estados).toHaveLength(1);
    expect(out.comentarios[0].comentario).toBe('hola');
    expect(out.adjuntos?.[0].nombre).toBe('a.png');
  });
  it('adjuntos toleran error; ticket/estados/comentarios lanzan; ticketId requerido', async () => {
    const c = detailClient({ data: tRow, error: null }, { data: [], error: null }, { data: [], error: null }, { data: null, error: { message: 'adj x' } });
    expect((await getTicketDetail(c, 't-1')).adjuntos).toEqual([]);
    await expect(getTicketDetail(detailClient({ data: null, error: { message: 't mal' } }, {}, {}, {}), 't-1')).rejects.toThrow('t mal');
    await expect(getTicketDetail(detailClient({ data: null, error: null }, {}, {}, {}), 't-1')).rejects.toThrow('no encontrado');
    await expect(getTicketDetail(detailClient({ data: tRow, error: null }, { data: null, error: { message: 'e mal' } }, {}, {}), 't-1')).rejects.toThrow('e mal');
    await expect(getTicketDetail(detailClient({ data: tRow, error: null }, { data: [], error: null }, { data: null, error: { message: 'c mal' } }, {}), 't-1')).rejects.toThrow('c mal');
    await expect(getTicketDetail(detailClient({}, {}, {}, {}), '')).rejects.toThrow('ticketId');
  });
});

describe('fetchTecnicoNombres', () => {
  it('vacío retorna {} sin llamar; RPC ok mapea', async () => {
    const from = vi.fn();
    const rpc = vi.fn(async () => ({ data: [{ id: 'a', full_name: 'Ana' }], error: null }));
    expect(await fetchTecnicoNombres({ rpc, from } as never, [null, undefined])).toEqual({});
    expect(rpc).not.toHaveBeenCalled();
    expect(await fetchTecnicoNombres({ rpc, from } as never, ['a', 'a'])).toEqual({ a: 'Ana' });
    expect(rpc).toHaveBeenCalledWith('resolve_tecnico_nombres', { p_ids: ['a'] });
  });
  it('fallback a profiles si RPC falla; {} si todo falla', async () => {
    const okFallback = {
      rpc: vi.fn(async () => ({ data: null, error: { message: 'sin rpc' } })),
      from: vi.fn(() => ({ select: vi.fn(() => ({ in: vi.fn(async () => ({ data: [{ id: 'b', full_name: 'Beto' }], error: null })) })) })),
    } as never;
    expect(await fetchTecnicoNombres(okFallback, ['b'])).toEqual({ b: 'Beto' });
    const todoMal = {
      rpc: vi.fn(async () => { throw new Error('rpc off'); }),
      from: vi.fn(() => { throw new Error('db off'); }),
    } as never;
    expect(await fetchTecnicoNombres(todoMal, ['c'])).toEqual({});
    const perfilErr = {
      rpc: vi.fn(async () => ({ data: null, error: { message: 'x' } })),
      from: vi.fn(() => ({ select: vi.fn(() => ({ in: vi.fn(async () => ({ data: null, error: { message: 'y' } })) })) })),
    } as never;
    expect(await fetchTecnicoNombres(perfilErr, ['d'])).toEqual({});
  });
});
