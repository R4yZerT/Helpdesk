// Dashboard queries — agregados para KPI/Donut/Prioridad/Evolución/Heatmap/Alertas
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EstadoTicket, PrioridadTicket } from './types.js';
import { fetchDashboardTicketRows, fetchTicketsFiltrados, type DashboardQueryFilters } from './dashboard-repository.js';
import { calcularKpisDesdeTickets } from './dashboard-analytics.js';

export { fetchTicketsFiltrados } from './dashboard-repository.js';

export type DashboardFilters = Omit<DashboardQueryFilters, 'estado' | 'prioridad'> & {
  estado?: EstadoTicket;
  prioridad?: PrioridadTicket;
};

export type Kpis = { abiertos: number; slaRiesgo: number; ttrHoras: number | null; ingresadosHoy: number; total: number; slaVencidos?: number; slaPorVencer?: number };
export type StatsEstado = { estado: EstadoTicket; count: number }[];
export type StatsPrioridad = { prioridad: PrioridadTicket; count: number }[];
export type EvolucionPunto = { dia: string; mesaId: number; count: number };
export type CargaCelda = { dow: number; hour: number; count: number; nivel: 'baja' | 'media' | 'alta' | 'pico' };
export type AlertaIA = { id: number; tipo: string; mensaje: string; severidad: string; estado: string; creadoEn: string; mesaId: number | null };
// RF-19/20
export type PicoPrediccion = { dow: number; hour: number; mesaId: number | null; mesaNombre: string | null; avgCnt: number; forecastCnt: number; nivel: 'baja'|'media'|'alta'|'pico'; esPico: boolean };
export type PicosResumen = { mesaId: number | null; mesaNombre: string | null; avgDia: number; forecast7d: number; forecast30d: number; peakHour: number | null; peakDow: number | null };
export type PatronCategoria = { categoriaId: number; subcategoria: string; dominio: string; cntActual: number; cntPrevio: number; variacionPct: number; sharePct: number; tendencia: string };

function tieneFiltrosNoSoportadosPorRpc(f: DashboardFilters): boolean {
  return Boolean(f.estado || f.prioridad || f.tecnicoId);
}

export type DashboardSnapshot = {
  kpis: Kpis;
  porEstado: StatsEstado;
  porPrioridad: StatsPrioridad;
  evolucion: EvolucionPunto[];
  carga: CargaCelda[];
};

/** Recupera cinco agregados con una sola ida a Postgres; conserva fallback legado. */
export async function getDashboardSnapshot(client: SupabaseClient, f: DashboardFilters = {}): Promise<DashboardSnapshot> {
  try {
    const { data, error } = await (client as any).rpc('dashboard_snapshot_filtrado', {
      p_desde: f.desde ?? null,
      p_hasta: f.hasta ?? null,
      p_mesa_ids: f.mesaIds ?? null,
      p_categoria_id: f.categoriaId ?? null,
      p_estado: f.estado ?? null,
      p_prioridad: f.prioridad ?? null,
      p_tecnico_id: f.tecnicoId ?? null,
    });
    if (!error && data?.kpis) {
      const number = (value: unknown) => value == null ? 0 : Number(value);
      const rows = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value : [];
      const k = data.kpis as Record<string, unknown>;
      return {
        kpis: {
          abiertos: number(k.abiertos),
          total: number(k.total),
          slaRiesgo: number(k.sla_riesgo),
          ttrHoras: k.ttr_horas == null ? null : number(k.ttr_horas),
          ingresadosHoy: number(k.ingresados_hoy),
          slaVencidos: number(k.sla_vencidos),
          slaPorVencer: number(k.sla_por_vencer),
        },
        porEstado: rows(data.estados).map((r) => ({ estado: String(r.estado) as EstadoTicket, count: number(r.count) })),
        porPrioridad: rows(data.prioridades).map((r) => ({ prioridad: String(r.prioridad) as PrioridadTicket, count: number(r.count) })),
        evolucion: rows(data.evolucion).map((r) => ({ dia: String(r.dia).slice(0, 10), mesaId: number(r.mesa_id), count: number(r.count) })),
        carga: rows(data.carga_horaria).map((r) => {
          const count = number(r.count);
          return { dow: number(r.dow), hour: number(r.hour), count, nivel: nivel(count) };
        }),
      };
    }
  } catch (_) { /* fallback a consultas individuales */ }

  const [kpis, porEstado, porPrioridad, evolucion, carga] = await Promise.all([
    getKPIs(client, f),
    getStatsPorEstado(client, f),
    getStatsPorPrioridad(client, f),
    getEvolucionPorMesa(client, { ...f, dias: 30 }),
    getCargaHoraria(client, f),
  ]);
  return { kpis, porEstado, porPrioridad, evolucion, carga };
}

