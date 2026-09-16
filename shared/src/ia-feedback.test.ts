import { describe, expect, it, vi } from 'vitest';
import {
  corregirClasificacion,
  confirmarClasificacion,
  esAptoEntrenamiento,
  registrarSugerenciaIa,
  type TicketIaFeedback,
} from './ia-feedback.js';

function clienteMock(handlers: Record<string, (arg?: unknown) => unknown>) {
  // Cadena mínima from().select/update/insert/eq/single/maybeSingle
  const api: Record<string, unknown> = {};
  api.from = vi.fn((_tabla: string) => api);
  api.select = vi.fn((_cols?: string) => api);
  api.update = vi.fn((_payload: unknown) => api);
  api.insert = vi.fn((_payload: unknown) => api);
  api.eq = vi.fn((_col: string, _val: unknown) => api);
  api.maybeSingle = vi.fn(async () => handlers.maybeSingle?.());
  api.single = vi.fn(async () => handlers.single?.());
  return api as never;
}

const base: TicketIaFeedback = {
  ticketId: 't1',
  sugeridoMesaId: 11,
  sugeridoCategoriaId: 101,
  confianza: 0.9,
  fuente: 'beto',
  estado: 'pendiente',
  finalMesaId: null,
  finalCategoriaId: null,
  validadoPor: null,
  validadoEn: null,
};

describe('esAptoEntrenamiento', () => {
  it('solo confirmada/corregida es apta', () => {
    expect(esAptoEntrenamiento({ ...base, estado: 'pendiente' })).toBe(false);
    expect(esAptoEntrenamiento({ ...base, estado: 'confirmada' })).toBe(true);
    expect(esAptoEntrenamiento({ ...base, estado: 'corregida' })).toBe(true);
    expect(esAptoEntrenamiento(null)).toBe(false);
  });
});

describe('registrarSugerenciaIa', () => {
  it('no toca filas ya validadas', async () => {
    const client = clienteMock({
      maybeSingle: () => ({ data: { estado: 'confirmada' }, error: null }),
    });
    await registrarSugerenciaIa(client, 't1', { mesaId: 11, categoriaId: 101, confianza: 0.8, fuente: 'reglas' });
    expect((client as unknown as Record<string, ReturnType<typeof vi.fn>>).update).not.toHaveBeenCalled();
    expect((client as unknown as Record<string, ReturnType<typeof vi.fn>>).insert).not.toHaveBeenCalled();
  });
});

describe('confirmarClasificacion', () => {
  it('usa mesa/categoria actuales del ticket como final', async () => {
    const fila = {
      ticket_id: 't1', sugerido_mesa_id: 11, sugerido_categoria_id: 101,
      confianza: 0.9, fuente: 'beto', estado: 'confirmada',
      final_mesa_id: 11, final_categoria_id: 101,
      validado_por: 'u1', validado_en: '2026-01-01',
    };
    let updatePayload: unknown = null;
    const client = clienteMock({
      single: () => {
        // Primera llamada single() = lectura del ticket; segunda = fila actualizada
        if (updatePayload === null) return { data: { mesa_id: 11, categoria_id: 101 }, error: null };
        return { data: fila, error: null };
      },
    });
    const api = client as unknown as Record<string, ReturnType<typeof vi.fn>>;
    (api.update as ReturnType<typeof vi.fn>).mockImplementation((p: unknown) => {
      updatePayload = p;
      return client;
    });
    const fb = await confirmarClasificacion(client, 't1', 'u1');
    expect((updatePayload as Record<string, unknown>).estado).toBe('confirmada');
    expect((updatePayload as Record<string, unknown>).final_mesa_id).toBe(11);
    expect(fb.estado).toBe('confirmada');
  });
});

describe('corregirClasificacion', () => {
  it('rechaza mesa/categoria inválidas sin tocar BD', async () => {
    const client = clienteMock({});
    await expect(corregirClasificacion(client, 't1', 'u1', { mesaId: 0, categoriaId: 101 }))
      .rejects.toThrow('dependencia');
  });
  it('actualiza ticket y marca corregida', async () => {
    const fila = {
      ticket_id: 't1', sugerido_mesa_id: 11, sugerido_categoria_id: 101,
      confianza: 0.7, fuente: 'reglas', estado: 'corregida',
      final_mesa_id: 33, final_categoria_id: 112,
      validado_por: 'u1', validado_en: '2026-01-01',
    };
    const client = clienteMock({
      single: () => ({ data: fila, error: null }),
    });
    const fb = await corregirClasificacion(client, 't1', 'u1', { mesaId: 33, categoriaId: 112 });
    expect(fb.estado).toBe('corregida');
    expect(fb.finalMesaId).toBe(33);
    expect(fb.finalCategoriaId).toBe(112);
    expect(esAptoEntrenamiento(fb)).toBe(true);
  });
});
