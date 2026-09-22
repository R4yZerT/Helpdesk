import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatSlaRestante, slaEstadoLabel, slaEstadoTone } from './sla.js';
import {
  corregirClasificacion,
  getIaFeedback,
  registrarSugerenciaIa,
} from './ia-feedback.js';
import { downloadCsv, printDashboard } from './export.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------- sla.ts ----------

describe('sla gaps (líneas 76-77, 85-103)', () => {
  it('formatSlaRestante vencido en horas (línea 76)', () => {
    // v=90 (<1440) -> horas
    expect(formatSlaRestante(-90)).toBe('Vencido hace 1 h');
    expect(formatSlaRestante(-150)).toBe('Vencido hace 2 h');
  });

  it('formatSlaRestante vencido en días (línea 77)', () => {
    expect(formatSlaRestante(-1500)).toBe('Vencido hace 1 d');
    expect(formatSlaRestante(-3000)).toBe('Vencido hace 2 d');
  });

  it('formatSlaRestante días exactos y días+horas (líneas 85-87)', () => {
    expect(formatSlaRestante(1440)).toBe('1 d');
    expect(formatSlaRestante(2880)).toBe('2 d');
    expect(formatSlaRestante(1500)).toBe('1 d 1 h');
    expect(formatSlaRestante(1560)).toBe('1 d 2 h');
  });

  it('slaEstadoLabel cubre los 5 estados (líneas 90-98)', () => {
    expect(slaEstadoLabel('vigente')).toBe('Dentro de compromiso');
    expect(slaEstadoLabel('por_vencer')).toBe('Por vencer');
    expect(slaEstadoLabel('vencido')).toBe('Vencido');
    expect(slaEstadoLabel('cumplido')).toBe('Cumplido a tiempo');
    expect(slaEstadoLabel('vencido_tarde')).toBe('Cerrado con retraso');
  });

  it('slaEstadoTone mapea success/warning/danger (líneas 100-103)', () => {
    expect(slaEstadoTone('vigente')).toBe('success');
    expect(slaEstadoTone('cumplido')).toBe('success');
    expect(slaEstadoTone('por_vencer')).toBe('warning');
    expect(slaEstadoTone('vencido')).toBe('danger');
    expect(slaEstadoTone('vencido_tarde')).toBe('danger');
  });
});

// ---------- ia-feedback.ts ----------

// Construye cadena from().select().eq().maybeSingle() con resultado enlatado
function mockGetClient(maybeResult: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn(async () => maybeResult);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as never, spies: { from, select, eq, maybeSingle } };
}

describe('ia-feedback gaps getIaFeedback (líneas 65-72)', () => {
  it('lanza si hay error de Supabase (línea 70)', async () => {
    const { client } = mockGetClient({ data: null, error: { message: 'boom' } });
    await expect(getIaFeedback(client, 't1')).rejects.toThrow('boom');
  });

  it('retorna null sin fila (línea 71)', async () => {
    const { client } = mockGetClient({ data: null, error: null });
    await expect(getIaFeedback(client, 't1')).resolves.toBeNull();
  });

  it('mapea fila y aplica fallback fuente/estado inválidos (líneas 72+47-48)', async () => {
    const { client } = mockGetClient({
      data: {
        ticket_id: 't9',
        sugerido_mesa_id: 3,
        sugerido_categoria_id: 7,
        confianza: 0.5,
        fuente: 'invalida',
        estado: 'raro',
        final_mesa_id: null,
        final_categoria_id: null,
        validado_por: null,
        validado_en: null,
      },
      error: null,
    });
    const fb = await getIaFeedback(client, 't9');
    expect(fb?.ticketId).toBe('t9');
    expect(fb?.fuente).toBe('desconocida');
    expect(fb?.estado).toBe('pendiente');
  });
});

