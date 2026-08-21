// RF-06 — Tipos y validacion para creacion de tickets
import type { PrioridadTicket } from './types.js';

export const PRIORIDADES: readonly PrioridadTicket[] = ['baja', 'media', 'alta', 'critica'] as const;

export function isPrioridadTicket(v: string): v is PrioridadTicket {
  return (PRIORIDADES as readonly string[]).includes(v);
}

export type CreateTicketInput = {
  categoriaId: number;
  asunto: string;
  descripcion: string;
  prioridad: PrioridadTicket;
  mesaId: number | null;
};

export type CreateTicketErrors = Partial<Record<keyof CreateTicketInput, string>>;

export function validateCreateTicket(input: CreateTicketInput): CreateTicketErrors {
  const errors: CreateTicketErrors = {};
  // categoriaId — requerido, entero positivo
  if (!Number.isInteger(input.categoriaId) || input.categoriaId <= 0) {
    errors.categoriaId = 'Selecciona una categoría';
  }
  // asunto — 5 a 200 (schema check)
  const asunto = input.asunto.trim();
  if (asunto.length < 5) errors.asunto = 'Asunto mínimo 5 caracteres';
  else if (asunto.length > 200) errors.asunto = 'Asunto máximo 200 caracteres';
  // descripcion — 10 a 5000
  const desc = input.descripcion.trim();
  if (desc.length < 10) errors.descripcion = 'Descripción mínimo 10 caracteres';
  else if (desc.length > 5000) errors.descripcion = 'Descripción máximo 5000 caracteres';
  // prioridad
  if (!isPrioridadTicket(input.prioridad)) errors.prioridad = 'Prioridad inválida';
  // mesaId — requerido (RF-06 dependencia)
  if (input.mesaId === null || !Number.isInteger(input.mesaId) || input.mesaId <= 0) {
    errors.mesaId = 'Selecciona una dependencia';
  }
  return errors;
}

export function isCreateTicketValid(input: CreateTicketInput): boolean {
  return Object.keys(validateCreateTicket(input)).length === 0;
}

// Entidades leídas de Supabase (snake_case -> camel)
export type TicketCategoria = {
  id: number;
  dominio: string;
  subcategoria: string;
  orden: number;
  activa: boolean;
};

export type Mesa = {
  id: number;
  nombre: string;
  activa: boolean;
};

// Servicio — recibe SupabaseClient desde la app (sin hardcodear credenciales)
import type { SupabaseClient } from '@supabase/supabase-js';

export async function fetchCategorias(client: SupabaseClient): Promise<TicketCategoria[]> {
  const { data, error } = await client
    .from('ticket_categories')
    .select('id,dominio,subcategoria,orden,activa')
    .eq('activa', true)
    .order('dominio', { ascending: true })
    .order('orden', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TicketCategoria[];
}

export async function fetchMesas(client: SupabaseClient): Promise<Mesa[]> {
  const { data, error } = await client.from('mesas').select('id,nombre,activa').eq('activa', true).order('nombre');
  if (error) throw new Error(error.message);
  return (data ?? []) as Mesa[];
}

export async function createTicket(
  client: SupabaseClient,
  input: CreateTicketInput,
): Promise<{ id: string; numero: number }> {
  const payload = {
    categoria_id: input.categoriaId,
    asunto: input.asunto.trim(),
    descripcion: input.descripcion.trim(),
    prioridad: input.prioridad,
    mesa_id: input.mesaId,
  };
  const { data, error } = await client.from('tickets').insert(payload).select('id,numero').single();
  if (error) throw new Error(error.message);
  return data as { id: string; numero: number };
}
