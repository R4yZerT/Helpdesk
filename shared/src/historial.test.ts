// Tests: ciclo de vida por rol y duraciones del historial
import { describe, expect, it } from 'vitest';
import { ESTADOS } from './tickets.js';
import { formatDuracion, formatFechaHora, nextEstadosParaRol } from './historial.js';

describe('nextEstadosParaRol', () => {
  it('solicitante no ve acciones si no está solucionado', () => {
    expect(nextEstadosParaRol('usuario', 'abierto', ESTADOS)).toEqual([]);
    expect(nextEstadosParaRol('usuario', 'en_proceso', ESTADOS)).toEqual([]);
  });

  it('solicitante solo confirma cierre o devuelve desde solucionado', () => {
    expect(nextEstadosParaRol('usuario', 'solucionado', ESTADOS)).toEqual(['cerrado', 'devuelto']);
  });

  it('técnico/jefe/admin ven toda la FSM', () => {
    for (const rol of ['tecnico', 'jefe', 'administrador'] as const) {
      const next = nextEstadosParaRol(rol, 'abierto', ESTADOS);
      expect(next).toContain('en_proceso');
      expect(nextEstadosParaRol(rol, 'en_proceso', ESTADOS)).toContain('solucionado');
    }
  });
});

describe('formatDuracion', () => {
  it('menos de un minuto', () => {
    expect(formatDuracion('2026-09-15T10:00:00Z', '2026-09-15T10:00:30Z')).toBe('menos de 1 min');
  });

  it('minutos y horas', () => {
    expect(formatDuracion('2026-09-15T10:00:00Z', '2026-09-15T10:15:00Z')).toBe('15 min');
    expect(formatDuracion('2026-09-15T10:00:00Z', '2026-09-15T12:30:00Z')).toBe('2 h 30 min');
  });

  it('días', () => {
    expect(formatDuracion('2026-09-13T10:00:00Z', '2026-09-15T12:00:00Z')).toBe('2 d 2 h');
  });

  it('rango inválido retorna null', () => {
    expect(formatDuracion('2026-09-15T12:00:00Z', '2026-09-15T10:00:00Z')).toBeNull();
    expect(formatDuracion('no-fecha', '2026-09-15T10:00:00Z')).toBeNull();
  });
});

describe('formatFechaHora', () => {
  it('fecha inválida retorna guion', () => {
    expect(formatFechaHora('no-fecha')).toBe('—');
  });
});