describe('ia-feedback gaps registrarSugerenciaIa (líneas 97-107)', () => {
  const sug = { mesaId: 11, categoriaId: 101, confianza: 0.8, fuente: 'reglas' as const };

  it('hace update si la fila sigue pendiente (líneas 97-104)', async () => {
    const updateEq2 = vi.fn(async () => ({ error: null }));
    const updateEq1 = vi.fn(() => ({ eq: updateEq2 }));
    const update = vi.fn(() => ({ eq: updateEq1 }));
    const insert = vi.fn(() => {
      throw new Error('no debería insertar');
    });
    const maybeSingle = vi.fn(async () => ({ data: { estado: 'pendiente' } }));
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    // Primera llamada from() = lectura estado; segunda = update
    const from = vi
      .fn()
      .mockImplementationOnce(() => ({ select }))
      .mockImplementationOnce(() => ({ update }));
    const client = { from, insert } as never;
    await registrarSugerenciaIa(client, 't1', sug);
    expect(update).toHaveBeenCalledOnce();
    expect(updateEq2).toHaveBeenCalledOnce();
  });

  it('lanza si el update falla (línea 103)', async () => {
    const updateEq2 = vi.fn(async () => ({ error: { message: 'upd-fail' } }));
    const updateEq1 = vi.fn(() => ({ eq: updateEq2 }));
    const update = vi.fn(() => ({ eq: updateEq1 }));
    const maybeSingle = vi.fn(async () => ({ data: { estado: 'pendiente' } }));
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi
      .fn()
      .mockImplementationOnce(() => ({ select }))
      .mockImplementationOnce(() => ({ update }));
    const client = { from } as never;
    await expect(registrarSugerenciaIa(client, 't1', sug)).rejects.toThrow('upd-fail');
  });

  it('hace insert si no hay fila (líneas 106-107)', async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const maybeSingle = vi.fn(async () => ({ data: null }));
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi
      .fn()
      .mockImplementationOnce(() => ({ select }))
      .mockImplementationOnce(() => ({ insert }));
    const client = { from } as never;
    await registrarSugerenciaIa(client, 't-new', sug);
    expect(insert).toHaveBeenCalledOnce();
    expect(insert.mock.calls[0]?.[0]).toMatchObject({ ticket_id: 't-new' });
  });

  it('lanza si el insert falla (línea 107)', async () => {
    const insert = vi.fn(async () => ({ error: { message: 'ins-fail' } }));
    const maybeSingle = vi.fn(async () => ({ data: null }));
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi
      .fn()
      .mockImplementationOnce(() => ({ select }))
      .mockImplementationOnce(() => ({ insert }));
    const client = { from } as never;
    await expect(registrarSugerenciaIa(client, 't-new', sug)).rejects.toThrow('ins-fail');
  });
});

describe('ia-feedback gaps corregirClasificacion (línea 153)', () => {
  it('rechaza categoriaId inválido sin tocar BD', async () => {
    const from = vi.fn(() => {
      throw new Error('no debería consultar BD');
    });
    const client = { from } as never;
    await expect(corregirClasificacion(client, 't1', 'u1', { mesaId: 5, categoriaId: 0 })).rejects.toThrow(
      'categoría',
    );
    expect(from).not.toHaveBeenCalled();
  });
});

// ---------- export.ts (líneas 97-112) ----------

describe('export gaps downloadCsv/printDashboard (líneas 97-112)', () => {
  it('downloadCsv retorna false sin document (línea 97)', () => {
    vi.stubGlobal('document', undefined);
    expect(downloadCsv('a.csv', 'x')).toBe(false);
  });

  it('downloadCsv crea enlace y retorna true con document', () => {
    vi.useFakeTimers();
    try {
      const click = vi.fn();
      const remove = vi.fn();
      const appendChild = vi.fn();
      const createObjectURL = vi.fn(() => 'blob:fake');
      const revokeObjectURL = vi.fn();
      const anchor: Record<string, unknown> = { click, remove };
      const createElement = vi.fn(() => anchor);
      vi.stubGlobal('document', { createElement, body: { appendChild } } as never);
      vi.stubGlobal('URL', { createObjectURL, revokeObjectURL } as never);
      expect(downloadCsv('a.csv', 'hola')).toBe(true);
      expect(createElement).toHaveBeenCalledWith('a');
      expect(anchor.href).toBe('blob:fake');
      expect(anchor.download).toBe('a.csv');
      expect(appendChild).toHaveBeenCalledOnce();
      expect(click).toHaveBeenCalledOnce();
      expect(remove).toHaveBeenCalledOnce();
      vi.runAllTimers();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    } finally {
      vi.useRealTimers();
    }
  });

  it('printDashboard llama window.print si existe (líneas 111-112)', () => {
    const print = vi.fn();
    vi.stubGlobal('window', { print } as never);
    printDashboard();
    expect(print).toHaveBeenCalledOnce();
  });

  it('printDashboard no falla sin window ni sin print', () => {
    vi.stubGlobal('window', undefined);
    expect(() => printDashboard()).not.toThrow();
    vi.stubGlobal('window', {} as never);
    expect(() => printDashboard()).not.toThrow();
  });
});