/** RF-18: exporta tickets filtrados con paginación y un límite explícito. */
export async function getKPIs(client: SupabaseClient, f: DashboardFilters = {}): Promise<Kpis> {
  // El RPC agrega dentro de Postgres y aplica todos los filtros activos.
  try {
    const { data, error } = await (client as any).rpc('dashboard_kpis_filtrado', {
      p_desde: f.desde ?? null,
      p_hasta: f.hasta ?? null,
      p_mesa_ids: f.mesaIds ?? null,
      p_categoria_id: f.categoriaId ?? null,
      p_estado: f.estado ?? null,
      p_prioridad: f.prioridad ?? null,
      p_tecnico_id: f.tecnicoId ?? null,
    });
    if (!error && data?.length) {
      const r = data[0];
      return { abiertos: Number(r.abiertos), total: Number(r.total), slaRiesgo: Number(r.sla_riesgo), ttrHoras: r.ttr_horas == null ? null : Number(r.ttr_horas), ingresadosHoy: Number(r.ingresados_hoy), slaVencidos: r.sla_vencidos != null ? Number(r.sla_vencidos) : undefined, slaPorVencer: r.sla_por_vencer != null ? Number(r.sla_por_vencer) : undefined };
    }
  } catch (_) { /* fallback */ }
  const rows = await fetchDashboardTicketRows(
    client,
    'estado,prioridad,creado_en,sla_vence_en,fecha_resolucion',
    f,
  );
  return calcularKpisDesdeTickets(rows);
}

export async function getStatsPorEstado(client: SupabaseClient, f: DashboardFilters = {}): Promise<StatsEstado> {
  try {
    if (tieneFiltrosNoSoportadosPorRpc(f)) throw new Error('El RPC aún no acepta todos los filtros');
    const { data, error } = await (client as any).rpc('dashboard_por_estado', { p_desde: f.desde ?? null, p_hasta: f.hasta ?? null, p_mesa_ids: f.mesaIds ?? null, p_categoria_id: f.categoriaId ?? null });
    if (!error && data) return (data as any[]).map((r) => ({ estado: r.estado as EstadoTicket, count: Number(r.cnt) }));
  } catch (_) { /* fallback local sin RPC */ }
  const data = await fetchDashboardTicketRows(client, 'estado', f);
  const map = new Map<string, number>();
  for (const r of data) map.set(r.estado, (map.get(r.estado) ?? 0) + 1);
  return Array.from(map.entries()).map(([estado, count]) => ({ estado: estado as EstadoTicket, count }));
}

export async function getStatsPorPrioridad(client: SupabaseClient, f: DashboardFilters = {}): Promise<StatsPrioridad> {
  try {
    if (tieneFiltrosNoSoportadosPorRpc(f)) throw new Error('El RPC aún no acepta todos los filtros');
    const { data, error } = await (client as any).rpc('dashboard_por_prioridad', { p_desde: f.desde ?? null, p_hasta: f.hasta ?? null, p_mesa_ids: f.mesaIds ?? null, p_categoria_id: f.categoriaId ?? null });
    if (!error && data) return (data as any[]).map((r) => ({ prioridad: r.prioridad as PrioridadTicket, count: Number(r.cnt) }));
  } catch (_) { /* fallback local sin RPC */ }
  const data = await fetchDashboardTicketRows(client, 'prioridad', f);
  const map = new Map<string, number>();
  for (const r of data) map.set(r.prioridad, (map.get(r.prioridad) ?? 0) + 1);
  return Array.from(map.entries()).map(([prioridad, count]) => ({ prioridad: prioridad as PrioridadTicket, count }));
}

