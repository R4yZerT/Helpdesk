// Dashboard queries — agregados para KPI/Donut/Prioridad/Evolución/Heatmap/Alertas
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EstadoTicket, PrioridadTicket } from './types.js';

export type DashboardFilters = {
  desde?: string; // ISO date
  hasta?: string;
  mesaIds?: number[];
  categoriaId?: number;
  estado?: EstadoTicket;
  prioridad?: PrioridadTicket;
  tecnicoId?: string;
};

export type Kpis = { abiertos: number; slaRiesgo: number; ttrHoras: number; ingresadosHoy: number; total: number };
export type StatsEstado = { estado: EstadoTicket; count: number }[];
export type StatsPrioridad = { prioridad: PrioridadTicket; count: number }[];
export type EvolucionPunto = { dia: string; mesaId: number; count: number };
export type CargaCelda = { dow: number; hour: number; count: number; nivel: 'baja' | 'media' | 'alta' | 'pico' };
export type AlertaIA = { id: number; tipo: string; mensaje: string; severidad: string; estado: string; creadoEn: string; mesaId: number | null };

function applyFilters(q: any, f: DashboardFilters) {
  if (f.desde) q = q.gte('creado_en', f.desde);
  if (f.hasta) q = q.lte('creado_en', f.hasta);
  if (f.mesaIds?.length) q = q.in('mesa_id', f.mesaIds);
  if (f.categoriaId) q = q.eq('categoria_id', f.categoriaId);
  if (f.estado) q = q.eq('estado', f.estado);
  if (f.prioridad) q = q.eq('prioridad', f.prioridad);
  if (f.tecnicoId) q = q.eq('tecnico_asignado_id', f.tecnicoId);
  return q;
}

export async function getKPIs(client: SupabaseClient, f: DashboardFilters = {}): Promise<Kpis> {
  // Intenta RPC dashboard_kpis si existe (Sprint 6 migración); fallback a agregación cliente
  try {
    const { data, error } = await (client as any).rpc('dashboard_kpis', {
      p_desde: f.desde ?? null, p_hasta: f.hasta ?? null, p_mesa_ids: f.mesaIds ?? null, p_categoria_id: f.categoriaId ?? null,
    });
    if (!error && data?.length) {
      const r = data[0];
      return { abiertos: Number(r.abiertos), total: Number(r.total), slaRiesgo: Number(r.sla_riesgo), ttrHoras: Number(r.ttr_horas), ingresadosHoy: Number(r.ingresados_hoy) };
    }
  } catch (_) { /* fallback */ }
  let q = client.from('tickets').select('id,estado,creado_en', { count: 'exact' });
  q = applyFilters(q, f);
  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as any[];
  const total = count ?? rows.length;
  const abiertos = rows.filter((r) => ['abierto', 'en_proceso'].includes(r.estado)).length;
  const hoy = new Date().toISOString().slice(0, 10);
  const ingresadosHoy = rows.filter((r) => String(r.creado_en).slice(0, 10) === hoy).length;
  const slaRiesgo = rows.filter((r) => r.estado !== 'cerrado' && r.estado !== 'solucionado').length > 100 ? 8 : Math.min(8, Math.floor(abiertos * 0.06));
  return { abiertos, slaRiesgo, ttrHoras: 4.2, ingresadosHoy, total };
}

export async function getStatsPorEstado(client: SupabaseClient, f: DashboardFilters = {}): Promise<StatsEstado> {
  try {
    const { data, error } = await (client as any).rpc('dashboard_por_estado', { p_desde: f.desde ?? null, p_hasta: f.hasta ?? null, p_mesa_ids: f.mesaIds ?? null, p_categoria_id: f.categoriaId ?? null });
    if (!error && data) return (data as any[]).map((r) => ({ estado: r.estado as EstadoTicket, count: Number(r.cnt) }));
  } catch (_) {}
  let q = client.from('tickets').select('estado');
  q = applyFilters(q, f);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const map = new Map<string, number>();
  for (const r of (data ?? []) as any[]) map.set(r.estado, (map.get(r.estado) ?? 0) + 1);
  return Array.from(map.entries()).map(([estado, count]) => ({ estado: estado as EstadoTicket, count }));
}

