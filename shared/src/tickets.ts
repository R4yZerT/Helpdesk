// RF-06/08/09 — Tipos, validación, listado paginado y detalle paralelo (Calidad: Performance/Seguridad/Usabilidad)
import type { EstadoTicket, PrioridadTicket } from './types.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// RF-06: prioridad bloqueada por categoría — mapa espejo de ia.ts para evitar ciclo tickets<->ia
const PRIORIDAD_POR_CATEGORIA_TICKETS: Record<number, PrioridadTicket> = {
  1: 'media', 2: 'alta', 3: 'alta', 4: 'media', 5: 'critica', 6: 'alta', 7: 'baja', 8: 'media', 9: 'critica', 10: 'alta',
  11: 'baja', 12: 'media', 13: 'media', 14: 'baja', 15: 'critica', 16: 'alta', 17: 'baja', 18: 'media', 19: 'media',
};
function getPrioridadPorCategoriaLocal(categoriaId: number): PrioridadTicket {
  return PRIORIDAD_POR_CATEGORIA_TICKETS[categoriaId] ?? 'media';
}

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
  solucionAplicada: string | null;
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
  adjuntos?: TicketAdjunto[];
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
    solucionAplicada: (row.solucion_aplicada as string | null) ?? null,
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
  // RF-06: prioridad bloqueada por categoría — no se confía en el input del cliente
  const prioridadFinal = getPrioridadPorCategoriaLocal(input.categoriaId);
  const payload: Record<string, unknown> = {
    categoria_id: input.categoriaId,
    asunto: input.asunto.trim(),
    descripcion: input.descripcion.trim(),
    prioridad: prioridadFinal,
    estado: 'abierto',
    mesa_id: input.mesaId,
    ...(usuario_id ? { usuario_id } : {}),
    ...(opts?.id ? { id: opts.id } : {}),
  };
  const { data, error } = await client.from('tickets').insert(payload).select('id,numero').single();
  if (error) throw new Error(error.message);
  return data as { id: string; numero: number };
}

// RF-07 — Adjuntos solo imágenes 10MB, max 5
export const ADJUNTO_MAX_MB = 10;
export const ADJUNTO_MAX_BYTES = ADJUNTO_MAX_MB * 1024 * 1024;
export const ADJUNTO_MAX_COUNT = 5;
export const ADJUNTO_ALLOWED_MIMES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const ADJUNTO_ALLOWED_EXTS: readonly string[] = ['.jpg', '.jpeg', '.png', '.webp', '.gif'] as const;

export type TicketAdjunto = {
  id: number;
  ticketId: string;
  storagePath: string;
  nombre: string;
  mime: string;
  size: number;
  creadoEn: string;
};

export function validateAdjunto(file: { name: string; size: number; type: string }): string | null {
  const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
  const mimeOk = (ADJUNTO_ALLOWED_MIMES as readonly string[]).includes(file.type);
  const extOk = (ADJUNTO_ALLOWED_EXTS as readonly string[]).includes(ext === '.jpg' ? '.jpg' : ext === '.jpeg' ? '.jpeg' : ext);
  // permitir si mime o ext coincide (algunos pickers no traen mime)
  if (!mimeOk && !extOk) return 'Solo imágenes JPG, PNG, WebP o GIF';
  if (file.size > ADJUNTO_MAX_BYTES) return `Máximo ${ADJUNTO_MAX_MB} MB por archivo`;
  if (file.size <= 0) return 'Archivo vacío';
  return null;
}

export function validateAdjuntos(files: { name: string; size: number; type: string }[]): string | null {
  if (files.length > ADJUNTO_MAX_COUNT) return `Máximo ${ADJUNTO_MAX_COUNT} archivos`;
  for (const f of files) {
    const e = validateAdjunto(f);
    if (e) return `${f.name}: ${e}`;
  }
  return null;
}

function mapAdjunto(row: Record<string, unknown>): TicketAdjunto {
  return {
    id: row.id as number,
    ticketId: (row.ticket_id as string) ?? '',
    storagePath: (row.storage_path as string) ?? (row.ruta as string) ?? '',
    nombre: (row.nombre_original as string) ?? (row.nombre as string) ?? (row.filename as string) ?? '',
    mime: (row.mime as string) ?? (row.mime_type as string) ?? '',
    size: (row.tamano_bytes as number) ?? (row.size as number) ?? (row.bytes as number) ?? 0,
    creadoEn: (row.creado_en as string) ?? '',
  };
}

export async function fetchAdjuntos(client: SupabaseClient, ticketId: string): Promise<TicketAdjunto[]> {
  const { data, error } = await client.from('ticket_adjuntos').select('*').eq('ticket_id', ticketId).order('creado_en');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapAdjunto);
}

