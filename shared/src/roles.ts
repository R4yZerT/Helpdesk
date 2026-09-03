// RF-05 — Control de acceso por rol
// Fuente: stakeholders + RLS de schema_inicial.sql

import type { RolUsuario } from './types.js';

// Todos los roles válidos (orden de menor a mayor privilegio operativo)
export const ROLES: readonly RolUsuario[] = [
  'usuario',
  'tecnico',
  'jefe',
  'administrador',
] as const;

// Guard de tipo
export function isRolUsuario(value: unknown): value is RolUsuario {
  return (
    typeof value === 'string' && (ROLES as readonly string[]).includes(value)
  );
}

// Checks simples
export function hasRole(
  profileRol: RolUsuario | null | undefined,
  role: RolUsuario,
): boolean {
  return profileRol === role;
}

export function hasAnyRole(
  profileRol: RolUsuario | null | undefined,
  roles: readonly RolUsuario[],
): boolean {
  if (!profileRol) return false;
  return roles.includes(profileRol);
}

// Helpers de nivel — útiles para mensajes, no para autorización fina
export function isPrivileged(profileRol: RolUsuario | null | undefined): boolean {
  return hasAnyRole(profileRol, ['jefe', 'administrador']);
}

export function isTecnicoLike(
  profileRol: RolUsuario | null | undefined,
): boolean {
  return hasAnyRole(profileRol, ['tecnico', 'jefe', 'administrador']);
}