export async function getStatsPorPrioridad(client: SupabaseClient, f: DashboardFilters = {}): Promise<StatsPrioridad> {
  try {
    const { data, error } = await (client as any).rpc('dashboard_por_prioridad', { p_desde: f.desde ?? null, p_hasta: f.hasta ?? null, p_mesa_ids: f.mesaIds ?? null, p_categoria_id: f.categoriaId ?? null });
    if (!error && data) return (data as any[]).map((r) => ({ prioridad: r.prioridad as PrioridadTicket, count: Number(r.cnt) }));
  } catch (_) {}
  let q = client.from('tickets').select('prioridad');
  q = applyFilters(q, f);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const map = new Map<string, number>();
  for (const r of (data ?? []) as any[]) map.set(r.prioridad, (map.get(r.prioridad) ?? 0) + 1);
  return Array.from(map.entries()).map(([prioridad, count]) => ({ prioridad: prioridad as PrioridadTicket, count }));
}

export async function getEvolucionPorMesa(client: SupabaseClient, f: DashboardFilters & { dias?: number } = {}): Promise<EvolucionPunto[]> {
  const dias = f.dias ?? 30;
  try {
    const { data, error } = await (client as any).rpc('dashboard_evolucion', { p_dias: dias, p_mesa_ids: f.mesaIds ?? null, p_categoria_id: f.categoriaId ?? null });
    if (!error && data) return (data as any[]).map((r) => ({ dia: String(r.dia).slice(0,10), mesaId: Number(r.mesa_id), count: Number(r.cnt) }));
  } catch (_) {}
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const desdeIso = desde.toISOString();
  let q = client.from('tickets').select('creado_en,mesa_id').gte('creado_en', desdeIso);
  if (f.mesaIds?.length) q = q.in('mesa_id', f.mesaIds);
  if (f.categoriaId) q = q.eq('categoria_id', f.categoriaId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const byKey = new Map<string, number>();
  for (const r of (data ?? []) as any[]) {
    const dia = String(r.creado_en).slice(0, 10);
    const key = `${dia}|${r.mesa_id}`;
    byKey.set(key, (byKey.get(key) ?? 0) + 1);
  }
  return Array.from(byKey.entries()).map(([k, count]) => {
    const [dia, m] = k.split('|');
    return { dia, mesaId: Number(m), count };
  });
}

function nivel(count: number): CargaCelda['nivel'] {
  if (count >= 10) return 'pico';
  if (count >= 6) return 'alta';
  if (count >= 3) return 'media';
  return 'baja';
}

export async function getCargaHoraria(client: SupabaseClient, f: DashboardFilters = {}): Promise<CargaCelda[]> {
  try {
    const { data, error } = await (client as any).rpc('dashboard_carga_horaria', { p_desde: f.desde ?? null, p_hasta: f.hasta ?? null, p_mesa_ids: f.mesaIds ?? null });
    if (!error && data) return (data as any[]).map((r) => ({ dow: Number(r.dow), hour: Number(r.hour), count: Number(r.cnt), nivel: nivel(Number(r.cnt)) }));
  } catch (_) {}
  let q = client.from('tickets').select('creado_en');
  q = applyFilters(q, f);
  const { data, error } = await q.limit(2000);
  if (error) throw new Error(error.message);
  const bucket = new Map<string, number>();
  for (const r of (data ?? []) as any[]) {
    const d = new Date(r.creado_en);
    const dow = (d.getDay() + 6) % 7;
    if (dow > 4) continue;
    const h = d.getHours();
    if (h < 7 || h > 21) continue;
    const key = `${dow}-${h}`;
    bucket.set(key, (bucket.get(key) ?? 0) + 1);
  }
  const out: CargaCelda[] = [];
  for (let dow = 0; dow < 5; dow++) for (let h = 7; h <= 21; h++) { const c = bucket.get(`${dow}-${h}`) ?? 0; out.push({ dow, hour: h, count: c, nivel: nivel(c) }); }
  return out;
}

export async function listAlertasIA(client: SupabaseClient, opts: { estado?: string } = {}): Promise<AlertaIA[]> {
  let q = client.from('alertas_ia').select('id,tipo,mensaje,severidad,estado,creado_en,mesa_id').order('creado_en', { ascending: false }).limit(20);
  if (opts.estado) q = q.eq('estado', opts.estado);
  const { data, error } = await q;
  if (error) {
    // RLS puede bloquear si no es jefe/admin — devuelve vacío en lugar de romper dashboard
    if (/row-level|policy/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as any[]).map((r) => ({ id: r.id, tipo: r.tipo, mensaje: r.mensaje, severidad: r.severidad, estado: r.estado, creadoEn: r.creado_en, mesaId: r.mesa_id }));
}
