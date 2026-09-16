import { describe, it, expect } from 'vitest';
import { validateCreateMesa, validateUpdateMesa, isCreateMesaValid, isUpdateMesaValid, resolveSecretariaId } from './mesas.js';

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

describe('mesas RF-30 (admin ve todas)', () => {
  it('administrador con dependencia asignada ve todas (sin filtro)', () => {
    expect(resolveSecretariaId('administrador', 3)).toBeNull();
  });
  it('administrador sin dependencia ve todas', () => {
    expect(resolveSecretariaId('administrador', null)).toBeNull();
  });
  it('no-admin con dependencia solo ve la suya', () => {
    expect(resolveSecretariaId('jefe', 3)).toBe(3);
    expect(resolveSecretariaId('tecnico', 2)).toBe(2);
  });
  it('no-admin sin dependencia ve todas', () => {
    expect(resolveSecretariaId('jefe', null)).toBeNull();
  });
  it('rol desconocido/nulo fail-closed: conserva filtro', () => {
    expect(resolveSecretariaId(null, 3)).toBe(3);
    expect(resolveSecretariaId('fantasma', 3)).toBe(3);
  });
});

