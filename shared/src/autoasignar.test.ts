import { describe, it, expect } from 'vitest';
import {
  cargaPonderada,
  scoreTecnicos,
  sugerirTecnico,
  validateAfinidad,
  AFINIDAD_BOOST,
} from './autoasignar.js';

describe('autoasignar carga ponderada', () => {
  it('suma pesos por prioridad (critica=4, alta=3, media=2, baja=1)', () => {
    expect(cargaPonderada([{ prioridad: 'critica' }, { prioridad: 'baja' }])).toBe(5);
    expect(cargaPonderada([{ prioridad: 'media' }, { prioridad: 'media' }])).toBe(4);
    expect(cargaPonderada([])).toBe(0);
  });
});

describe('autoasignar scoring', () => {
  it('prefiere menor carga', () => {
    const s = scoreTecnicos([
      { tecnicoId: 'a', activos: [{ prioridad: 'critica' }] },
      { tecnicoId: 'b', activos: [{ prioridad: 'baja' }] },
    ]);
    expect(sugerirTecnico(s)?.tecnicoId).toBe('b');
  });
  it('boost por afinidad compensa carga', () => {
    // a: carga 4 sin afinidad; b: carga 4 + afinidad 3 -> ajustada 4-6 <0
    const s = scoreTecnicos([
      { tecnicoId: 'a', activos: [{ prioridad: 'critica' }], afinidadPeso: 0 },
      { tecnicoId: 'b', activos: [{ prioridad: 'critica' }], afinidadPeso: 3 },
    ]);
    const best = sugerirTecnico(s);
    expect(best?.tecnicoId).toBe('b');
    expect(best?.motivo).toContain('afinidad');
    expect(s.find((x) => x.tecnicoId === 'b')?.ajustada).toBe(4 - AFINIDAD_BOOST * 3);
  });
  it('desempata por menor asignación reciente', () => {
    const s = scoreTecnicos([
      { tecnicoId: 'a', activos: [], recientes: 5 },
      { tecnicoId: 'b', activos: [], recientes: 1 },
    ]);
    expect(sugerirTecnico(s)?.tecnicoId).toBe('b');
  });
  it('estable ante empate total (por id)', () => {
    const s = scoreTecnicos([
      { tecnicoId: 'b', activos: [] },
      { tecnicoId: 'a', activos: [] },
    ]);
    expect(sugerirTecnico(s)?.tecnicoId).toBe('a');
  });
  it('null sin técnicos', () => {
    expect(sugerirTecnico([])).toBeNull();
  });
  it('motivo menciona carga + afinidad y recientes', () => {
    const s = scoreTecnicos([{ tecnicoId: 'a', activos: [{ prioridad: 'alta' }], afinidadPeso: 2, recientes: 3 }]);
    const m = sugerirTecnico(s)?.motivo ?? '';
    expect(m).toContain('carga');
    expect(m).toContain('afinidad');
    expect(m).toContain('3 recientes');
  });
});

describe('autoasignar validateAfinidad', () => {
  it('rechaza peso fuera de 1-3', () => {
    expect(validateAfinidad('t', 1, 0)).toBe('Peso 1-3');
    expect(validateAfinidad('t', 1, 4)).toBe('Peso 1-3');
  });
  it('rechaza técnico/categoría inválidos', () => {
    expect(validateAfinidad('', 1, 2)).toBe('Técnico requerido');
    expect(validateAfinidad('t', 0, 2)).toBe('Categoría inválida');
  });
  it('acepta par válido', () => {
    expect(validateAfinidad('t', 5, 3)).toBeNull();
  });
});
