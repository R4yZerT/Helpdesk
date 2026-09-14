// Auto-asignación sugerida con confirmación humana + afinidades de técnico.
// Contrato espejo de supabase/migrations/20260918000000_autoasignacion.sql:
// public.tecnico_afinidades (tecnico_id, categoria_id, peso 1-3).
//
// Scoring puro (testeable sin DB):
//   carga = Σ peso(prioridad) de tickets activos del técnico
//     (critica=4, alta=3, media=2, baja=1 — espejo de PRIORIDAD_PESO en tickets.ts)
//   ajustada = carga - AFINIDAD_BOOST * pesoAfinidad(categoria)
//   orden: menor ajustada primero; desempate por menor asignación reciente (30d),
//   luego por id para estabilidad.
//
// Fetchers Supabase + orquestador sugerirAsignacion() para las pantallas de creación.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PrioridadTicket } from './types.js';
import { PRIORIDAD_PESO } from './tickets.js';

// Cada punto de afinidad compensa esta carga ponderada (equivale a ~1 ticket medio)
export const AFINIDAD_BOOST = 2;
// Ventana de "asignación reciente" para desempate (días)
export const RECIENTES_DIAS = 30;
// Estados que cuentan como carga activa
export const ESTADOS_ACTIVOS = ['abierto', 'en_proceso', 'programado', 'devuelto'] as const;

export type TecnicoAfinidad = {
  tecnicoId: string;
  categoriaId: number;
  peso: number; // 1-3
  creadoEn: string;
};

export function validateAfinidad(tecnicoId: string, categoriaId: number, peso: number): string | null {
  if (!tecnicoId || typeof tecnicoId !== 'string' || !tecnicoId.trim()) return 'Técnico requerido';
  if (!Number.isInteger(categoriaId) || categoriaId <= 0) return 'Categoría inválida';
  if (!Number.isInteger(peso) || peso < 1 || peso > 3) return 'Peso 1-3';
  return null;
}

// ---------------------------------------------------------------------------
// Scoring puro
// ---------------------------------------------------------------------------

export type CargaEntrada = {
  tecnicoId: string;
  fullName?: string;
  mesaId?: number | null;
  /** tickets activos con su prioridad */
  activos: Array<{ prioridad: PrioridadTicket }>;
  /** peso de afinidad para la categoría del ticket (0 = sin afinidad) */
  afinidadPeso?: number;
  /** tickets asignados en los últimos 30d (desempate) */
  recientes?: number;
};

export type TecnicoScored = {
  tecnicoId: string;
  fullName?: string;
  mesaId?: number | null;
  carga: number;
  afinidadPeso: number;
  recientes: number;
  ajustada: number;
};

export function cargaPonderada(activos: Array<{ prioridad: PrioridadTicket }>): number {
  return activos.reduce((acc, t) => acc + (PRIORIDAD_PESO[t.prioridad] ?? 2), 0);
}

export function scoreTecnicos(entrada: CargaEntrada[]): TecnicoScored[] {
  return entrada.map((e) => {
    const carga = cargaPonderada(e.activos);
    const afinidadPeso = e.afinidadPeso ?? 0;
    const recientes = e.recientes ?? 0;
    return {
      tecnicoId: e.tecnicoId,
      fullName: e.fullName,
      mesaId: e.mesaId,
      carga,
      afinidadPeso,
      recientes,
      ajustada: carga - AFINIDAD_BOOST * afinidadPeso,
    };
  });
}

export type SugerenciaTecnico = {
  tecnicoId: string;
  fullName?: string;
  carga: number;
  afinidadPeso: number;
  recientes: number;
  motivo: string;
};

/** Elige el mejor técnico: menor carga ajustada, desempate por recientes, luego id. */
export function sugerirTecnico(scored: TecnicoScored[]): SugerenciaTecnico | null {
  if (!scored.length) return null;
  const ord = [...scored].sort((a, b) => {
    if (a.ajustada !== b.ajustada) return a.ajustada - b.ajustada;
    if (a.recientes !== b.recientes) return a.recientes - b.recientes;
    return a.tecnicoId.localeCompare(b.tecnicoId);
  });
  const w = ord[0]!;
  const partes: string[] = [`carga ${w.carga}`];
  if (w.afinidadPeso > 0) partes.push(`afinidad peso ${w.afinidadPeso}`);
  else partes.push('sin afinidad');
  partes.push(`${w.recientes} recientes`);
  return {
    tecnicoId: w.tecnicoId,
    fullName: w.fullName,
    carga: w.carga,
    afinidadPeso: w.afinidadPeso,
    recientes: w.recientes,
    motivo: `carga + afinidad (${partes.join(' · ')})`,
  };
}

// ---------------------------------------------------------------------------
// Fetchers Supabase
// ---------------------------------------------------------------------------

export async function listAfinidadesPorTecnico(
  supabase: SupabaseClient,
  tecnicoId: string,
): Promise<TecnicoAfinidad[]> {
  const { data, error } = await (supabase.from('tecnico_afinidades') as any)
    .select('tecnico_id, categoria_id, peso, creado_en')
    .eq('tecnico_id', tecnicoId)
    .order('categoria_id', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<{ tecnico_id: string; categoria_id: number; peso: number; creado_en: string }>).map(
    (r) => ({ tecnicoId: r.tecnico_id, categoriaId: r.categoria_id, peso: r.peso, creadoEn: r.creado_en }),
  );
}

