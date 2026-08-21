// RF-05 — Matriz de permisos por rol
// Mapea cada acción del sistema a los roles autorizados.
// Se deriva de RLS (schema_inicial.sql) + tabla stakeholders.

import type { RolUsuario } from './types.js';

// Permisos atómicos del sistema (naming: recurso:acción)
export type Permission =
  // Tickets
  | 'ticket:create'
  | 'ticket:listOwn'
  | 'ticket:listAssigned'
  | 'ticket:listAll'
  | 'ticket:viewOwn'
  | 'ticket:viewAssigned'
  | 'ticket:viewAll'
  | 'ticket:updateOwn' // RF-10: abierto y sin asignar
  | 'ticket:updateAssigned' // técnico asignado
  | 'ticket:assign' // admin / jefe
  | 'ticket:comment'
  | 'ticket:history:view'
  // Mesas y categorías (RF-29..32)
  | 'mesa:read'
  | 'mesa:write'
  | 'categoria:read'
  | 'categoria:write'
  // Admin (RF-27..28)
  | 'profile:readOwn'
  | 'profile:manage' // crear/editar/desactivar usuarios, asignar rol+mesa
  // Dashboard / IA (RF-16..21, RF-24)
  | 'dashboard:view'
  | 'prediccion:view'
  | 'alerta:view'
  | 'alerta:manage'
  | 'report:export'
  // Notificaciones (RF-23)
  | 'notificacion:readOwn'
  // Importación histórico (RF-26)
  | 'import:execute';

// Matriz: rol -> permisos (Set para lookup O(1))
const PERMISSIONS: Record<RolUsuario, ReadonlySet<Permission>> = {
  empleado: new Set<Permission>([
    'ticket:create',
    'ticket:listOwn',
    'ticket:viewOwn',
    'ticket:updateOwn',
    'ticket:comment',
    'ticket:history:view',
    'mesa:read',
    'categoria:read',
    'profile:readOwn',
    'notificacion:readOwn',
  ]),
  tecnico: new Set<Permission>([
    'ticket:create',
    'ticket:listOwn',
    'ticket:listAssigned',
    'ticket:viewOwn',
    'ticket:viewAssigned',
    'ticket:updateAssigned',
    'ticket:comment',
    'ticket:history:view',
    'mesa:read',
    'categoria:read',
    'profile:readOwn',
    'notificacion:readOwn',
  ]),
  jefe: new Set<Permission>([
    'ticket:create',
    'ticket:listOwn',
    'ticket:listAssigned',
    'ticket:listAll',
    'ticket:viewOwn',
    'ticket:viewAssigned',
    'ticket:viewAll',
    'ticket:assign',
    'ticket:comment',
    'ticket:history:view',
    'mesa:read',
    'categoria:read',
    'profile:readOwn',
    'dashboard:view',
    'prediccion:view',
    'alerta:view',
    'alerta:manage',
    'report:export',
    'notificacion:readOwn',
  ]),
  administrador: new Set<Permission>([
    // Nota stakeholders: administrador NO gestiona tickets ni recibe alertas IA
    // Solo asigna (ticket:assign) y administra catálogos/usuarios.
    'ticket:listAll',
    'ticket:viewAll',
    'ticket:assign',
    'ticket:history:view',
    'mesa:read',
    'mesa:write',
    'categoria:read',
    'categoria:write',
    'profile:readOwn',
    'profile:manage',
    'dashboard:view',
    'prediccion:view',
    'report:export',
    'import:execute',
    'notificacion:readOwn',
  ]),
};

/**
 * Verifica si un rol tiene un permiso.
 * @param rol - rol del profile (lee de public.profiles, no del JWT)
 * @param permission - permiso atómico
 */
export function can(rol: RolUsuario | null | undefined, permission: Permission): boolean {
  if (!rol) return false;
  return PERMISSIONS[rol].has(permission);
}

/**
 * Verifica si el rol tiene al menos uno de los permisos.
 */
export function canAny(
  rol: RolUsuario | null | undefined,
  permissions: readonly Permission[],
): boolean {
  if (!rol) return false;
  const set = PERMISSIONS[rol];
  return permissions.some((p) => set.has(p));
}

/**
 * Verifica si el rol tiene todos los permisos.
 */
export function canAll(
  rol: RolUsuario | null | undefined,
  permissions: readonly Permission[],
): boolean {
  if (!rol) return false;
  const set = PERMISSIONS[rol];
  return permissions.every((p) => set.has(p));
}

// Rutas por rol — para guards de navegación
export const HOME_BY_ROLE: Record<RolUsuario, string> = {
  empleado: '/(empleado)/tickets',
  tecnico: '/(tecnico)/bandeja',
  jefe: '/(jefe)/dashboard',
  administrador: '/(admin)/usuarios',
};

// Rutas permitidas (prefijos). Se usa en RequireRole / middleware.
export const ALLOWED_PREFIXES: Record<RolUsuario, readonly string[]> = {
  empleado: ['/(empleado)', '/tickets', '/perfil'],
  tecnico: ['/(tecnico)', '/(empleado)', '/tickets', '/perfil'],
  jefe: ['/(jefe)', '/(tecnico)', '/(empleado)', '/tickets', '/perfil', '/dashboard'],
  administrador: ['/(admin)', '/perfil', '/mesas', '/categorias', '/usuarios', '/import'],
};
