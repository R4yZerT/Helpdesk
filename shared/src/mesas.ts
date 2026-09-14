// RF-29 / RF-30 — Gestión de mesas (dependencias)
// Contrato espejo de supabase/migrations/*_schema_inicial.sql:20 — public.mesas
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Mesa } from './tickets.js';

// Validación nombre mesa
export type CreateMesaInput = { nombre: string };
export type UpdateMesaInput = { nombre?: string; activa?: boolean };
export type CreateMesaErrors = Partial<Record<keyof CreateMesaInput, string>>;
export type UpdateMesaErrors = Partial<Record<keyof UpdateMesaInput, string>>;

export function validateCreateMesa(input: CreateMesaInput): CreateMesaErrors {
  const e: CreateMesaErrors = {};
  const n = input.nombre.trim();
  if (n.length < 3) e.nombre = 'Nombre mínimo 3 caracteres';
  else if (n.length > 60) e.nombre = 'Nombre máximo 60 caracteres';
  return e;
}

export function validateUpdateMesa(input: UpdateMesaInput): UpdateMesaErrors {
  const e: UpdateMesaErrors = {};
  if (input.nombre !== undefined) {
    const n = input.nombre.trim();
    if (n.length < 3) e.nombre = 'Nombre mínimo 3 caracteres';
    else if (n.length > 60) e.nombre = 'Nombre máximo 60 caracteres';
  }
  return e;
}

export function isCreateMesaValid(i: CreateMesaInput): boolean {
  return Object.keys(validateCreateMesa(i)).length === 0;
}
export function isUpdateMesaValid(i: UpdateMesaInput): boolean {
  return Object.keys(validateUpdateMesa(i)).length === 0;
}

// Listado paginado para admin (RF-29/30: ver todas)
export type ListMesasParams = {
  search?: string;
  activa?: boolean | 'todos';
  page?: number; // 1-indexed
  pageSize?: number; // default 20
  secretariaId?: number; // si admin tiene dependencia asignada, solo esa mesa
};

export async function listMesasPaginated(
  supabase: SupabaseClient,
  params: ListMesasParams = {},
): Promise<{ data: Mesa[]; count: number }> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let q = supabase.from('mesas').select('id, nombre, activa', { count: 'exact' });
  if (params.search?.trim()) q = q.ilike('nombre', `%${params.search.trim()}%`);
  if (typeof params.activa === 'boolean') q = q.eq('activa', params.activa);
  if (params.secretariaId != null) q = q.eq('id', params.secretariaId);
  q = q.order('nombre', { ascending: true }).range(from, to);
  const { data, error, count } = await q;
  if (error) throw error;
  return { data: (data ?? []) as Mesa[], count: count ?? (data?.length ?? 0) };
}

export async function getMesaById(supabase: SupabaseClient, id: number): Promise<Mesa | null> {
  const { data, error } = await supabase.from('mesas').select('id, nombre, activa').eq('id', id).single();
  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null;
    throw error;
  }
  return data as Mesa;
}

export async function createMesa(supabase: SupabaseClient, input: CreateMesaInput): Promise<Mesa> {
  const errs = validateCreateMesa(input);
  if (Object.keys(errs).length) throw new Error(`Validación: ${JSON.stringify(errs)}`);
  const { data, error } = await supabase
    .from('mesas')
    .insert({ nombre: input.nombre.trim() })
    .select('id, nombre, activa')
    .single();
  if (error) {
    if ((error as { code?: string }).code === '23505' || /duplicate|unique/i.test(error.message)) {
      throw new Error('Ya existe una mesa con ese nombre');
    }
    throw error;
  }
  return data as Mesa;
}

export async function updateMesa(
  supabase: SupabaseClient,
  id: number,
  patch: UpdateMesaInput,
): Promise<Mesa> {
  const errs = validateUpdateMesa(patch);
  if (Object.keys(errs).length) throw new Error(`Validación: ${JSON.stringify(errs)}`);
  const payload: Record<string, unknown> = {};
  if (patch.nombre !== undefined) payload.nombre = patch.nombre.trim();
  if (patch.activa !== undefined) payload.activa = patch.activa;
  if (!Object.keys(payload).length) throw new Error('Sin cambios');
  const { data, error } = await supabase.from('mesas').update(payload).eq('id', id).select('id, nombre, activa').single();
  if (error) {
    if ((error as { code?: string }).code === '23505' || /duplicate|unique/i.test(error.message)) {
      throw new Error('Ya existe una mesa con ese nombre');
    }
    throw error;
  }
  return data as Mesa;
}

export async function setMesaActiva(supabase: SupabaseClient, id: number, activa: boolean): Promise<Mesa> {
  return updateMesa(supabase, id, { activa });
}

