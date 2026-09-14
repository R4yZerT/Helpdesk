import { describe, it, expect } from 'vitest';
import { validateCreateMesa, validateUpdateMesa, isCreateMesaValid, isUpdateMesaValid, validateRespaldo } from './mesas.js';

describe('mesas RF-29', () => {
  it('rechaza nombre corto', () => {
    expect(validateCreateMesa({ nombre: 'ab' }).nombre).toBeDefined();
    expect(isCreateMesaValid({ nombre: 'ab' })).toBe(false);
  });
  it('rechaza nombre largo >60', () => {
    expect(validateCreateMesa({ nombre: 'a'.repeat(61) }).nombre).toBeDefined();
  });
  it('acepta nombre válido', () => {
    expect(isCreateMesaValid({ nombre: 'Oficina TIC' })).toBe(true);
  });
  it('trim nombre', () => {
    expect(validateCreateMesa({ nombre: '  TI  ' }).nombre).toBeDefined(); // 2 chars tras trim
    expect(isCreateMesaValid({ nombre: '  TIC  ' })).toBe(true);
  });
  it('validateUpdateMesa solo valida si presente', () => {
    expect(isUpdateMesaValid({})).toBe(true);
    expect(isUpdateMesaValid({ activa: false })).toBe(true);
    expect(validateUpdateMesa({ nombre: 'ab' }).nombre).toBeDefined();
  });
  it('limite 60 exacto ok', () => {
    expect(isCreateMesaValid({ nombre: 'a'.repeat(60) })).toBe(true);
  });
});

describe('mesas RF-31 respaldo', () => {
  it('rechaza auto-respaldo', () => {
    expect(validateRespaldo(1, 1)).toBe('Una mesa no puede respaldarse a sí misma');
  });
  it('rechaza ids inválidos', () => {
    expect(validateRespaldo(0, 2)).toBe('Mesa inválida');
    expect(validateRespaldo(1, -3)).toBe('Mesa de respaldo inválida');
  });
  it('acepta par válido', () => {
    expect(validateRespaldo(1, 2)).toBeNull();
  });
});
