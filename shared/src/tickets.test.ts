import { describe, expect, it } from 'vitest';
import { validateCreateTicket } from './tickets.js';

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
