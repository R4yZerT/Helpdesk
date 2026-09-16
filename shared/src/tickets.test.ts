import { describe, expect, it } from 'vitest';
import { canTransition, validateCreateTicket } from './tickets.js';

describe('RF-06 validateCreateTicket', () => {
  const base = {
    categoriaId: 1,
    asunto: 'Equipo no enciende en aula 301',
    descripcion: 'El equipo no enciende desde esta mañana, ya se probó otro toma corriente',
    prioridad: 'media' as const,
    mesaId: 1,
  };
  it('valido pasa', () => {
    expect(validateCreateTicket(base)).toEqual({});
  });
  it('categoria requerida', () => {
    expect(validateCreateTicket({ ...base, categoriaId: 0 }).categoriaId).toBeDefined();
  });
  it('asunto corto', () => {
    expect(validateCreateTicket({ ...base, asunto: 'hola' }).asunto).toBeDefined();
  });
  it('descripcion corta', () => {
    expect(validateCreateTicket({ ...base, descripcion: 'corta' }).descripcion).toBeDefined();
  });
  it('prioridad invalida', () => {
    expect(validateCreateTicket({ ...base, prioridad: 'urgente' as never }).prioridad).toBeDefined();
  });
  it('mesa null es invalido (requerida)', () => {
    expect(validateCreateTicket({ ...base, mesaId: null }).mesaId).toBeDefined();
  });
});

// RF-13.1 — Matriz FSM §9 (espejo del trigger trg_tickets_fsm en BD)
describe('RF-13 canTransition (matriz FSM)', () => {
  it('abierto → en_proceso/programado/cerrado (cancel RF-10)', () => {
    expect(canTransition('abierto', 'en_proceso')).toBe(true);
    expect(canTransition('abierto', 'programado')).toBe(true);
    expect(canTransition('abierto', 'cerrado')).toBe(true);
  });
  it('abierto → solucionado/devuelto rechazado (salto directo)', () => {
    expect(canTransition('abierto', 'solucionado')).toBe(false);
    expect(canTransition('abierto', 'devuelto')).toBe(false);
  });
  it('en_proceso → solucionado/cerrado/devuelto/programado', () => {
    expect(canTransition('en_proceso', 'solucionado')).toBe(true);
    expect(canTransition('en_proceso', 'cerrado')).toBe(true);
    expect(canTransition('en_proceso', 'devuelto')).toBe(true);
    expect(canTransition('en_proceso', 'programado')).toBe(true);
    expect(canTransition('en_proceso', 'abierto')).toBe(false);
  });
  it('programado → en_proceso/solucionado/cerrado', () => {
    expect(canTransition('programado', 'en_proceso')).toBe(true);
    expect(canTransition('programado', 'solucionado')).toBe(true);
    expect(canTransition('programado', 'cerrado')).toBe(true);
    expect(canTransition('programado', 'devuelto')).toBe(false);
    expect(canTransition('programado', 'abierto')).toBe(false);
  });
  it('solucionado → cerrado/devuelto únicamente', () => {
    expect(canTransition('solucionado', 'cerrado')).toBe(true);
    expect(canTransition('solucionado', 'devuelto')).toBe(true);
    expect(canTransition('solucionado', 'en_proceso')).toBe(false);
  });
  it('devuelto → en_proceso/programado/cerrado', () => {
    expect(canTransition('devuelto', 'en_proceso')).toBe(true);
    expect(canTransition('devuelto', 'programado')).toBe(true);
    expect(canTransition('devuelto', 'cerrado')).toBe(true);
    expect(canTransition('devuelto', 'solucionado')).toBe(false);
  });
  it('cerrado es terminal (sin salidas)', () => {
    for (const d of ['abierto', 'en_proceso', 'programado', 'solucionado', 'devuelto', 'cerrado'] as const) {
      expect(canTransition('cerrado', d)).toBe(false);
    }
  });
});
