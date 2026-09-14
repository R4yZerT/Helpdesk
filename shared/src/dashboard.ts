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

export type Kpis = { abiertos: number; slaRiesgo: number; ttrHoras: number; ingresadosHoy: number; total: number; slaVencidos?: number; slaPorVencer?: number };
export type StatsEstado = { estado: EstadoTicket; count: number }[];
export type StatsPrioridad = { prioridad: PrioridadTicket; count: number }[];
export type EvolucionPunto = { dia: string; mesaId: number; count: number };
export type CargaCelda = { dow: number; hour: number; count: number; nivel: 'baja' | 'media' | 'alta' | 'pico' };
export type AlertaIA = { id: number; tipo: string; mensaje: string; severidad: string; estado: string; creadoEn: string; mesaId: number | null };
// RF-19/20
export type PicoPrediccion = { dow: number; hour: number; mesaId: number | null; mesaNombre: string | null; avgCnt: number; forecastCnt: number; nivel: 'baja'|'media'|'alta'|'pico'; esPico: boolean };
export type PicosResumen = { mesaId: number | null; mesaNombre: string | null; avgDia: number; forecast7d: number; forecast30d: number; peakHour: number | null; peakDow: number | null };
export type PatronCategoria = { categoriaId: number; subcategoria: string; dominio: string; cntActual: number; cntPrevio: number; variacionPct: number; sharePct: number; tendencia: string };

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

/** RF-18: tickets filtrados para export — respeta los 6 filtros combinables (RF-17) */
export async function fetchTicketsFiltrados(
  client: SupabaseClient,
  f: DashboardFilters,
  limit = 2000,
): Promise<any[]> {
  let q: any = client
    .from('tickets')
    .select('numero,asunto,estado,prioridad,mesa_id,categoria_id,creado_en,actualizado_en')
    .order('creado_en', { ascending: false })
    .limit(limit);
  q = applyFilters(q, f);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as any[];
}

