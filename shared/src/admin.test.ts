import { describe, expect, it } from 'vitest';
import { mapRolFromDb, mapRolToDb, validateCreateUser, validateUpdateUser, isCreateUserValid } from './admin.js';
import { isRolUsuario } from './roles.js';

describe('admin — mapeo rol usuario (unificado)', () => {
  it('mapRolToDb usuario -> usuario', () => expect(mapRolToDb('usuario')).toBe('usuario'));
  it('mapRolFromDb empleado -> usuario', () => expect(mapRolFromDb('empleado')).toBe('usuario'));
  it('isRolUsuario', () => {
    expect(isRolUsuario('tecnico')).toBe(true);
    expect(isRolUsuario('empleado')).toBe(false);
    expect(isRolUsuario('administrador')).toBe(true);
  });
});

describe('validateCreateUser', () => {
  const base = {
    fullName: 'Ana Pérez',
    cedula: '1023456789',
    email: 'ana@iue.edu.co',
    password: 'Segura123!',
    rol: 'tecnico' as const,
    mesaId: 1,
  };
  it('válido pasa', () => expect(validateCreateUser(base)).toEqual({}));
  it('nombre corto', () => expect(validateCreateUser({ ...base, fullName: 'An' }).fullName).toBeDefined());
  it('email inválido', () => expect(validateCreateUser({ ...base, email: 'nope' }).email).toBeDefined());
  it('cedula corta', () => expect(validateCreateUser({ ...base, cedula: '123' }).cedula).toBeDefined());
  it('cedula no numérica', () => expect(validateCreateUser({ ...base, cedula: 'abc123' }).cedula).toBeDefined());
  it('password corto', () => expect(validateCreateUser({ ...base, password: 'short' }).password).toBeDefined());
  it('rol inválido', () => expect(validateCreateUser({ ...base, rol: 'invalido' as never }).rol).toBeDefined());
  it('mesa inválida', () => expect(validateCreateUser({ ...base, mesaId: -1 }).mesaId).toBeDefined());
  it('isCreateUserValid false si hay errores', () => expect(isCreateUserValid({ ...base, email: 'bad' })).toBe(false));
});

describe('validateUpdateUser', () => {
  it('nombre corto en update', () => expect(validateUpdateUser({ fullName: 'A' }).fullName).toBeDefined());
  it('rol inválido', () => expect(validateUpdateUser({ rol: 'bad' as never }).rol).toBeDefined());
  it('mesa null permitido', () => expect(validateUpdateUser({ mesaId: null })).toEqual({}));
  it('cedula corta en update', () => expect(validateUpdateUser({ cedula: '12' }).cedula).toBeDefined());
  it('email inválido en update', () => expect(validateUpdateUser({ email: 'bad' }).email).toBeDefined());
});