export async function getEvolucionPorMesa(client: SupabaseClient, f: DashboardFilters & { dias?: number } = {}): Promise<EvolucionPunto[]> {
  const dias = f.dias ?? 30;
  try {
    if (tieneFiltrosNoSoportadosPorRpc(f) || f.desde || f.hasta) throw new Error('El RPC aún no acepta todos los filtros');
    const { data, error } = await (client as any).rpc('dashboard_evolucion', { p_dias: dias, p_mesa_ids: f.mesaIds ?? null, p_categoria_id: f.categoriaId ?? null });
    if (!error && data) return (data as any[]).map((r) => ({ dia: String(r.dia).slice(0,10), mesaId: Number(r.mesa_id), count: Number(r.cnt) }));
  } catch (_) { /* fallback local sin RPC */ }
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const filas = await fetchDashboardTicketRows(client, 'creado_en,mesa_id', {
    ...f,
    desde: f.desde ?? desde.toISOString(),
  });
  const byKey = new Map<string, number>();
  for (const r of filas) {
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
    if (tieneFiltrosNoSoportadosPorRpc(f) || f.categoriaId) throw new Error('El RPC aún no acepta todos los filtros');
    const { data, error } = await (client as any).rpc('dashboard_carga_horaria', { p_desde: f.desde ?? null, p_hasta: f.hasta ?? null, p_mesa_ids: f.mesaIds ?? null });
    if (!error && data) return (data as any[]).map((r) => ({ dow: Number(r.dow), hour: Number(r.hour), count: Number(r.cnt), nivel: nivel(Number(r.cnt)) }));
  } catch (_) { /* fallback local sin RPC */ }
  const data = await fetchDashboardTicketRows(client, 'creado_en', f);
  const bucket = new Map<string, number>();
  for (const r of data) {
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
    if (tieneFiltrosNoSoportadosPorRpc(f) || f.desde || f.hasta) throw new Error('El RPC aún no acepta todos los filtros');
    const { data, error } = await (client as any).rpc('dashboard_picos_prediccion', { p_dias: dias, p_mesa_ids: f.mesaIds ?? null, p_categoria_id: f.categoriaId ?? null });
    if (!error && data) return (data as any[]).map((r) => ({ dow: Number(r.dow), hour: Number(r.hour), mesaId: r.mesa_id != null ? Number(r.mesa_id) : null, mesaNombre: r.mesa_nombre ?? null, avgCnt: Number(r.avg_cnt), forecastCnt: Number(r.forecast_cnt), nivel: r.nivel as any, esPico: Boolean(r.es_pico) }));
  } catch (_) { /* fallback local sin RPC */ }
  // fallback: promedio histórico por dow/hour desde tickets (sin estacionalidad)
  const desde = new Date(); desde.setDate(desde.getDate() - dias);
  const data = await fetchDashboardTicketRows(client, 'creado_en,mesa_id', {
    ...f,
    desde: f.desde ?? desde.toISOString(),
  });
  const weeks = Math.max(dias / 7, 1);
  const bucket = new Map<string,{cnt:number, mesaId:number|null}>();
  for (const r of data) {
    const d = new Date(r.creado_en); const dow=(d.getDay()+6)%7; if (dow>4) continue; const h=d.getHours(); if (h<7||h>21) continue;
    const key=`${dow}-${h}-${r.mesa_id ?? 'null'}`; const b=bucket.get(key) ?? {cnt:0, mesaId:r.mesa_id ?? null}; b.cnt++; bucket.set(key,b);
  }
  const niv = (v:number)=> v>=10?'pico':v>=6?'alta':v>=3?'media':'baja' as const;
  const out: PicoPrediccion[] = [];
  for (const [k,v] of bucket) { const [dow,h]=k.split('-'); const avg=v.cnt/weeks; out.push({ dow:Number(dow), hour:Number(h), mesaId:v.mesaId, mesaNombre:null, avgCnt:Number(avg.toFixed(2)), forecastCnt:Number(avg.toFixed(2)), nivel:niv(avg), esPico: avg>=6 }); }
  return out.sort((a,b)=>b.forecastCnt-a.forecastCnt).slice(0,60);
}
export async function getPicosResumen(client: SupabaseClient, f: DashboardFilters & { dias?: number } = {}): Promise<PicosResumen[]> {
  // Este resumen persistido solo se puede segmentar por mesa; no mezclarlo con
  // filtros de categoría/estado/prioridad/técnico que el modelo no recibió.
  if (f.categoriaId || tieneFiltrosNoSoportadosPorRpc(f)) return [];
  const dias = f.dias ?? 30;
  if (f.hasta) return [];
  if (f.desde) {
    const inicioEsperado = Date.now() - dias * 86400000;
    if (!Number.isFinite(new Date(f.desde).getTime()) || Math.abs(new Date(f.desde).getTime() - inicioEsperado) > 86400000) return [];
  }
  try {
    const { data, error } = await (client as any).rpc('dashboard_picos_resumen', { p_dias: dias, p_mesa_ids: f.mesaIds ?? null });
    if (!error && data) return (data as any[]).map((r)=>({ mesaId:r.mesa_id!=null?Number(r.mesa_id):null, mesaNombre:r.mesa_nombre??null, avgDia:Number(r.avg_dia), forecast7d:Number(r.forecast_7d), forecast30d:Number(r.forecast_30d), peakHour:r.peak_hour!=null?Number(r.peak_hour):null, peakDow:r.peak_dow!=null?Number(r.peak_dow):null }));
  } catch (_) { /* fallback local sin RPC */ }
  return [];
}
export async function getPatronesCategoria(client: SupabaseClient, f: DashboardFilters & { dias?: number } = {}): Promise<PatronCategoria[]> {
  const dias = f.dias ?? 30;
  try {
    if (tieneFiltrosNoSoportadosPorRpc(f) || f.categoriaId || f.hasta || f.desde) {
      throw new Error('El RPC aún no acepta todos los filtros');
    }
    const { data, error } = await (client as any).rpc('dashboard_patrones_categoria', { p_dias: dias, p_mesa_ids: f.mesaIds ?? null });
    if (!error && data) return (data as any[]).map((r)=>({ categoriaId:Number(r.categoria_id), subcategoria:r.subcategoria, dominio:r.dominio, cntActual:Number(r.cnt_actual), cntPrevio:Number(r.cnt_previo), variacionPct:Number(r.variacion_pct), sharePct:Number(r.share_pct), tendencia:String(r.tendencia) }));
  } catch (_) { /* fallback local sin RPC */ }
  // fallback paginado: compara periodos sin truncar resultados ni omitir filtros.
  const ahora = new Date();
  const desdeActual = f.desde ? new Date(f.desde) : new Date(ahora.getTime() - dias * 86400000);
  const hastaActual = f.hasta ? new Date(f.hasta) : ahora;
  const duracion = Math.max(1, hastaActual.getTime() - desdeActual.getTime());
  const desdePrevio = new Date(desdeActual.getTime() - duracion);
  const filtrosActuales = { ...f, desde: desdeActual.toISOString(), hasta: hastaActual.toISOString() };
  const filtrosPrevios = { ...f, desde: desdePrevio.toISOString(), hasta: new Date(desdeActual.getTime() - 1).toISOString() };
  const [filasActuales, filasPrevias] = await Promise.all([
    fetchDashboardTicketRows(client, 'categoria_id', filtrosActuales),
    fetchDashboardTicketRows(client, 'categoria_id', filtrosPrevios),
  ]);
  const ca=new Map<number,number>(), cp=new Map<number,number>();
  for(const r of filasActuales) ca.set(r.categoria_id,(ca.get(r.categoria_id)??0)+1);
  for(const r of filasPrevias) cp.set(r.categoria_id,(cp.get(r.categoria_id)??0)+1);
  const totalAct=[...ca.values()].reduce((s,n)=>s+n,0)||1; const ids=new Set([...ca.keys(),...cp.keys()]);
  // nombres: intentar fetch
  const names=new Map<number,{subcategoria:string,dominio:string}>(); try{ const {data: cats}=await (client.from('ticket_categories').select('id,subcategoria,dominio') as any); for(const c of (cats??[]) as any[]) names.set(c.id,{subcategoria:c.subcategoria??String(c.id),dominio:c.dominio}); }catch(_){ /* sin nombres: usa id */ }
  const out:PatronCategoria[]=[]; for(const id of ids){ const act=ca.get(id)??0, prev=cp.get(id)??0; const vari= prev===0? (act>0?100:0) : Number(((act-prev)/prev*100).toFixed(1)); const share=Number((act/totalAct*100).toFixed(1)); let tendencia='estable'; if(act===0) tendencia='sin_demanda'; else if(prev===0&&act>=5) tendencia='nueva_alta'; else if(prev>0&&act/prev>=1.5) tendencia='al_alza'; else if(prev>0&&act/prev<=0.6) tendencia='a_la_baja'; const n=names.get(id)??{subcategoria:String(id),dominio:'—'}; out.push({categoriaId:id, subcategoria:n.subcategoria, dominio:n.dominio, cntActual:act, cntPrevio:prev, variacionPct:vari, sharePct:share, tendencia}); }
  return out.sort((a,b)=>b.cntActual-a.cntActual).slice(0,30);
}