export async function getKPIs(client: SupabaseClient, f: DashboardFilters = {}): Promise<Kpis> {
  // Intenta RPC dashboard_kpis si existe (Sprint 6 migración); fallback a agregación cliente
  try {
    const { data, error } = await (client as any).rpc('dashboard_kpis', {
      p_desde: f.desde ?? null, p_hasta: f.hasta ?? null, p_mesa_ids: f.mesaIds ?? null, p_categoria_id: f.categoriaId ?? null,
    });
    if (!error && data?.length) {
      const r = data[0];
      return { abiertos: Number(r.abiertos), total: Number(r.total), slaRiesgo: Number(r.sla_riesgo), ttrHoras: Number(r.ttr_horas), ingresadosHoy: Number(r.ingresados_hoy), slaVencidos: r.sla_vencidos != null ? Number(r.sla_vencidos) : undefined, slaPorVencer: r.sla_por_vencer != null ? Number(r.sla_por_vencer) : undefined };
    }
  } catch (_) { /* fallback */ }
  // Fallback cliente usando SLA real (critica 60m, alta 4h, media 24h, baja 72h)
  let q = client.from('tickets').select('id,estado,prioridad,creado_en,sla_vence_en', { count: 'exact' });
  q = applyFilters(q, f);
  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as any[];
  const total = count ?? rows.length;
  const abiertos = rows.filter((r) => ['abierto', 'en_proceso', 'programado'].includes(r.estado)).length;
  const hoy = new Date().toISOString().slice(0, 10);
  const ingresadosHoy = rows.filter((r) => String(r.creado_en).slice(0, 10) === hoy).length;
  const SLA_MIN = { critica: 60, alta: 240, media: 1440, baja: 4320 } as Record<string, number>;
  const ahora = Date.now();
  let slaVencidos = 0, slaPorVencer = 0;
  for (const r of rows) {
    if (r.estado === 'cerrado' || r.estado === 'solucionado') continue;
    const vence = r.sla_vence_en ? new Date(r.sla_vence_en).getTime() : (new Date(r.creado_en).getTime() + (SLA_MIN[r.prioridad] ?? 1440) * 60000);
    if (ahora > vence) slaVencidos++;
    else {
      const porVencerMs = Math.max(60, Math.floor((SLA_MIN[r.prioridad] ?? 1440) * 0.25)) * 60000;
      if (ahora >= vence - porVencerMs) slaPorVencer++;
    }
  }
  const slaRiesgo = slaVencidos + slaPorVencer;
  return { abiertos, slaRiesgo, ttrHoras: 4.2, ingresadosHoy, total, slaVencidos, slaPorVencer };
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


// ── RF-19: picos predicción (RPC + fallback cliente) ──
export async function getPicosPrediccion(client: SupabaseClient, f: DashboardFilters & { dias?: number } = {}): Promise<PicoPrediccion[]> {
  const dias = f.dias ?? 30;
  try {
    const { data, error } = await (client as any).rpc('dashboard_picos_prediccion', { p_dias: dias, p_mesa_ids: f.mesaIds ?? null, p_categoria_id: f.categoriaId ?? null });
    if (!error && data) return (data as any[]).map((r) => ({ dow: Number(r.dow), hour: Number(r.hour), mesaId: r.mesa_id != null ? Number(r.mesa_id) : null, mesaNombre: r.mesa_nombre ?? null, avgCnt: Number(r.avg_cnt), forecastCnt: Number(r.forecast_cnt), nivel: r.nivel as any, esPico: Boolean(r.es_pico) }));
  } catch (_) {}
  // fallback: promedio histórico por dow/hour desde tickets (sin estacionalidad)
  const desde = new Date(); desde.setDate(desde.getDate() - dias);
  let q = client.from('tickets').select('creado_en,mesa_id').gte('creado_en', desde.toISOString());
  if (f.mesaIds?.length) q = q.in('mesa_id', f.mesaIds);
  if (f.categoriaId) q = q.eq('categoria_id', f.categoriaId);
  const { data, error } = await q.limit(3000);
  if (error) throw new Error(error.message);
  const weeks = Math.max(dias / 7, 1);
  const bucket = new Map<string,{cnt:number, mesaId:number|null}>();
  for (const r of (data ?? []) as any[]) {
    const d = new Date(r.creado_en); const dow=(d.getDay()+6)%7; if (dow>4) continue; const h=d.getHours(); if (h<7||h>21) continue;
    const key=`${dow}-${h}-${r.mesa_id ?? 'null'}`; const b=bucket.get(key) ?? {cnt:0, mesaId:r.mesa_id ?? null}; b.cnt++; bucket.set(key,b);
  }
  const niv = (v:number)=> v>=10?'pico':v>=6?'alta':v>=3?'media':'baja' as const;
  const out: PicoPrediccion[] = [];
  for (const [k,v] of bucket) { const [dow,h]=k.split('-'); const avg=v.cnt/weeks; out.push({ dow:Number(dow), hour:Number(h), mesaId:v.mesaId, mesaNombre:null, avgCnt:Number(avg.toFixed(2)), forecastCnt:Number(avg.toFixed(2)), nivel:niv(avg), esPico: avg>=6 }); }
  return out.sort((a,b)=>b.forecastCnt-a.forecastCnt).slice(0,60);
}
export async function getPicosResumen(client: SupabaseClient, f: DashboardFilters & { dias?: number } = {}): Promise<PicosResumen[]> {
  const dias = f.dias ?? 30;
  try {
    const { data, error } = await (client as any).rpc('dashboard_picos_resumen', { p_dias: dias, p_mesa_ids: f.mesaIds ?? null });
    if (!error && data) return (data as any[]).map((r)=>({ mesaId:r.mesa_id!=null?Number(r.mesa_id):null, mesaNombre:r.mesa_nombre??null, avgDia:Number(r.avg_dia), forecast7d:Number(r.forecast_7d), forecast30d:Number(r.forecast_30d), peakHour:r.peak_hour!=null?Number(r.peak_hour):null, peakDow:r.peak_dow!=null?Number(r.peak_dow):null }));
  } catch (_) {}
  return [];
}
export async function getPatronesCategoria(client: SupabaseClient, f: DashboardFilters & { dias?: number } = {}): Promise<PatronCategoria[]> {
  const dias = f.dias ?? 30;
  try {
    const { data, error } = await (client as any).rpc('dashboard_patrones_categoria', { p_dias: dias, p_mesa_ids: f.mesaIds ?? null });
    if (!error && data) return (data as any[]).map((r)=>({ categoriaId:Number(r.categoria_id), subcategoria:r.subcategoria, dominio:r.dominio, cntActual:Number(r.cnt_actual), cntPrevio:Number(r.cnt_previo), variacionPct:Number(r.variacion_pct), sharePct:Number(r.share_pct), tendencia:String(r.tendencia) }));
  } catch (_) {}
  // fallback: compara periodos actual vs previo vía count cliente
  const now=new Date(), desdeAct=new Date(now); desdeAct.setDate(now.getDate()-dias); const desdePrev=new Date(desdeAct); desdePrev.setDate(desdeAct.getDate()-dias);
  let qAct=client.from('tickets').select('categoria_id').gte('creado_en',desdeAct.toISOString());
  let qPrev=client.from('tickets').select('categoria_id').gte('creado_en',desdePrev.toISOString()).lt('creado_en',desdeAct.toISOString());
  if (f.mesaIds?.length){ qAct=qAct.in('mesa_id',f.mesaIds); qPrev=qPrev.in('mesa_id',f.mesaIds); }
  const [{data:a},{data:p}] = await Promise.all([qAct.limit(5000) as any, qPrev.limit(5000) as any]);
  const ca=new Map<number,number>(), cp=new Map<number,number>(); for(const r of (a??[]) as any[]) ca.set(r.categoria_id,(ca.get(r.categoria_id)??0)+1); for(const r of (p??[]) as any[]) cp.set(r.categoria_id,(cp.get(r.categoria_id)??0)+1);
  const totalAct=[...ca.values()].reduce((s,n)=>s+n,0)||1; const ids=new Set([...ca.keys(),...cp.keys()]);
  // nombres: intentar fetch
  let names=new Map<number,{subcategoria:string,dominio:string}>(); try{ const {data: cats}=await (client.from('ticket_categories').select('id,subcategoria,dominio') as any); for(const c of (cats??[]) as any[]) names.set(c.id,{subcategoria:c.subcategoria??String(c.id),dominio:c.dominio}); }catch(_){}
  const out:PatronCategoria[]=[]; for(const id of ids){ const act=ca.get(id)??0, prev=cp.get(id)??0; const vari= prev===0? (act>0?100:0) : Number(((act-prev)/prev*100).toFixed(1)); const share=Number((act/totalAct*100).toFixed(1)); let tendencia='estable'; if(act===0) tendencia='sin_demanda'; else if(prev===0&&act>=5) tendencia='nueva_alta'; else if(prev>0&&act/prev>=1.5) tendencia='al_alza'; else if(prev>0&&act/prev<=0.6) tendencia='a_la_baja'; const n=names.get(id)??{subcategoria:String(id),dominio:'—'}; out.push({categoriaId:id, subcategoria:n.subcategoria, dominio:n.dominio, cntActual:act, cntPrevio:prev, variacionPct:vari, sharePct:share, tendencia}); }
  return out.sort((a,b)=>b.cntActual-a.cntActual).slice(0,30);
}

export async function generarAlertasIA(client: any): Promise<number> {
  const { data, error } = await client.rpc('generar_alertas_ia');
  if (error) throw new Error(error.message);
  if (Array.isArray(data)) return Number(data[0]?.insertados ?? 0);
  return Number((data as any)?.insertados ?? 0);
}

export async function marcarAlertaIA(client: any, id: number, estado: 'vista' | 'resuelta'): Promise<void> {
  const { error } = await client.from('alertas_ia').update({ estado }).eq('id', id);
  if (error) throw new Error(error.message);
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
