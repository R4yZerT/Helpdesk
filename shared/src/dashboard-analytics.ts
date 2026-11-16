import type { Kpis } from './dashboard.js';

export type DashboardKpiRow = {
  estado: string;
  prioridad: string;
  creado_en: string;
  sla_vence_en?: string | null;
  fecha_resolucion?: string | null;
};

const SLA_MINUTES: Record<string, number> = {
  critica: 60,
  alta: 240,
  media: 1440,
  baja: 4320,
};

export function calcularKpisDesdeTickets(rows: DashboardKpiRow[], now = new Date()): Kpis {
  const total = rows.length;
  const abiertos = rows.filter((row) => ['abierto', 'en_proceso', 'programado'].includes(row.estado)).length;
  const today = now.toISOString().slice(0, 10);
  const ingresadosHoy = rows.filter((row) => row.creado_en.slice(0, 10) === today).length;
  let slaVencidos = 0;
  let slaPorVencer = 0;

  for (const row of rows) {
    if (row.estado === 'cerrado' || row.estado === 'solucionado') continue;
    const minutos = SLA_MINUTES[row.prioridad] ?? 1440;
    const vence = row.sla_vence_en
      ? new Date(row.sla_vence_en).getTime()
      : new Date(row.creado_en).getTime() + minutos * 60000;
    if (now.getTime() > vence) slaVencidos++;
    else if (now.getTime() >= vence - Math.min(60, minutos / 4) * 60000) slaPorVencer++;
  }

  const duraciones = rows
    .filter((row) => row.fecha_resolucion && ['cerrado', 'solucionado'].includes(row.estado))
    .map((row) => (new Date(row.fecha_resolucion!).getTime() - new Date(row.creado_en).getTime()) / 3600000)
    .filter((hours) => Number.isFinite(hours) && hours >= 0);
  const ttrHoras = duraciones.length
    ? duraciones.reduce((sum, hours) => sum + hours, 0) / duraciones.length
    : null;

  return {
    abiertos,
    slaRiesgo: slaVencidos + slaPorVencer,
    ttrHoras,
    ingresadosHoy,
    total,
    slaVencidos,
    slaPorVencer,
  };
}
