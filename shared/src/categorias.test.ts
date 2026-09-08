import { describe, expect, it } from 'vitest';
import { validateCreateCategoria, validateUpdateCategoria } from './categorias.js';

describe('categorias validación', () => {
  it('create ok', () => {
    expect(validateCreateCategoria({ dominio: 'tic', subcategoria: 'Redes', orden: 10 })).toEqual({});
  });
  it('dominio inválido', () => {
    expect(validateCreateCategoria({ dominio: 'foo' as never, subcategoria: 'X' }).dominio).toBeDefined();
  });
  it('subcategoria corta', () => {
    expect(validateCreateCategoria({ dominio: 'tic', subcategoria: 'ab' }).subcategoria).toBeDefined();
  });
  it('subcategoria larga', () => {
    expect(validateCreateCategoria({ dominio: 'tic', subcategoria: 'a'.repeat(81) }).subcategoria).toBeDefined();
  });
  it('orden inválido', () => {
    expect(validateCreateCategoria({ dominio: 'tic', subcategoria: 'Valid', orden: -1 }).orden).toBeDefined();
  });
  it('update dominio inválido', () => {
    expect(validateUpdateCategoria({ dominio: 'bad' as never }).dominio).toBeDefined();
  });
});
