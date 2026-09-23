// Sprint 3 (H1) — BETO con timeout: ante API lenta/caída responde el fallback
// de reglas locales. fetch global se sustituye por dobles programados.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { predecirCategoria, type CatalogosPrediccion } from './ia.js';

const catalogos: CatalogosPrediccion = {
  categorias: [
    { id: 3, dominio: 'tic', subcategoria: 'equipos e infraestructura', orden: 1, activa: true },
  ],
  mesas: [{ id: 1, nombre: 'Soporte', activa: true }],
};

const TEXTO = 'La impresora de la oficina no enciende y tiene atasco de papel urgente';

function fetchQueAborta(): typeof fetch {
  return (vi.fn(async (_url: unknown, opts?: { signal?: AbortSignal }) => {
    await new Promise<void>((_res, rej) => {
      opts?.signal?.addEventListener('abort', () => rej(new DOMException('abortado', 'AbortError')));
    });
    throw new Error('no debería resolver');
  }) as unknown) as typeof fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('predecirCategoria ante BETO degradado', () => {
  it('timeout → fallback de reglas (fuente reglas)', async () => {
    vi.stubGlobal('fetch', fetchQueAborta());
    const out = await predecirCategoria(TEXTO, catalogos, { url: 'http://127.0.0.1:9', timeoutMs: 30 });
    expect(out?.fuente).toBe('reglas');
    expect(out?.categoriaId).toBe(3);
  }, 10000);

  it('BETO 500 → fallback de reglas', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    const out = await predecirCategoria(TEXTO, catalogos, { url: 'http://x', timeoutMs: 2000 });
    expect(out?.fuente).toBe('reglas');
  });

  it('BETO ok con match → fuente beto', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ dominio: 'tic', subcategoria: 'equipos e infraestructura', confianza: 0.9 }),
    })));
    const out = await predecirCategoria(TEXTO, catalogos, { url: 'http://x', timeoutMs: 2000 });
    expect(out?.fuente).toBe('beto');
    expect(out?.categoriaId).toBe(3);
  });

  it('BETO ok sin match → fallback de reglas', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ dominio: 'otro', subcategoria: 'inexistente', confianza: 0.9 }),
    })));
    const out = await predecirCategoria(TEXTO, catalogos, { url: 'http://x', timeoutMs: 2000 });
    expect(out?.fuente).toBe('reglas');
  });
});
