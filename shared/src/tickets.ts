// RF-06/08/09 — Tipos, validación, listado paginado y detalle paralelo (Calidad: Performance/Seguridad/Usabilidad)
import type { EstadoTicket, PrioridadTicket } from './types.js';
import type { SupabaseClient } from '@supabase/supabase-js';

export const PRIORIDADES: readonly PrioridadTicket[] = ['baja', 'media', 'alta', 'critica'] as const;
export const ESTADOS: readonly EstadoTicket[] = ['abierto', 'en_proceso', 'solucionado', 'cerrado', 'devuelto', 'programado'] as const;

export function isPrioridadTicket(v: string): v is PrioridadTicket {
  return (PRIORIDADES as readonly string[]).includes(v);
}
export function isEstadoTicket(v: string): v is EstadoTicket {
  return (ESTADOS as readonly string[]).includes(v);
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
  if (!Number.isInteger(input.categoriaId) || input.categoriaId <= 0) {
    errors.categoriaId = 'Selecciona una categoría';
  }
  const asunto = input.asunto.trim();
  if (asunto.length < 5) errors.asunto = 'Asunto mínimo 5 caracteres';
  else if (asunto.length > 200) errors.asunto = 'Asunto máximo 200 caracteres';
  const desc = input.descripcion.trim();
  if (desc.length < 10) errors.descripcion = 'Descripción mínimo 10 caracteres';
  else if (desc.length > 5000) errors.descripcion = 'Descripción máximo 5000 caracteres';
  if (!isPrioridadTicket(input.prioridad)) errors.prioridad = 'Prioridad inválida';
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

// RF-08/09 — Ticket + historial + comentarios
export type Ticket = {
  id: string;
  numero: number;
  usuarioId: string;
  mesaId: number;
  categoriaId: number;
  asunto: string;
  descripcion: string;
  prioridad: PrioridadTicket;
  estado: EstadoTicket;
  tecnicoAsignadoId: string | null;
  fechaResolucion: string | null;
  creadoEn: string;
  actualizadoEn: string;
};

export type TicketEstado = {
  id: number;
  ticketId: string;
  tipoEvento: 'estado' | 'asignacion';
  estadoAnterior: EstadoTicket | null;
  estadoNuevo: EstadoTicket | null;
  tecnicoDe: string | null;
  tecnicoPara: string | null;
  usuarioId: string;
  comentario: string | null;
  creadoEn: string;
};

export type TicketComentario = {
  id: number;
  ticketId: string;
  usuarioId: string;
  comentario: string;
  interno: boolean;
  creadoEn: string;
};

export type TicketDetail = {
  ticket: Ticket;
  estados: TicketEstado[];
  comentarios: TicketComentario[];
};

// RF-15 — validación comentario (DB check 1-2000)
export function validateComentario(mensaje: string): string | null {
  const m = mensaje.trim();
  if (m.length < 1) return 'Comentario requerido';
  if (m.length > 2000) return 'Comentario máximo 2000 caracteres';
  return null;
}

function mapTicket(row: Record<string, unknown>): Ticket {
  return {
    id: row.id as string,
    numero: row.numero as number,
    usuarioId: row.usuario_id as string,
    mesaId: row.mesa_id as number,
    categoriaId: row.categoria_id as number,
    asunto: row.asunto as string,
    descripcion: row.descripcion as string,
    prioridad: row.prioridad as PrioridadTicket,
    estado: row.estado as EstadoTicket,
    tecnicoAsignadoId: (row.tecnico_asignado_id as string | null) ?? null,
    fechaResolucion: (row.fecha_resolucion as string | null) ?? null,
    creadoEn: row.creado_en as string,
    actualizadoEn: row.actualizado_en as string,
  };
}

function mapEstado(row: Record<string, unknown>): TicketEstado {
  return {
    id: row.id as number,
    ticketId: row.ticket_id as string,
    tipoEvento: row.tipo_evento as 'estado' | 'asignacion',
    estadoAnterior: (row.estado_anterior as EstadoTicket | null) ?? null,
    estadoNuevo: (row.estado_nuevo as EstadoTicket | null) ?? null,
    tecnicoDe: (row.tecnico_de as string | null) ?? null,
    tecnicoPara: (row.tecnico_para as string | null) ?? null,
    usuarioId: row.usuario_id as string,
    comentario: (row.comentario as string | null) ?? null,
    creadoEn: row.creado_en as string,
  };
}

function mapComentario(row: Record<string, unknown>): TicketComentario {
  return {
    id: row.id as number,
    ticketId: row.ticket_id as string,
    usuarioId: row.usuario_id as string,
    comentario: row.comentario as string,
    interno: row.interno as boolean,
    creadoEn: row.creado_en as string,
  };
}

// Servicio — recibe SupabaseClient desde la app (sin hardcodear credenciales)
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
  opts?: { id?: string },
): Promise<{ id: string; numero: number }> {
  const errs = validateCreateTicket(input);
  if (Object.keys(errs).length) throw new Error(Object.values(errs)[0]);
  let usuario_id: string | null = null;
  try {
    const { data } = await client.auth.getUser();
    usuario_id = data.user?.id ?? null;
  } catch { /* trigger suple */ }
  const payload: Record<string, unknown> = {
    categoria_id: input.categoriaId,
    asunto: input.asunto.trim(),
    descripcion: input.descripcion.trim(),
    prioridad: input.prioridad,
    mesa_id: input.mesaId,
    ...(usuario_id ? { usuario_id } : {}),
    ...(opts?.id ? { id: opts.id } : {}),
  };
  const { data, error } = await client.from('tickets').insert(payload).select('id,numero').single();
  if (error) throw new Error(error.message);
  return data as { id: string; numero: number };
}

