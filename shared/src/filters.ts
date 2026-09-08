// Helpers de etiquetas para filtros — capitaliza y aplica tildes correctas
// Usado por todos los desplegables de filtrado en cualquier perfil

import type { EstadoTicket, PrioridadTicket, RolUsuario } from './types.js';
import type { DominioCategoria } from './categorias.js';

export const ESTADO_LABELS: Record<EstadoTicket, string> = {
  abierto: 'Abierto',
  en_proceso: 'En proceso',
  solucionado: 'Solucionado',
  cerrado: 'Cerrado',
  devuelto: 'Devuelto',
};

export const PRIORIDAD_LABELS: Record<PrioridadTicket, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
};

export const ROL_LABELS: Record<RolUsuario, string> = {
  usuario: 'Usuario',
  tecnico: 'Técnico',
  jefe: 'Jefe',
  administrador: 'Administrador',
};

export const DOMINIO_LABELS: Record<DominioCategoria, string> = {
  tic: 'TIC',
  comunicaciones: 'Comunicaciones',
  infraestructura: 'Infraestructura',
  general: 'General',
};

export function formatEstado(v: EstadoTicket): string {
  return ESTADO_LABELS[v] ?? capitalize(v.replace(/_/g, ' '));
}

export function formatPrioridad(v: PrioridadTicket): string {
  return PRIORIDAD_LABELS[v] ?? capitalize(v);
}

export function formatRol(v: RolUsuario): string {
  return ROL_LABELS[v] ?? capitalize(v);
}

export function formatDominio(v: DominioCategoria): string {
  return DOMINIO_LABELS[v] ?? capitalize(v);
}

// Para filtros booleanos
export function formatActivaLabel(v: boolean | 'todos', opts?: { femenino?: boolean }): string {
  if (v === 'todos') return 'Todos';
  if (opts?.femenino) return v ? 'Activas' : 'Inactivas';
  return v ? 'Activos' : 'Inactivos';
}

// Todas = inclusivo, para dependencias/categorías (femenino)
export function formatActivoDependencia(v: boolean | 'todos'): string {
  if (v === 'todos') return 'Todas';
  return v ? 'Activas' : 'Inactivas';
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export const ESTADO_OPTIONS: { value: EstadoTicket | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  ...(['abierto', 'en_proceso', 'solucionado', 'cerrado', 'devuelto'] as EstadoTicket[]).map((e) => ({
    value: e,
    label: formatEstado(e),
  })),
];

export const PRIORIDAD_OPTIONS: { value: PrioridadTicket | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  ...(['baja', 'media', 'alta', 'critica'] as PrioridadTicket[]).map((p) => ({
    value: p,
    label: formatPrioridad(p),
  })),
];

export const ROL_OPTIONS: { value: RolUsuario | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  ...(['usuario', 'tecnico', 'jefe', 'administrador'] as RolUsuario[]).map((r) => ({
    value: r,
    label: formatRol(r),
  })),
];
