// RF-32 — Gestión de categorías maestras (solo administrador)
// Contrato espejo de supabase/migrations/20260820150246_ticket_categories.sql
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TicketCategoria } from './tickets.js';

export const DOMINIOS = ['tic', 'comunicaciones', 'infraestructura', 'general'] as const;
export type DominioCategoria = (typeof DOMINIOS)[number];

export function isDominioCategoria(v: string): v is DominioCategoria {
  return (DOMINIOS as readonly string[]).includes(v);
}

// Inputs
export type CreateCategoriaInput = { dominio: DominioCategoria; subcategoria: string; orden?: number };
export type UpdateCategoriaInput = { dominio?: DominioCategoria; subcategoria?: string; orden?: number; activa?: boolean };
export type CreateCategoriaErrors = Partial<Record<keyof CreateCategoriaInput, string>>;
export type UpdateCategoriaErrors = Partial<Record<keyof UpdateCategoriaInput, string>>;

export function validateCreateCategoria(input: CreateCategoriaInput): CreateCategoriaErrors {
  const e: CreateCategoriaErrors = {};
  if (!isDominioCategoria(input.dominio)) e.dominio = 'Dominio inválido';
  const s = input.subcategoria?.trim() ?? '';
  if (s.length < 3) e.subcategoria = 'Mínimo 3 caracteres';
  else if (s.length > 80) e.subcategoria = 'Máximo 80 caracteres';
  if (input.orden !== undefined && (!Number.isInteger(input.orden) || input.orden < 0 || input.orden > 1000)) e.orden = 'Orden 0-1000';
  return e;
}

export function validateUpdateCategoria(input: UpdateCategoriaInput): UpdateCategoriaErrors {
  const e: UpdateCategoriaErrors = {};
  if (input.dominio !== undefined && !isDominioCategoria(input.dominio)) e.dominio = 'Dominio inválido';
  if (input.subcategoria !== undefined) {
    const s = input.subcategoria.trim();
    if (s.length < 3) e.subcategoria = 'Mínimo 3 caracteres';
    else if (s.length > 80) e.subcategoria = 'Máximo 80 caracteres';
  }
  if (input.orden !== undefined && (!Number.isInteger(input.orden) || input.orden < 0 || input.orden > 1000)) e.orden = 'Orden 0-1000';
  return e;
}

export function isCreateCategoriaValid(i: CreateCategoriaInput): boolean {
  return Object.keys(validateCreateCategoria(i)).length === 0;
}
export function isUpdateCategoriaValid(i: UpdateCategoriaInput): boolean {
  return Object.keys(validateUpdateCategoria(i)).length === 0;
}

// Listado paginado (admin)
export type ListCategoriasParams = {
  search?: string;
  dominio?: DominioCategoria | 'todos';
  activa?: boolean | 'todos';
  page?: number;
  pageSize?: number;
};

export async function listCategoriasPaginated(
  supabase: SupabaseClient,
  params: ListCategoriasParams = {},
): Promise<{ data: TicketCategoria[]; count: number }> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let q = supabase.from('ticket_categories').select('id, dominio, subcategoria, orden, activa', { count: 'exact' });
  if (params.search?.trim()) q = q.ilike('subcategoria', `%${params.search.trim()}%`);
  if (params.dominio && params.dominio !== 'todos') q = q.eq('dominio', params.dominio);
  if (typeof params.activa === 'boolean') q = q.eq('activa', params.activa);
  q = q.order('orden', { ascending: true }).order('subcategoria', { ascending: true }).range(from, to);
  const { data, error, count } = await q;
  if (error) throw error;
  return { data: (data ?? []) as TicketCategoria[], count: count ?? (data?.length ?? 0) };
}

export async function getCategoriaById(supabase: SupabaseClient, id: number): Promise<TicketCategoria | null> {
  const { data, error } = await supabase.from('ticket_categories').select('id, dominio, subcategoria, orden, activa').eq('id', id).single();
  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null;
    throw error;
  }
  return data as TicketCategoria;
}

export async function createCategoria(supabase: SupabaseClient, input: CreateCategoriaInput): Promise<TicketCategoria> {
  const errs = validateCreateCategoria(input);
  if (Object.keys(errs).length) throw new Error(`Validación: ${JSON.stringify(errs)}`);
  const payload = { dominio: input.dominio, subcategoria: input.subcategoria.trim(), orden: input.orden ?? 0 };
  const { data, error } = await supabase.from('ticket_categories').insert(payload).select('id, dominio, subcategoria, orden, activa').single();
  if (error) {
    if ((error as { code?: string }).code === '23505' || /duplicate|unique/i.test(error.message)) throw new Error('Ya existe esa categoría en el dominio');
    throw error;
  }
  return data as TicketCategoria;
}

export async function updateCategoria(supabase: SupabaseClient, id: number, patch: UpdateCategoriaInput): Promise<TicketCategoria> {
  const errs = validateUpdateCategoria(patch);
  if (Object.keys(errs).length) throw new Error(`Validación: ${JSON.stringify(errs)}`);
  const payload: Record<string, unknown> = {};
  if (patch.dominio !== undefined) payload.dominio = patch.dominio;
  if (patch.subcategoria !== undefined) payload.subcategoria = patch.subcategoria.trim();
  if (patch.orden !== undefined) payload.orden = patch.orden;
  if (patch.activa !== undefined) payload.activa = patch.activa;
  if (!Object.keys(payload).length) throw new Error('Sin cambios');
  const { data, error } = await supabase.from('ticket_categories').update(payload).eq('id', id).select('id, dominio, subcategoria, orden, activa').single();
  if (error) {
    if ((error as { code?: string }).code === '23505' || /duplicate|unique/i.test(error.message)) throw new Error('Ya existe esa categoría en el dominio');
    throw error;
  }
  return data as TicketCategoria;
}

export async function setCategoriaActiva(supabase: SupabaseClient, id: number, activa: boolean): Promise<TicketCategoria> {
  return updateCategoria(supabase, id, { activa });
}