export async function listAfinidadesPorCategoria(
  supabase: SupabaseClient,
  categoriaId: number,
): Promise<TecnicoAfinidad[]> {
  const { data, error } = await (supabase.from('tecnico_afinidades') as any)
    .select('tecnico_id, categoria_id, peso, creado_en')
    .eq('categoria_id', categoriaId)
    .order('peso', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<{ tecnico_id: string; categoria_id: number; peso: number; creado_en: string }>).map(
    (r) => ({ tecnicoId: r.tecnico_id, categoriaId: r.categoria_id, peso: r.peso, creadoEn: r.creado_en }),
  );
}

/** Crea/actualiza afinidad (upsert por par). Requiere RLS admin. */
export async function setAfinidad(
  supabase: SupabaseClient,
  tecnicoId: string,
  categoriaId: number,
  peso: number,
): Promise<TecnicoAfinidad> {
  const err = validateAfinidad(tecnicoId, categoriaId, peso);
  if (err) throw new Error(err);
  const { data, error } = await (supabase.from('tecnico_afinidades') as any)
    .upsert({ tecnico_id: tecnicoId, categoria_id: categoriaId, peso }, { onConflict: 'tecnico_id,categoria_id' })
    .select('tecnico_id, categoria_id, peso, creado_en')
    .single();
  if (error) throw error;
  const r = data as { tecnico_id: string; categoria_id: number; peso: number; creado_en: string };
  return { tecnicoId: r.tecnico_id, categoriaId: r.categoria_id, peso: r.peso, creadoEn: r.creado_en };
}

export async function removeAfinidad(
  supabase: SupabaseClient,
  tecnicoId: string,
  categoriaId: number,
): Promise<void> {
  const { error } = await (supabase.from('tecnico_afinidades') as any)
    .delete()
    .eq('tecnico_id', tecnicoId)
    .eq('categoria_id', categoriaId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Orquestador: sugerencia completa mesa + técnico
// ---------------------------------------------------------------------------

export type SugerenciaAsignacion = {
  mesaId: number;
  tecnicoId: string | null;
  tecnicoNombre?: string;
  motivo: string;
};

export async function sugerirAsignacion(
  supabase: SupabaseClient,
  input: { mesaId: number; categoriaId: number },
): Promise<SugerenciaAsignacion> {
  const { mesaId, categoriaId } = input;
  if (!Number.isInteger(mesaId) || mesaId <= 0) throw new Error('Mesa inválida');
  if (!Number.isInteger(categoriaId) || categoriaId <= 0) throw new Error('Categoría inválida');

  // Técnicos activos de la mesa
  const { data: tecs, error: tecErr } = await (supabase.from('profiles') as any)
    .select('id, full_name, mesa_id')
    .eq('rol', 'tecnico')
    .eq('activo', true)
    .eq('mesa_id', mesaId)
    .order('full_name', { ascending: true });
  if (tecErr) throw tecErr;
  const tecnicos = ((tecs ?? []) as Array<{ id: string; full_name: string; mesa_id: number | null }>);
  if (!tecnicos.length) {
    return { mesaId, tecnicoId: null, motivo: 'sin técnicos activos en la mesa' };
  }
  const ids = tecnicos.map((t) => t.id);

  // Carga: tickets activos por técnico (ponderados por prioridad)
  const { data: car, error: carErr } = await supabase
    .from('tickets')
    .select('tecnico_asignado_id, prioridad')
    .in('tecnico_asignado_id', ids)
    .in('estado', [...ESTADOS_ACTIVOS]);
  if (carErr) throw carErr;
  const porTecnico = new Map<string, Array<{ prioridad: PrioridadTicket }>>();
  for (const r of ((car ?? []) as Array<{ tecnico_asignado_id: string | null; prioridad: PrioridadTicket }>)) {
    if (!r.tecnico_asignado_id) continue;
    const arr = porTecnico.get(r.tecnico_asignado_id) ?? [];
    arr.push({ prioridad: r.prioridad });
    porTecnico.set(r.tecnico_asignado_id, arr);
  }

  // Afinidades para la categoría
  let afinMap = new Map<string, number>();
  try {
    const afs = await listAfinidadesPorCategoria(supabase, categoriaId);
    afinMap = new Map(afs.filter((a) => ids.includes(a.tecnicoId)).map((a) => [a.tecnicoId, a.peso]));
  } catch {
    afinMap = new Map();
  }

  // Asignaciones recientes (desempate): tickets creados en ventana, por técnico
  const desde = new Date(Date.now() - RECIENTES_DIAS * 24 * 3600 * 1000).toISOString();
  const recientesMap = new Map<string, number>();
  try {
    const { data: rec, error: recErr } = await supabase
      .from('tickets')
      .select('tecnico_asignado_id')
      .in('tecnico_asignado_id', ids)
      .gte('creado_en', desde);
    if (recErr) throw recErr;
    for (const r of ((rec ?? []) as Array<{ tecnico_asignado_id: string | null }>)) {
      if (!r.tecnico_asignado_id) continue;
      recientesMap.set(r.tecnico_asignado_id, (recientesMap.get(r.tecnico_asignado_id) ?? 0) + 1);
    }
  } catch {
    // sin telemetría reciente: desempate neutral
  }

  const scored = scoreTecnicos(
    tecnicos.map((t) => ({
      tecnicoId: t.id,
      fullName: t.full_name,
      mesaId: t.mesa_id,
      activos: porTecnico.get(t.id) ?? [],
      afinidadPeso: afinMap.get(t.id) ?? 0,
      recientes: recientesMap.get(t.id) ?? 0,
    })),
  );
  const best = sugerirTecnico(scored);
  if (!best) return { mesaId, tecnicoId: null, motivo: 'sin técnicos activos en la mesa' };
  return { mesaId, tecnicoId: best.tecnicoId, tecnicoNombre: best.fullName, motivo: best.motivo };
}
