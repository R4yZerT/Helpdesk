// RF-23 — Helpers notificaciones con cliente Supabase mockeado.
import { describe, it, expect, vi } from 'vitest';
import {
  listNotificaciones,
  countNoLeidas,
  marcarLeida,
  marcarTodasLeidas,
  subscribeNotificaciones,
  registerPushToken,
} from './notificaciones.js';

// Builder encadenable thenable: from().select().order().limit().eq() -> await q
function mockQuery(result: { data?: unknown; count?: number | null; error?: { message: string } | null }) {
  const q: Record<string, (...args: unknown[]) => unknown> = {};
  for (const m of ['select', 'order', 'limit', 'eq', 'gte', 'lte', 'in', 'update', 'upsert']) {
    q[m] = () => q;
  }
  (q as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: result.data ?? null, count: result.count ?? null, error: result.error ?? null }).then(resolve);
  return q;
}
const mockClient = (result: { data?: unknown; count?: number | null; error?: { message: string } | null }) =>
  ({ from: () => mockQuery(result) }) as never;

describe('notificaciones lectura', () => {
  it('listNotificaciones retorna data y respeta soloNoLeidas', async () => {
    const rows = [{ id: 1, titulo: 'T1' }];
    const from = vi.fn(() => mockQuery({ data: rows }));
    const list = await listNotificaciones({ from } as never, { limit: 5, soloNoLeidas: true });
    expect(list).toEqual(rows);
    expect(from).toHaveBeenCalledWith('notificaciones');
  });
  it('listNotificaciones lanza con error.message', async () => {
    await expect(listNotificaciones(mockClient({ error: { message: 'boom' } }), {})).rejects.toThrow('boom');
  });
  it('countNoLeidas retorna count (0 si null)', async () => {
    expect(await countNoLeidas(mockClient({ count: 3 }))).toBe(3);
    expect(await countNoLeidas(mockClient({ count: null }))).toBe(0);
    await expect(countNoLeidas(mockClient({ error: { message: 'x' } }))).rejects.toThrow('x');
  });
});

describe('notificaciones escritura', () => {
  it('marcarLeida y marcarTodasLeidas resuelven sin error', async () => {
    await expect(marcarLeida(mockClient({}), 7)).resolves.toBeUndefined();
    await expect(marcarTodasLeidas(mockClient({}))).resolves.toBeUndefined();
  });
  it('marcarLeida propaga error', async () => {
    await expect(marcarLeida(mockClient({ error: { message: 'rls' } }), 7)).rejects.toThrow('rls');
  });
});

describe('notificaciones realtime', () => {
  it('subscribeNotificaciones mapea payload.new y retorna unsubscribe', () => {
    let handler: ((p: { new: Record<string, unknown> }) => void) | null = null;
    const channelMock = { on: (_e: string, _f: unknown, h: typeof handler) => { handler = h; return channelMock; }, subscribe: () => ({}) };
    const removeChannel = vi.fn();
    const client = { channel: () => channelMock, removeChannel } as never;
    const onInsert = vi.fn();
    const unsub = subscribeNotificaciones(client, onInsert);
    handler!({ new: { id: 9, usuario_id: 'u', tipo: 't', titulo: 'x', cuerpo: null, ticket_id: null, leida: false, creado_en: 'hoy' } });
    expect(onInsert).toHaveBeenCalledWith(expect.objectContaining({ id: 9, titulo: 'x' }));
    unsub();
    expect(removeChannel).toHaveBeenCalled();
  });
});

describe('notificaciones push_tokens', () => {
  it('registerPushToken hace upsert con usuario autenticado', async () => {
    const upsert = vi.fn(() => mockQuery({}));
    const client = { auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) }, from: () => ({ upsert }) } as never;
    await expect(registerPushToken(client, 'tok', 'android')).resolves.toBeUndefined();
    expect(upsert).toHaveBeenCalledWith({ usuario_id: 'u1', token: 'tok', plataforma: 'android' }, { onConflict: 'usuario_id,token' });
  });
  it('registerPushToken exige autenticación', async () => {
    const client = { auth: { getUser: async () => ({ data: { user: null } }) } } as never;
    await expect(registerPushToken(client, 'tok', 'ios')).rejects.toThrow('No autenticado');
  });
});