export async function generarAlertasIA(client: any): Promise<number> {
  const { data, error } = await client.rpc('generar_alertas_ia');
  if (error) throw new Error(error.message);
  if (Array.isArray(data)) return Number(data[0]?.insertados ?? 0);
  return Number((data as any)?.insertados ?? 0);
}

// ── Pronóstico ML (tabla pronosticos_picos; [] si la migración aún no se aplicó) ──
// B (rangos): lo/hi = banda q10–q90 calibrada; null = fila anterior a la migración.
// C (frescura): generadoEn = instante UTC en que el pipeline generó el forecast.
export type PronosticoDia = {
  fecha: string; serie: string; forecast: number; nivel: string; esPico: boolean;
  modeloVersion: string | null; lo?: number | null; hi?: number | null; generadoEn?: string | null;
};
const SELECT_PRONOSTICO = 'fecha,serie,forecast,nivel,es_pico,modelo_version,lo,hi,generado_en';
const SELECT_PRONOSTICO_LEGACY = 'fecha,serie,forecast,nivel,es_pico,modelo_version';
function mapearPronosticoDia(r: any): PronosticoDia {
  return {
    fecha: String(r.fecha).slice(0, 10), serie: r.serie, forecast: Number(r.forecast),
    nivel: r.nivel, esPico: Boolean(r.es_pico), modeloVersion: r.modelo_version ?? null,
    lo: r.lo == null ? null : Number(r.lo), hi: r.hi == null ? null : Number(r.hi),
    generadoEn: r.generado_en ?? null,
  };
}
export async function getPronosticoSemanal(client: SupabaseClient): Promise<PronosticoDia[]> {
  try {
    const hoy = new Date().toISOString().slice(0, 10);
    // `from()` fresco por intento: no se reusa el builder entre el select con
    // rangos y el fallback legacy (postgrest-js muta el builder en cada llamada).
    const pedir = (cols: string) => (client.from('pronosticos_picos') as any)
      .select(cols).gte('fecha', hoy).order('fecha', { ascending: true }).limit(28);
    let { data, error } = await pedir(SELECT_PRONOSTICO);
    if (error) {
      // Compatibilidad: BD sin la migración de rangos (sin columnas lo/hi/generado_en)
      const legacy = await pedir(SELECT_PRONOSTICO_LEGACY);
      data = legacy.data;
      error = legacy.error;
    }
    if (error || !data) return [];
    return (data as any[]).map(mapearPronosticoDia);
  } catch (_) { return []; }
}