// ---------------------------------------------------------------------------
// RF-31 — Asignar técnicos a mesas y definir mesas de respaldo
// Técnicos: profiles con rol='tecnico' + mesa_id (asignación directa).
// Respaldo: tabla public.mesa_respaldos (mesa_id -> respaldo_mesa_id).
// Ver migración supabase/migrations/*_rf31_mesa_respaldos.sql
// ---------------------------------------------------------------------------

export type TecnicoDeMesa = {
  id: string;
  fullName: string;
  email: string;
  activo: boolean;
  mesaId: number | null;
};

export type MesaRespaldo = {
  mesaId: number;
  mesaNombre?: string | null;
  respaldoMesaId: number;
  respaldoNombre?: string | null;
  creadoEn: string;
};

export function validateRespaldo(mesaId: number, respaldoMesaId: number): string | null {
  if (!Number.isInteger(mesaId) || mesaId <= 0) return 'Mesa inválida';
  if (!Number.isInteger(respaldoMesaId) || respaldoMesaId <= 0) return 'Mesa de respaldo inválida';
  if (mesaId === respaldoMesaId) return 'Una mesa no puede respaldarse a sí misma';
  return null;
}

/** Técnicos asignados a una mesa (rol=tecnico + mesa_id). */
export async function listTecnicosPorMesa(supabase: SupabaseClient, mesaId: number): Promise<TecnicoDeMesa[]> {
  const { data, error } = await (supabase.from('profiles') as any)
    .select('id, full_name, email, activo, mesa_id')
    .eq('rol', 'tecnico')
    .eq('mesa_id', mesaId)
    .order('full_name', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string; full_name: string; email: string | null; activo: boolean; mesa_id: number | null }>).map((r) => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email ?? '',
    activo: r.activo,
    mesaId: r.mesa_id,
  }));
}

/** Asigna un técnico a una mesa (o lo libera con mesaId=null). Requiere RLS admin. */
export async function asignarTecnicoAMesa(
  supabase: SupabaseClient,
  tecnicoId: string,
  mesaId: number | null,
): Promise<void> {
  if (mesaId !== null && (!Number.isInteger(mesaId) || mesaId <= 0)) throw new Error('Mesa inválida');
  const { error } = await (supabase.from('profiles') as any).update({ mesa_id: mesaId }).eq('id', tecnicoId).eq('rol', 'tecnico');
  if (error) throw error;
}

/** Mesas de respaldo definidas para una mesa. */
export async function listRespaldosDeMesa(supabase: SupabaseClient, mesaId: number): Promise<MesaRespaldo[]> {
  const { data, error } = await (supabase.from('mesa_respaldos') as any)
    .select('mesa_id, respaldo_mesa_id, creado_en')
    .eq('mesa_id', mesaId)
    .order('creado_en', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<{ mesa_id: number; respaldo_mesa_id: number; creado_en: string }>).map((r) => ({
    mesaId: r.mesa_id,
    respaldoMesaId: r.respaldo_mesa_id,
    creadoEn: r.creado_en,
  }));
}

/** Todas las relaciones de respaldo (para vista admin). */
export async function listTodosRespaldos(supabase: SupabaseClient): Promise<MesaRespaldo[]> {
  const { data, error } = await (supabase.from('mesa_respaldos') as any)
    .select('mesa_id, respaldo_mesa_id, creado_en')
    .order('mesa_id', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<{ mesa_id: number; respaldo_mesa_id: number; creado_en: string }>).map((r) => ({
    mesaId: r.mesa_id,
    respaldoMesaId: r.respaldo_mesa_id,
    creadoEn: r.creado_en,
  }));
}

/** Define una mesa de respaldo. Idempotente (upsert por par). */
export async function setRespaldoMesa(
  supabase: SupabaseClient,
  mesaId: number,
  respaldoMesaId: number,
): Promise<MesaRespaldo> {
  const err = validateRespaldo(mesaId, respaldoMesaId);
  if (err) throw new Error(err);
  const { data, error } = await (supabase.from('mesa_respaldos') as any)
    .upsert({ mesa_id: mesaId, respaldo_mesa_id: respaldoMesaId }, { onConflict: 'mesa_id,respaldo_mesa_id' })
    .select('mesa_id, respaldo_mesa_id, creado_en')
    .single();
  if (error) throw error;
  const r = data as { mesa_id: number; respaldo_mesa_id: number; creado_en: string };
  return { mesaId: r.mesa_id, respaldoMesaId: r.respaldo_mesa_id, creadoEn: r.creado_en };
}

/** Elimina una relación de respaldo. */
export async function removeRespaldoMesa(
  supabase: SupabaseClient,
  mesaId: number,
  respaldoMesaId: number,
): Promise<void> {
  const { error } = await (supabase.from('mesa_respaldos') as any)
    .delete()
    .eq('mesa_id', mesaId)
    .eq('respaldo_mesa_id', respaldoMesaId);
  if (error) throw error;
}
