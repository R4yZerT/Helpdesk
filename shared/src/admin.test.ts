import { describe, expect, it } from 'vitest';
import { mapRolFromDb, mapRolToDb, validateCreateUser, validateUpdateUser, isCreateUserValid } from './admin.js';
import { isRolUsuario } from './roles.js';

describe('RF-27 admin — mapeo rol usuario↔empleado', () => {
  it('mapRolToDb usuario -> empleado', () => expect(mapRolToDb('usuario')).toBe('empleado'));
  it('mapRolFromDb empleado -> usuario', () => expect(mapRolFromDb('empleado')).toBe('usuario'));
  it('isRolUsuario', () => {
    expect(isRolUsuario('tecnico')).toBe(true);
    expect(isRolUsuario('empleado')).toBe(false);
    expect(isRolUsuario('administrador')).toBe(true);
  });
});

describe('RF-27 validateCreateUser', () => {
  const base = {
    fullName: 'Ana Pérez',
    email: 'ana@iue.edu.co',
    password: 'Segura123!',
    rol: 'tecnico' as const,
    mesaId: 1,
  };
  it('válido pasa', () => expect(validateCreateUser(base)).toEqual({}));
  it('nombre corto', () => expect(validateCreateUser({ ...base, fullName: 'An' }).fullName).toBeDefined());
  it('email inválido', () => expect(validateCreateUser({ ...base, email: 'nope' }).email).toBeDefined());
  it('password corto', () => expect(validateCreateUser({ ...base, password: 'short' }).password).toBeDefined());
  it('rol inválido', () => expect(validateCreateUser({ ...base, rol: 'invalido' as never }).rol).toBeDefined());
  it('mesa inválida', () => expect(validateCreateUser({ ...base, mesaId: -1 }).mesaId).toBeDefined());
  it('isCreateUserValid false si hay errores', () => expect(isCreateUserValid({ ...base, email: 'bad' })).toBe(false));
});

describe('RF-27 validateUpdateUser', () => {
  it('nombre corto en update', () => expect(validateUpdateUser({ fullName: 'A' }).fullName).toBeDefined());
  it('rol inválido', () => expect(validateUpdateUser({ rol: 'bad' as never }).rol).toBeDefined());
  it('mesa null permitido', () => expect(validateUpdateUser({ mesaId: null })).toEqual({}));
});
