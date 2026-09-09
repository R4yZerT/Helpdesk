// Control de compromiso SLA — duraciones por prioridad y cálculo de vencimiento/estado
import type { PrioridadTicket } from './types.js';

// Duraciones SLA en minutos: critica 60m, alta 4h, media 24h, baja 72h
export const SLA_MINUTOS: Record<PrioridadTicket, number> = {
  critica: 60,
  alta: 240,
  media: 1440,
  baja: 4320,
} as const;

export const SLA_MS: Record<PrioridadTicket, number> = {
  critica: 60 * 60 * 1000,
  alta: 240 * 60 * 1000,
  media: 1440 * 60 * 1000,
  baja: 4320 * 60 * 1000,
} as const;

export type SlaEstado = 'vigente' | 'por_vencer' | 'vencido' | 'cumplido' | 'vencido_tarde';

export function getSlaMinutos(p: PrioridadTicket): number {
  return SLA_MINUTOS[p] ?? 1440;
}

/** Fecha de vencimiento = creadoEn + duración SLA */
export function getSlaVencimiento(creadoEn: string, prioridad: PrioridadTicket): Date {
  const d = new Date(creadoEn);
  return new Date(d.getTime() + getSlaMinutos(prioridad) * 60 * 1000);
}

/** Minutos restantes hasta vencimiento (negativo si vencido) */
export function getSlaMinutosRestantes(venceEn: string | Date, ahora: Date = new Date()): number {
  const v = typeof venceEn === 'string' ? new Date(venceEn) : venceEn;
  return Math.floor((v.getTime() - ahora.getTime()) / 60000);
}

/** % de vida consumida (0-100+, >100 = vencido) */
export function getSlaProgreso(creadoEn: string, venceEn: string | Date, ahora: Date = new Date()): number {
  const c = new Date(creadoEn).getTime();
  const v = (typeof venceEn === 'string' ? new Date(venceEn) : venceEn).getTime();
  const dur = v - c;
  if (dur <= 0) return 100;
  const elapsed = ahora.getTime() - c;
  return Math.max(0, Math.min(200, (elapsed / dur) * 100));
}

/** Estado del compromiso */
export function getSlaEstado(params: {
  creadoEn: string;
  prioridad: PrioridadTicket;
  estado: string;
  venceEn?: string | null;
  fechaResolucion?: string | null;
  ahora?: Date;
}): SlaEstado {
  const { creadoEn, prioridad, estado, venceEn, fechaResolucion, ahora = new Date() } = params;
  const vence = venceEn ? new Date(venceEn) : getSlaVencimiento(creadoEn, prioridad);
  const cerrado = estado === 'cerrado' || estado === 'solucionado';
  if (cerrado) {
    const ref = fechaResolucion ? new Date(fechaResolucion) : ahora;
    return ref.getTime() <= vence.getTime() ? 'cumplido' : 'vencido_tarde';
  }
  if (ahora.getTime() > vence.getTime()) return 'vencido';
  // por_vencer = queda <25% de duración (cap 60 min para SLAs largos como baja/media)
  const durMin = getSlaMinutos(prioridad);
  const porVencerMin = Math.min(60, Math.floor(durMin * 0.25));
  const restantes = getSlaMinutosRestantes(vence, ahora);
  if (restantes <= porVencerMin) return 'por_vencer';
  return 'vigente';
}

export function formatSlaRestante(minRest: number): string {
  if (minRest <= 0) {
    const v = Math.abs(minRest);
    if (v < 60) return `Vencido hace ${v} min`;
    if (v < 1440) return `Vencido hace ${Math.floor(v / 60)} h`;
    return `Vencido hace ${Math.floor(v / 1440)} d`;
  }
  if (minRest < 60) return `${minRest} min restantes`;
  if (minRest < 1440) {
    const h = Math.floor(minRest / 60);
    const m = minRest % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  const d = Math.floor(minRest / 1440);
  const h = Math.floor((minRest % 1440) / 60);
  return h ? `${d} d ${h} h` : `${d} d`;
}

export function slaEstadoLabel(e: SlaEstado): string {
  switch (e) {
    case 'vigente': return 'Dentro de compromiso';
    case 'por_vencer': return 'Por vencer';
    case 'vencido': return 'Vencido';
    case 'cumplido': return 'Cumplido a tiempo';
    case 'vencido_tarde': return 'Cerrado con retraso';
  }
}

export function slaEstadoTone(e: SlaEstado): 'success' | 'warning' | 'danger' | 'muted' {
  if (e === 'cumplido' || e === 'vigente') return 'success';
  if (e === 'por_vencer') return 'warning';
  return 'danger';
}
