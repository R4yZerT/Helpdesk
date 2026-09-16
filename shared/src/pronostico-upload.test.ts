// RF-19/B3 — Guards de vacío e integridad del constructor de filas de pronóstico.
import { describe, expect, it } from 'vitest';
import { buildPronosticoRows } from './pronostico-upload.js';

const V = 'rf-forecast-test';
const ok = {
  global: [
    { fecha: '2026-09-14', forecast: 42.5, nivel: 'alta', es_pico: false },
    { fecha: '2026-09-15', forecast: 120, nivel: 'pico', es_pico: true },
  ],
};

describe('buildPronosticoRows', () => {
  it('construye filas válidas con serie + versión', () => {
    const rows = buildPronosticoRows(ok, V);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ fecha: '2026-09-14', serie: 'global', nivel: 'alta', modelo_version: V });
    expect(rows[1].es_pico).toBe(true);
  });

  it('JSON vacío (0 series) lanza en vez de push silencioso', () => {
    expect(() => buildPronosticoRows({}, V)).toThrow('0 series');
  });

  it('serie vacía lanza en vez de insertar 0 filas', () => {
    expect(() => buildPronosticoRows({ global: [] }, V)).toThrow('vacía');
  });

  it('raíz no-objeto lanza', () => {
    expect(() => buildPronosticoRows(null, V)).toThrow('raíz inválido');
    expect(() => buildPronosticoRows([], V)).toThrow('raíz inválido');
  });

  it('nivel fuera del CHECK de BD lanza (falla rápido, no en el upsert)', () => {
    const bad = { global: [{ fecha: '2026-09-14', forecast: 10, nivel: 'extremo' }] };
    expect(() => buildPronosticoRows(bad, V)).toThrow('nivel inválido');
  });

  it('fecha o forecast malformados lanzan', () => {
    expect(() =>
      buildPronosticoRows({ global: [{ fecha: '14/09/2026', forecast: 10, nivel: 'baja' }] }, V),
    ).toThrow('fecha inválida');
    expect(() =>
      buildPronosticoRows({ global: [{ fecha: '2026-09-14', forecast: NaN, nivel: 'baja' }] }, V),
    ).toThrow('no-numérico');
  });

  it('versión vacía lanza', () => {
    expect(() => buildPronosticoRows(ok, '  ')).toThrow('modelo_version vacío');
  });
});
