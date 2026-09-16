// RF-05 — Matriz de permisos por rol: can/canAny/canAll + guards de navegación.
import { describe, it, expect } from 'vitest';
import { can, canAny, canAll, HOME_BY_ROLE, ALLOWED_PREFIXES } from './permissions.js';

describe('permissions.can', () => {
  it('rol nulo/undefined es fail-closed', () => {
    expect(can(null, 'ticket:create')).toBe(false);
    expect(can(undefined, 'dashboard:view')).toBe(false);
    expect(canAny(null, ['ticket:create'])).toBe(false);
    expect(canAll(undefined, ['ticket:create'])).toBe(false);
  });
  it('usuario: crea y ve lo propio, sin dashboard ni gestión', () => {
    expect(can('usuario', 'ticket:create')).toBe(true);
    expect(can('usuario', 'ticket:listOwn')).toBe(true);
    expect(can('usuario', 'ticket:updateOwn')).toBe(true);
    expect(can('usuario', 'ticket:listAssigned')).toBe(false);
    expect(can('usuario', 'ticket:assign')).toBe(false);
    expect(can('usuario', 'dashboard:view')).toBe(false);
    expect(can('usuario', 'profile:manage')).toBe(false);
    expect(can('usuario', 'notificacion:readOwn')).toBe(true);
  });
  it('tecnico: bandeja asignada sin ver todo ni asignar', () => {
    expect(can('tecnico', 'ticket:listAssigned')).toBe(true);
    expect(can('tecnico', 'ticket:viewAssigned')).toBe(true);
    expect(can('tecnico', 'ticket:updateAssigned')).toBe(true);
    expect(can('tecnico', 'ticket:listAll')).toBe(false);
    expect(can('tecnico', 'ticket:viewAll')).toBe(false);
    expect(can('tecnico', 'ticket:assign')).toBe(false);
    expect(can('tecnico', 'alerta:view')).toBe(false);
  });
  it('jefe: ve todo, asigna y gestiona alertas; no administra usuarios ni importa', () => {
    expect(can('jefe', 'ticket:listAll')).toBe(true);
    expect(can('jefe', 'ticket:viewAll')).toBe(true);
    expect(can('jefe', 'ticket:assign')).toBe(true);
    expect(can('jefe', 'dashboard:view')).toBe(true);
    expect(can('jefe', 'alerta:view')).toBe(true);
    expect(can('jefe', 'alerta:manage')).toBe(true);
    expect(can('jefe', 'report:export')).toBe(true);
    expect(can('jefe', 'profile:manage')).toBe(false);
    expect(can('jefe', 'import:execute')).toBe(false);
    expect(can('jefe', 'mesa:write')).toBe(false);
  });
  it('administrador: catálogos/usuarios/import, sin crear tickets ni alertas IA', () => {
    expect(can('administrador', 'profile:manage')).toBe(true);
    expect(can('administrador', 'mesa:write')).toBe(true);
    expect(can('administrador', 'categoria:write')).toBe(true);
    expect(can('administrador', 'import:execute')).toBe(true);
    expect(can('administrador', 'ticket:create')).toBe(false);
    expect(can('administrador', 'ticket:updateAssigned')).toBe(false);
    expect(can('administrador', 'alerta:view')).toBe(false);
    expect(can('administrador', 'alerta:manage')).toBe(false);
    expect(can('administrador', 'ticket:listAll')).toBe(true);
    expect(can('administrador', 'ticket:assign')).toBe(true);
  });
});

describe('permissions.canAny/canAll', () => {
  it('canAny con al menos uno', () => {
    expect(canAny('tecnico', ['ticket:listAll', 'ticket:listAssigned'])).toBe(true);
    expect(canAny('usuario', ['ticket:listAll', 'ticket:assign'])).toBe(false);
    expect(canAny('jefe', [])).toBe(false);
  });
  it('canAll exige todos', () => {
    expect(canAll('jefe', ['dashboard:view', 'alerta:manage'])).toBe(true);
    expect(canAll('jefe', ['dashboard:view', 'profile:manage'])).toBe(false);
    expect(canAll('administrador', ['mesa:write', 'import:execute'])).toBe(true);
  });
});

describe('permissions navegación', () => {
  it('HOME_BY_ROLE cubre los 4 roles', () => {
    expect(Object.keys(HOME_BY_ROLE).sort()).toEqual(['administrador', 'jefe', 'tecnico', 'usuario']);
    expect(HOME_BY_ROLE.jefe).toContain('dashboard');
    expect(HOME_BY_ROLE.administrador).toContain('usuarios');
  });
  it('ALLOWED_PREFIXES por rol', () => {
    expect(ALLOWED_PREFIXES.usuario).toContain('/tickets');
    expect(ALLOWED_PREFIXES.tecnico).toContain('/(tecnico)');
    expect(ALLOWED_PREFIXES.jefe).toContain('/dashboard');
    expect(ALLOWED_PREFIXES.administrador).toContain('/import');
    expect(ALLOWED_PREFIXES.usuario).not.toContain('/dashboard');
  });
});
