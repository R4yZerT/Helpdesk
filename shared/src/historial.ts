// Historial y ciclo de vida por rol — helpers compartidos web/mobile
// - nextEstadosParaRol: el solicitante solo confirma cierre/devuelve cuando está solucionado
// - formatDuracion: "2 h 15 min" entre etapas del historial
// - formatFechaHora: fecha corta es-ES con hora

import type { EstadoTicket, RolUsuario } from './types.js';
import { canTransition } from './tickets.js';

export const ESTADOS_SOLICITANTE_CIERRE: readonly EstadoTicket[] = ['cerrado', 'devuelto'] as const;

/**
 * Siguientes estados visibles según rol.
 * Solicitante (usuario): solo confirmar cierre o devolver cuando está solucionado.
 * Técnico/jefe/administrador: toda la FSM.
 */
export function nextEstadosParaRol(
  rol: RolUsuario | null | undefined,
  estadoActual: EstadoTicket,
  todos: readonly EstadoTicket[],
): EstadoTicket[] {
  if (rol === 'usuario') {
    if (estadoActual !== 'solucionado') return [];
    return (todos as EstadoTicket[]).filter(
      (e) => e === 'cerrado' || e === 'devuelto',
    );
  }
  return (todos as EstadoTicket[]).filter((e) => canTransition(estadoActual, e));
}

/** Duración entre dos instantes ISO como texto corto en español. */
export function formatDuracion(desdeISO: string, hastaISO: string): string | null {
  const desde = new Date(desdeISO).getTime();
  const hasta = new Date(hastaISO).getTime();
  if (Number.isNaN(desde) || Number.isNaN(hasta) || hasta < desde) return null;
  const mins = Math.floor((hasta - desde) / 60000);
  if (mins < 1) return 'menos de 1 min';
  if (mins < 60) return `${mins} min`;
  const horas = Math.floor(mins / 60);
  const restoMin = mins % 60;
  if (horas < 24) return restoMin === 0 ? `${horas} h` : `${horas} h ${restoMin} min`;
  const dias = Math.floor(horas / 24);
  const restoH = horas % 24;
  return restoH === 0 ? `${dias} d` : `${dias} d ${restoH} h`;
}

/** Fecha + hora corta es-ES (ej: 12 sept, 14:35). */
export function formatFechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
