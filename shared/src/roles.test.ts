import { describe, expect, it } from 'vitest';
import { hasAnyRole, isRolUsuario } from './roles.js';
import { can } from './permissions.js';

describe('RF-05 roles/permissions', () => {
  it('valida roles', () => {
    expect(isRolUsuario('usuario')).toBe(true);
    expect(isRolUsuario('invalido')).toBe(false);
  });
  it('hasAnyRole', () => {
    expect(hasAnyRole('jefe', ['jefe', 'administrador'])).toBe(true);
    expect(hasAnyRole('usuario', ['tecnico'])).toBe(false);
  });
  it('matriz can', () => {
    expect(can('usuario', 'ticket:create')).toBe(true);
    expect(can('usuario', 'dashboard:view')).toBe(false);
    expect(can('administrador', 'profile:manage')).toBe(true);
    expect(can('administrador', 'ticket:create')).toBe(false);
    expect(can('jefe', 'alerta:view')).toBe(true);
    expect(can('tecnico', 'ticket:listAssigned')).toBe(true);
  });
});