export type PronosticoSerieResumen = {
  serie: string; total7d: number; diasPico: number;
  maxForecast: number; maxFecha: string | null; modeloVersion: string | null;
};

// RF-19/B3 — resume el pronóstico ML por serie para el Dashboard.
// Puro y testeado: agrupa días por serie (7 próximos días por serie).
export function resumirPronosticoML(dias: PronosticoDia[]): PronosticoSerieResumen[] {
  const porSerie = new Map<string, PronosticoDia[]>();
  for (const d of dias) {
    const arr = porSerie.get(d.serie) ?? [];
    arr.push(d);
    porSerie.set(d.serie, arr);
  }
  const out: PronosticoSerieResumen[] = [];
  for (const [serie, arr] of porSerie) {
    const prox = [...arr].sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).slice(0, 7);
    let pico = prox[0] ?? null;
    for (const d of prox) if (d.forecast > (pico?.forecast ?? -Infinity)) pico = d;
    out.push({
      serie,
      total7d: Math.round(prox.reduce((s, d) => s + d.forecast, 0) * 10) / 10,
      diasPico: prox.filter((d) => d.esPico).length,
      maxForecast: pico?.forecast ?? 0,
      maxFecha: pico?.fecha ?? null,
      modeloVersion: pico?.modeloVersion ?? prox[0]?.modeloVersion ?? null,
    });
  }
  return out.sort((a, b) => b.total7d - a.total7d);
}