// RF-08 — Listado paginado server-side (Performance: filtra/ordena/pagina en DB)
export type ListMyTicketsParams = {
  estado?: EstadoTicket;
  prioridad?: PrioridadTicket;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type ListMyTicketsResult = {
  data: Ticket[];
  total: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 20;

export async function listMyTickets(
  client: SupabaseClient,
  params: ListMyTicketsParams = {},
): Promise<ListMyTicketsResult> {
  const page = Math.max(0, params.page ?? 0);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from('tickets')
    .select('id,numero,usuario_id,mesa_id,categoria_id,asunto,descripcion,prioridad,estado,tecnico_asignado_id,fecha_resolucion,creado_en,actualizado_en', { count: 'exact' })
    .order('creado_en', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);

  if (params.estado && isEstadoTicket(params.estado)) {
    query = query.eq('estado', params.estado);
  }
  if (params.prioridad && isPrioridadTicket(params.prioridad)) {
    query = query.eq('prioridad', params.prioridad);
  }
  const q = params.q?.trim();
  if (q) {
    // Usa ILIKE; con pg_trgm + GIN acelera %q% si existe índice
    const escaped = q.replace(/%/g, '\\%').replace(/_/g, '\\_');
    query = query.ilike('asunto', `%${escaped}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const total = count ?? rows.length;
  return {
    data: rows.map(mapTicket),
    total,
    hasMore: from + rows.length < total,
    page,
    pageSize,
  };
}

// RF-15 — Crear comentario inline (interno solo tecnico/jefe/admin via RLS)
export async function addComentario(
  client: SupabaseClient,
  ticketId: string,
  mensaje: string,
  opts?: { interno?: boolean },
): Promise<TicketComentario> {
  if (!ticketId) throw new Error('ticketId requerido');
  const err = validateComentario(mensaje);
  if (err) throw new Error(err);
  let usuario_id: string | null = null;
  try {
    const { data } = await client.auth.getUser();
    usuario_id = data.user?.id ?? null;
  } catch { /* RLS exigirá usuario_id */ }
  if (!usuario_id) throw new Error('Sesión requerida');
  const interno = !!opts?.interno;
  // Permiso interno se valida en RLS (tecnico/jefe/admin); fail-fast opcional: si interno y no puede, RLS lo rechaza con mensaje
  const payload: Record<string, unknown> = {
    ticket_id: ticketId,
    usuario_id,
    comentario: mensaje.trim(),
    interno,
  };
  const { data, error } = await client.from('ticket_comentarios').insert(payload).select('id,ticket_id,usuario_id,comentario,interno,creado_en').single();
  if (error) {
    const msg = error.message;
    if (/row-level security|policy/i.test(msg) && interno) throw new Error('Solo técnico/jefe pueden marcar interno');
    if (/row-level security|policy/i.test(msg)) throw new Error('No autorizado para comentar en este ticket');
    throw new Error(msg);
  }
  return mapComentario(data as unknown as Record<string, unknown>);
}

// RF-09 — Detalle paralelo 3 queries (Software/Usuario: bloquea solo lo necesario)
export async function getTicketDetail(
  client: SupabaseClient,
  ticketId: string,
): Promise<TicketDetail> {
  if (!ticketId) throw new Error('ticketId requerido');
  const ticketPromise = client
    .from('tickets')
    .select('id,numero,usuario_id,mesa_id,categoria_id,asunto,descripcion,prioridad,estado,tecnico_asignado_id,fecha_resolucion,creado_en,actualizado_en')
    .eq('id', ticketId)
    .single();
  const estadosPromise = client
    .from('ticket_estados')
    .select('id,ticket_id,tipo_evento,estado_anterior,estado_nuevo,tecnico_de,tecnico_para,usuario_id,comentario,creado_en')
    .eq('ticket_id', ticketId)
    .order('creado_en', { ascending: true });
  const comentariosPromise = client
    .from('ticket_comentarios')
    .select('id,ticket_id,usuario_id,comentario,interno,creado_en')
    .eq('ticket_id', ticketId)
    .order('creado_en', { ascending: true });

  const [ticketRes, estadosRes, comentariosRes] = await Promise.all([ticketPromise, estadosPromise, comentariosPromise]);

  if (ticketRes.error) throw new Error(ticketRes.error.message);
  if (!ticketRes.data) throw new Error('Ticket no encontrado');
  if (estadosRes.error) throw new Error(estadosRes.error.message);
  if (comentariosRes.error) throw new Error(comentariosRes.error.message);

  return {
    ticket: mapTicket(ticketRes.data as unknown as Record<string, unknown>),
    estados: ((estadosRes.data ?? []) as Record<string, unknown>[]).map(mapEstado),
    comentarios: ((comentariosRes.data ?? []) as Record<string, unknown>[]).map(mapComentario),
  };
}