// RF-08 — Listado paginado server-side (Performance: filtra/ordena/pagina en DB)
export type ListMyTicketsParams = {
  estado?: EstadoTicket;
  prioridad?: PrioridadTicket;
  categoriaId?: number;
  numero?: number;
  mesaId?: number;
  tecnicoId?: string | null;
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
    .select('id,numero,usuario_id,mesa_id,categoria_id,asunto,descripcion,prioridad,estado,tecnico_asignado_id,fecha_resolucion,solucion_aplicada,creado_en,actualizado_en', { count: 'exact' })
    .order('creado_en', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);

  if (params.estado && isEstadoTicket(params.estado)) {
    query = query.eq('estado', params.estado);
  }
  if (params.prioridad && isPrioridadTicket(params.prioridad)) {
    query = query.eq('prioridad', params.prioridad);
  }
  if (params.categoriaId && Number.isInteger(params.categoriaId)) {
    query = query.eq('categoria_id', params.categoriaId);
  }
  if (params.numero && Number.isInteger(params.numero)) {
    query = query.eq('numero', params.numero);
  }
  if (params.mesaId && Number.isInteger(params.mesaId)) {
    query = query.eq('mesa_id', params.mesaId);
  }
  if (params.tecnicoId !== undefined) {
    if (params.tecnicoId === null) query = query.is('tecnico_asignado_id', null);
    else if (params.tecnicoId === '__assigned') query = query.not('tecnico_asignado_id', 'is', null);
    else query = query.eq('tecnico_asignado_id', params.tecnicoId);
  }
  const q = params.q?.trim();
  if (q) {
    // Usa ILIKE; con pg_trgm + GIN acelera %q% si existe índice. Si q es numérico, busca también por número de ticket
    const escaped = q.replace(/%/g, '\\%').replace(/_/g, '\\_');
    const num = Number(q.replace(/^#/, ''));
    if (Number.isInteger(num) && String(num) === q.replace(/^#/, '').trim()) {
      query = query.or(`numero.eq.${num},asunto.ilike.%${escaped}%`);
    } else {
      query = query.ilike('asunto', `%${escaped}%`);
    }
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


// RF-10 — Editar/cancelar propia mientras no asignada (RLS refuerza)
// RF-11 — solucion_aplicada + fechaResolucion

export type UpdateTicketInput = {
  asunto?: string;
  descripcion?: string;
  prioridad?: PrioridadTicket;
  categoriaId?: number;
  mesaId?: number;
};

export function validateUpdateTicket(input: UpdateTicketInput): Partial<Record<keyof UpdateTicketInput, string>> {
  const e: Partial<Record<keyof UpdateTicketInput, string>> = {};
  if (input.asunto !== undefined) {
    const a = input.asunto.trim();
    if (a.length < 5) e.asunto = 'Asunto mínimo 5 caracteres';
    else if (a.length > 200) e.asunto = 'Asunto máximo 200 caracteres';
  }
  if (input.descripcion !== undefined) {
    const d = input.descripcion.trim();
    if (d.length < 10) e.descripcion = 'Descripción mínimo 10 caracteres';
    else if (d.length > 5000) e.descripcion = 'Descripción máximo 5000 caracteres';
  }
  if (input.prioridad !== undefined && !isPrioridadTicket(input.prioridad)) e.prioridad = 'Prioridad inválida';
  if (input.categoriaId !== undefined && (!Number.isInteger(input.categoriaId) || input.categoriaId <= 0)) e.categoriaId = 'Categoría inválida';
  if (input.mesaId !== undefined && (!Number.isInteger(input.mesaId) || input.mesaId <= 0)) e.mesaId = 'Dependencia inválida';
  return e;
}

export async function updateTicket(client: SupabaseClient, ticketId: string, patch: UpdateTicketInput): Promise<Ticket> {
  if (!ticketId) throw new Error('ticketId requerido');
  const errs = validateUpdateTicket(patch);
  if (Object.keys(errs).length) throw new Error(Object.values(errs)[0]);
  const payload: Record<string, unknown> = {};
  if (patch.asunto !== undefined) payload.asunto = patch.asunto.trim();
  if (patch.descripcion !== undefined) payload.descripcion = patch.descripcion.trim();
  if (patch.prioridad !== undefined) payload.prioridad = patch.prioridad;
  if (patch.categoriaId !== undefined) payload.categoria_id = patch.categoriaId;
  if (patch.mesaId !== undefined) payload.mesa_id = patch.mesaId;
  if (!Object.keys(payload).length) throw new Error('Sin cambios');
  const { data, error } = await client.from('tickets').update(payload).eq('id', ticketId).select('id,numero,usuario_id,mesa_id,categoria_id,asunto,descripcion,prioridad,estado,tecnico_asignado_id,fecha_resolucion,solucion_aplicada,creado_en,actualizado_en').single();
  if (error) {
    const m = error.message;
    if (/row-level security|policy/i.test(m)) throw new Error('No puedes editar este ticket (solo abierto y sin asignar)');
    throw new Error(m);
  }
  return mapTicket(data as unknown as Record<string, unknown>);
}

export async function cancelTicket(client: SupabaseClient, ticketId: string): Promise<Ticket> {
  if (!ticketId) throw new Error('ticketId requerido');
  const { data, error } = await client.from('tickets').update({ estado: 'cerrado' }).eq('id', ticketId).select('id,numero,usuario_id,mesa_id,categoria_id,asunto,descripcion,prioridad,estado,tecnico_asignado_id,fecha_resolucion,solucion_aplicada,creado_en,actualizado_en').single();
  if (error) {
    const m = error.message;
    if (/row-level security|policy/i.test(m)) throw new Error('No puedes cancelar este ticket');
    throw new Error(m);
  }
  return mapTicket(data as unknown as Record<string, unknown>);
}

// RF-11/13 — Transición de estado con FSM y solución aplicada
const ESTADOS_TRANSICION: Record<EstadoTicket, readonly EstadoTicket[]> = {
  abierto: ['en_proceso', 'cerrado', 'programado'],
  en_proceso: ['solucionado', 'cerrado', 'devuelto', 'programado'],
  solucionado: ['cerrado', 'devuelto'],
  cerrado: [],
  devuelto: ['en_proceso', 'cerrado'],
  programado: ['en_proceso', 'cerrado'],
};

export function canTransition(de: EstadoTicket, a: EstadoTicket): boolean {
  return (ESTADOS_TRANSICION[de] ?? []).includes(a);
}

export async function transitionTicket(
  client: SupabaseClient,
  ticketId: string,
  nuevoEstado: EstadoTicket,
  opts?: { solucionAplicada?: string; comentario?: string },
): Promise<Ticket> {
  if (!ticketId) throw new Error('ticketId requerido');
  if (!isEstadoTicket(nuevoEstado)) throw new Error('Estado inválido');
  // RF-11 — solución aplicada requerida para solucionado/cerrado (dato clave IA)
  if (nuevoEstado === 'solucionado' || nuevoEstado === 'cerrado') {
    const s = (opts?.solucionAplicada ?? '').trim();
    if (!s) throw new Error('Solución aplicada requerida para ' + nuevoEstado + ' (mín. 5 caracteres)');
    if (s.length < 5) throw new Error('Solución mínimo 5 caracteres');
    if (s.length > 5000) throw new Error('Solución máximo 5000 caracteres');
  } else if (opts?.solucionAplicada !== undefined) {
    const s = opts.solucionAplicada.trim();
    if (s.length > 0 && s.length < 5) throw new Error('Solución mínimo 5 caracteres');
    if (s.length > 5000) throw new Error('Solución máximo 5000 caracteres');
  }
  // Obtener estado actual para validar FSM (fail-fast)
  const cur = await client.from('tickets').select('estado').eq('id', ticketId).single();
  if (cur.error) throw new Error(cur.error.message);
  const actual = cur.data.estado as EstadoTicket;
  if (!canTransition(actual, nuevoEstado)) {
    throw new Error(`Transición no permitida: ${actual} → ${nuevoEstado}`);
  }
  const payload: Record<string, unknown> = { estado: nuevoEstado };
  if (opts?.solucionAplicada !== undefined) payload.solucion_aplicada = opts.solucionAplicada.trim() || null;
  const { data, error } = await client.from('tickets').update(payload).eq('id', ticketId).select('id,numero,usuario_id,mesa_id,categoria_id,asunto,descripcion,prioridad,estado,tecnico_asignado_id,fecha_resolucion,solucion_aplicada,creado_en,actualizado_en').single();
  if (error) throw new Error(error.message);
  if (opts?.comentario?.trim()) {
    try { await addComentario(client, ticketId, opts.comentario.trim()); } catch { /* no bloquea transición */ }
  }
  return mapTicket(data as unknown as Record<string, unknown>);
}

// RF-14 — Reasignar a otro técnico o mesa
export async function reassignTicket(
  client: SupabaseClient,
  ticketId: string,
  patch: { tecnicoId?: string | null; mesaId?: number | null },
): Promise<Ticket> {
  if (!ticketId) throw new Error('ticketId requerido');
  if (patch.tecnicoId === undefined && patch.mesaId === undefined) throw new Error('Nada que reasignar');
  const payload: Record<string, unknown> = {};
  if (patch.tecnicoId !== undefined) payload.tecnico_asignado_id = patch.tecnicoId;
  if (patch.mesaId !== undefined) {
    if (patch.mesaId !== null && (!Number.isInteger(patch.mesaId) || patch.mesaId <= 0)) throw new Error('Mesa inválida');
    payload.mesa_id = patch.mesaId;
  }
  const { data, error } = await client.from('tickets').update(payload).eq('id', ticketId).select('id,numero,usuario_id,mesa_id,categoria_id,asunto,descripcion,prioridad,estado,tecnico_asignado_id,fecha_resolucion,solucion_aplicada,creado_en,actualizado_en').single();
  if (error) throw new Error(error.message);
  return mapTicket(data as unknown as Record<string, unknown>);
}

// RF-12 — Bandeja técnico: tickets asignados ordenados prioridad/antigüedad
export const PRIORIDAD_PESO: Record<PrioridadTicket, number> = { critica: 4, alta: 3, media: 2, baja: 1 };

export type ListAssignedParams = {
  estado?: EstadoTicket;
  prioridad?: PrioridadTicket;
  q?: string;
  mesaId?: number;
  page?: number;
  pageSize?: number;
};

export async function listAssignedTickets(client: SupabaseClient, params: ListAssignedParams = {}): Promise<ListMyTicketsResult> {
  const page = Math.max(0, params.page ?? 0);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = page * pageSize;
  const to = from + pageSize - 1;
  // Trae técnico asignado = auth.uid() implícito por RLS; filtramos explícitamente para claridad
  const { data: user } = await client.auth.getUser();
  const uid = user.user?.id;
  let query = client.from('tickets').select('id,numero,usuario_id,mesa_id,categoria_id,asunto,descripcion,prioridad,estado,tecnico_asignado_id,fecha_resolucion,solucion_aplicada,creado_en,actualizado_en', { count: 'exact' });
  if (uid) query = query.eq('tecnico_asignado_id', uid);
  // Orden base por antigüedad; prioridad se ordena en memoria para respetar peso sin depender de orden alfabético
  query = query.order('creado_en', { ascending: true }).order('id', { ascending: true }).range(from, to);
  if (params.estado && isEstadoTicket(params.estado)) query = query.eq('estado', params.estado);
  if (params.prioridad && isPrioridadTicket(params.prioridad)) query = query.eq('prioridad', params.prioridad);
  if (params.mesaId) query = query.eq('mesa_id', params.mesaId);
  const q = params.q?.trim();
  if (q) {
    const esc = q.replace(/%/g, '\\%').replace(/_/g, '\\_');
    query = query.ilike('asunto', `%${esc}%`);
  }
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  let rows = (data ?? []) as Record<string, unknown>[];
  // Orden prioridad descendente + antigüedad ascendente (memoria, page ya acotado)
  rows = [...rows].sort((a, b) => {
    const pa = PRIORIDAD_PESO[a.prioridad as PrioridadTicket] ?? 0;
    const pb = PRIORIDAD_PESO[b.prioridad as PrioridadTicket] ?? 0;
    if (pb !== pa) return pb - pa;
    return String(a.creado_en).localeCompare(String(b.creado_en));
  });
  const total = count ?? rows.length;
  return { data: rows.map(mapTicket), total, hasMore: from + rows.length < total, page, pageSize };
}


// RF-09 — Detalle paralelo 3 queries (Software/Usuario: bloquea solo lo necesario)
export async function getTicketDetail(
  client: SupabaseClient,
  ticketId: string,
): Promise<TicketDetail> {
  if (!ticketId) throw new Error('ticketId requerido');
  const ticketPromise = client
    .from('tickets')
    .select('id,numero,usuario_id,mesa_id,categoria_id,asunto,descripcion,prioridad,estado,tecnico_asignado_id,fecha_resolucion,solucion_aplicada,creado_en,actualizado_en')
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

  const adjuntosPromise = client.from('ticket_adjuntos').select('*').eq('ticket_id', ticketId).order('creado_en');
  const [ticketRes, estadosRes, comentariosRes, adjuntosRes] = await Promise.all([ticketPromise, estadosPromise, comentariosPromise, adjuntosPromise]);

  if (ticketRes.error) throw new Error(ticketRes.error.message);
  if (!ticketRes.data) throw new Error('Ticket no encontrado');
  if (estadosRes.error) throw new Error(estadosRes.error.message);
  if (comentariosRes.error) throw new Error(comentariosRes.error.message);

  return {
    ticket: mapTicket(ticketRes.data as unknown as Record<string, unknown>),
    estados: ((estadosRes.data ?? []) as Record<string, unknown>[]).map(mapEstado),
    comentarios: ((comentariosRes.data ?? []) as Record<string, unknown>[]).map(mapComentario),
    adjuntos: adjuntosRes.error ? [] : ((adjuntosRes.data ?? []) as Record<string, unknown>[]).map(mapAdjunto),
  };
}
