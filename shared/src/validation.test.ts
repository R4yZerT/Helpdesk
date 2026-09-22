// RF-06 — validateCreateTicket: tests unitarios críticos
import { describe, expect, it } from 'vitest';
import { validateCreateTicket, isCreateTicketValid } from './tickets.js';

const base = {
  categoriaId: 1,
  asunto: 'Equipo no enciende en aula 301',
  descripcion: 'El equipo no enciende desde esta mañana, ya se probó otro toma corriente',
  prioridad: 'media' as const,
  mesaId: 1,
};

describe('validateCreateTicket', () => {
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
  it('tecnicoAsignadoId vacío es inválido', () => {
    expect(validateCreateTicket({ ...base, tecnicoAsignadoId: '' } as never).tecnicoAsignadoId).toBeDefined();
  });
  it('tecnicoAsignadoId undefined pasa (opcional)', () => {
    const r = validateCreateTicket({ ...base, tecnicoAsignadoId: undefined } as never);
    expect(r.tecnicoAsignadoId).toBeUndefined();
  });
});

describe('isCreateTicketValid', () => {
  it('true si no hay errores', () => {
    expect(isCreateTicketValid(base)).toBe(true);
  });
  it('false si hay errores', () => {
    expect(isCreateTicketValid({ ...base, asunto: '' })).toBe(false);
  });
});