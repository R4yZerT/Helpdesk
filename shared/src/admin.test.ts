import { describe, expect, it } from 'vitest';
import { describeUserChanges, explainUserError, mapRolFromDb, mapRolToDb, validateCreateUser, validateUpdateUser, isCreateUserValid } from './admin.js';
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

// Mensajes de validación: siempre explican campo + causa (vacío, longitud, caracteres, formato)
describe('validate — mensajes con causa', () => {
  it('nombre vacío indica requerido', () => expect(validateCreateUser({ fullName: '', cedula: '123456', email: 'a@b.co', password: 'Segura123!', rol: 'usuario', mesaId: null }).fullName).toMatch(/requerido/i));
  it('nombre corto indica longitud recibida', () => expect(validateCreateUser({ fullName: 'An', cedula: '123456', email: 'a@b.co', password: 'Segura123!', rol: 'usuario', mesaId: null }).fullName).toMatch(/3 caracteres/));
  it('email vacío indica requerido', () => expect(validateCreateUser({ fullName: 'Ana Pérez', cedula: '123456', email: '', password: 'Segura123!', rol: 'usuario', mesaId: null }).email).toMatch(/requerido/i));
  it('email mal formato indica formato esperado', () => expect(validateCreateUser({ fullName: 'Ana Pérez', cedula: '123456', email: 'nope', password: 'Segura123!', rol: 'usuario', mesaId: null }).email).toMatch(/formato/i));
  it('cédula con letras indica solo dígitos', () => expect(validateCreateUser({ fullName: 'Ana Pérez', cedula: 'abc123', email: 'a@b.co', password: 'Segura123!', rol: 'usuario', mesaId: null }).cedula).toMatch(/dígitos/));
  it('cédula corta indica longitud', () => expect(validateCreateUser({ fullName: 'Ana Pérez', cedula: '123', email: 'a@b.co', password: 'Segura123!', rol: 'usuario', mesaId: null }).cedula).toMatch(/5-15/));
  it('rol inválido lista roles válidos', () => expect(validateCreateUser({ fullName: 'Ana Pérez', cedula: '123456', email: 'a@b.co', password: 'Segura123!', rol: 'x' as never, mesaId: null }).rol).toMatch(/usuario/));
});

// explainUserError: SIEMPRE devuelve causa en español, nunca vacío ni críptico
describe('explainUserError', () => {
  it('duplicado cédula', () => expect(explainUserError(new Error('duplicate key value violates unique constraint "profiles_cedula_key"'))).toMatch(/cédula.*registrada|duplicada/i));
  it('duplicado correo', () => expect(explainUserError(new Error('duplicate key (email)=x'))).toMatch(/correo.*registrado|duplicado/i));
  it('RLS/permiso indica rol o sesión', () => expect(explainUserError(new Error('new row violates row-level security policy'))).toMatch(/permiso|sesi/i));
  it('red indica conexión', () => expect(explainUserError(new Error('Failed to send a request to the Edge Function'))).toMatch(/conexi/i));
  it('vacío no queda vacío', () => expect(explainUserError(new Error(''))).toMatch(/desconocido|reintenta/i));
  it('null no queda vacío', () => expect(explainUserError(null)).toMatch(/desconocido|reintenta/i));
  it('mensaje claro se conserva', () => expect(explainUserError(new Error('Cédula ya registrada'))).toMatch(/cédula/i));
});

// describeUserChanges: líneas antes → después para modal de confirmación
describe('describeUserChanges', () => {
  const oldU = { fullName: 'Ana', cedula: '111', email: 'a@b.co', rol: 'usuario', mesaId: null as number | null, activo: true };
  it('sin cambios retorna vacío', () => expect(describeUserChanges(oldU, { fullName: 'Ana', cedula: '111', email: 'a@b.co', rol: 'usuario', mesaId: null, activo: true, cambiarPass: false })).toEqual([]));
  it('detecta nombre y rol', () => {
    const lines = describeUserChanges(oldU, { fullName: 'Ana Pérez', cedula: '111', email: 'a@b.co', rol: 'jefe', mesaId: null, activo: true, cambiarPass: false });
    expect(lines.map((l) => l.campo)).toEqual(['Nombre', 'Rol']);
    expect(lines[0]).toMatchObject({ antes: 'Ana', despues: 'Ana Pérez' });
  });
  it('contraseña agrega línea', () => {
    const lines = describeUserChanges(oldU, { fullName: 'Ana', cedula: '111', email: 'a@b.co', rol: 'usuario', mesaId: null, activo: true, cambiarPass: true });
    expect(lines.map((l) => l.campo)).toEqual(['Contraseña']);
  });
});