// C (forecast fresco) — estado del pronóstico según edad del generado_en más reciente.
// El pipeline corre los lunes 06:00 UTC: <5d vigente, 5–8d próximo a vencer, >8d vencido
// (se saltó una corrida), sin generado_en o vacío = sin datos. Puro y testeado.
export type FrescuraPronostico = 'vigente' | 'proximo_a_vencer' | 'vencido' | 'sin_datos';
export function estadoFrescuraPronostico(
  dias: PronosticoDia[], ahora: Date = new Date(),
): { estado: FrescuraPronostico; generadoEn: string | null; edadDias: number | null } {
  const stamps = dias.map((d) => d.generadoEn).filter((g): g is string => !!g);
  if (!dias.length || !stamps.length) return { estado: 'sin_datos', generadoEn: null, edadDias: null };
  const generadoEn = stamps.sort()[stamps.length - 1]!;
  const edadDias = Math.max(0, (ahora.getTime() - new Date(generadoEn).getTime()) / 86400000);
  if (Number.isNaN(edadDias)) return { estado: 'sin_datos', generadoEn, edadDias: null };
  const estado: FrescuraPronostico = edadDias > 8 ? 'vencido' : edadDias > 5 ? 'proximo_a_vencer' : 'vigente';
  return { estado, generadoEn, edadDias: Math.round(edadDias * 10) / 10 };
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

// ── Telemetría IA (vista metricas_ia_feedback; [] si la migración aún no se aplicó) ──
export type MetricaIaFuente = {
  fuente: string; total: number; pendientes: number;
  confirmadas: number; corregidas: number;
  precisionValidada: number | null; confianzaPromedio: number | null;
};
export async function getMetricasIaFeedback(client: SupabaseClient): Promise<MetricaIaFuente[]> {
  try {
    const { data, error } = await (client.from('metricas_ia_feedback') as any)
      .select('fuente,total,pendientes,confirmadas,corregidas,precision_validada,confianza_promedio')
      .order('total', { ascending: false });
    if (error || !data) return [];
    return (data as any[]).map((r) => ({
      fuente: String(r.fuente), total: Number(r.total), pendientes: Number(r.pendientes),
      confirmadas: Number(r.confirmadas), corregidas: Number(r.corregidas),
      precisionValidada: r.precision_validada != null ? Number(r.precision_validada) : null,
      confianzaPromedio: r.confianza_promedio != null ? Number(r.confianza_promedio) : null,
    }));
  } catch (_) { return []; }
}
