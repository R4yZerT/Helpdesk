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
