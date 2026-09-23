// Command palette: registro de comandos + filtrado difuso por rol.
// Agnóstico a UI: las apps mapean cada comando a navegación/acción.
import type { RolUsuario } from './types.js';

export type ComandoPalette = {
  id: string;
  titulo: string;
  descripcion?: string;
  keywords: string[];
  /** Roles que pueden verlo. Vacío = todos. */
  roles: readonly RolUsuario[];
  atajo?: string;
};

// Quita tildes y minúsculas para búsqueda tolerante en español.
export function normalizarBusqueda(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Fail-closed: rol no listado no ve el comando.
export function comandosParaRol(comandos: ComandoPalette[], rol: RolUsuario): ComandoPalette[] {
  return comandos.filter((c) => c.roles.length === 0 || (c.roles as readonly string[]).includes(rol));
}

// Todas las palabras del query deben aparecer en título + keywords.
export function filtrarComandos(comandos: ComandoPalette[], texto: string): ComandoPalette[] {
  const q = normalizarBusqueda(texto);
  if (!q) return comandos;
  const partes = q.split(/\s+/);
  return comandos.filter((c) => {
    const hay = normalizarBusqueda([c.titulo, c.descripcion ?? '', ...c.keywords].join(' '));
    return partes.every((p) => hay.includes(p));
  });
}
