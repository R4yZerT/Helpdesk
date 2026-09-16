// Loop de validación IA — clasificación mesa/categoría (RF IA validación)
// La IA sugiere al crear; el técnico asignado confirma o corrige en el detalle.
// Solo los registros confirmada/corregida alimentan el dataset de reentrenamiento.

import type { SupabaseClient } from '@supabase/supabase-js';

export type FuenteIa = 'beto' | 'reglas' | 'manual' | 'desconocida';
export type EstadoIa = 'pendiente' | 'confirmada' | 'corregida';

export type SugerenciaIa = {
  mesaId: number | null;
  categoriaId: number | null;
  confianza: number | null;
  fuente: FuenteIa;
};

export type TicketIaFeedback = {
  ticketId: string;
  sugeridoMesaId: number | null;
  sugeridoCategoriaId: number | null;
  confianza: number | null;
  fuente: FuenteIa;
  estado: EstadoIa;
  finalMesaId: number | null;
  finalCategoriaId: number | null;
  validadoPor: string | null;
  validadoEn: string | null;
};

const FUENTES: readonly string[] = ['beto', 'reglas', 'manual', 'desconocida'];
const ESTADOS: readonly string[] = ['pendiente', 'confirmada', 'corregida'];

function esFuenteIa(v: unknown): v is FuenteIa {
  return typeof v === 'string' && (FUENTES as readonly string[]).includes(v);
}

function esEstadoIa(v: unknown): v is EstadoIa {
  return typeof v === 'string' && (ESTADOS as readonly string[]).includes(v);
}

function mapRow(row: Record<string, unknown>): TicketIaFeedback {
  return {
    ticketId: String(row.ticket_id ?? ''),
    sugeridoMesaId: (row.sugerido_mesa_id as number | null) ?? null,
    sugeridoCategoriaId: (row.sugerido_categoria_id as number | null) ?? null,
    confianza: typeof row.confianza === 'number' ? (row.confianza as number) : null,
    fuente: esFuenteIa(row.fuente) ? (row.fuente as FuenteIa) : 'desconocida',
    estado: esEstadoIa(row.estado) ? (row.estado as EstadoIa) : 'pendiente',
    finalMesaId: (row.final_mesa_id as number | null) ?? null,
    finalCategoriaId: (row.final_categoria_id as number | null) ?? null,
    validadoPor: (row.validado_por as string | null) ?? null,
    validadoEn: (row.validado_en as string | null) ?? null,
  };
}

// Solo confirmada/corregida es apta para entrenamiento.
export function esAptoEntrenamiento(fb: TicketIaFeedback | null | undefined): boolean {
  return fb?.estado === 'confirmada' || fb?.estado === 'corregida';
}

export async function getIaFeedback(
  client: SupabaseClient,
  ticketId: string,
): Promise<TicketIaFeedback | null> {
  const { data, error } = await client
    .from('ticket_ia_feedback')
    .select('*')
    .eq('ticket_id', ticketId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

// Guarda la sugerencia que vio el creador al crear el ticket.
// No toca filas ya validadas (confirmada/corregida son inmutables).
export async function registrarSugerenciaIa(
  client: SupabaseClient,
  ticketId: string,
  sugerencia: SugerenciaIa,
): Promise<void> {
  const payload = {
    ticket_id: ticketId,
    sugerido_mesa_id: sugerencia.mesaId,
    sugerido_categoria_id: sugerencia.categoriaId,
    confianza: sugerencia.confianza,
    fuente: sugerencia.fuente,
  };
  // Intento de update solo si sigue pendiente (o fila creada por trigger sin sugerencia).
  const { data: actual } = await client
    .from('ticket_ia_feedback')
    .select('estado')
    .eq('ticket_id', ticketId)
    .maybeSingle();
  const estadoActual = (actual as { estado?: unknown } | null)?.estado;
  if (estadoActual === 'confirmada' || estadoActual === 'corregida') return;
  if (actual) {
    const { error } = await client
      .from('ticket_ia_feedback')
      .update(payload)
      .eq('ticket_id', ticketId)
      .eq('estado', 'pendiente');
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await client.from('ticket_ia_feedback').insert(payload);
  if (error) throw new Error(error.message);
}

// El técnico confirma: la clasificación actual del ticket es correcta.
// final_* = mesa/categoria actuales del ticket.
export async function confirmarClasificacion(
  client: SupabaseClient,
  ticketId: string,
  validadorId: string,
): Promise<TicketIaFeedback> {
  const { data: ticket, error: ticketError } = await client
    .from('tickets')
    .select('mesa_id,categoria_id')
    .eq('id', ticketId)
    .single();
  if (ticketError) throw new Error(ticketError.message);
  const row = ticket as { mesa_id: number | null; categoria_id: number | null };
  const { data, error } = await client
    .from('ticket_ia_feedback')
    .update({
      estado: 'confirmada',
      final_mesa_id: row.mesa_id,
      final_categoria_id: row.categoria_id,
      validado_por: validadorId,
      validado_en: new Date().toISOString(),
    })
    .eq('ticket_id', ticketId)
    .eq('estado', 'pendiente')
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

// El técnico corrige: reclasifica mesa/categoría (obligatorio) y marca corregida.
// Actualiza el ticket y el feedback en orden (ticket primero para que el CHECK pase).
export async function corregirClasificacion(
  client: SupabaseClient,
  ticketId: string,
  validadorId: string,
  final: { mesaId: number; categoriaId: number },
): Promise<TicketIaFeedback> {
  if (!Number.isInteger(final.mesaId) || final.mesaId <= 0) {
    throw new Error('Selecciona la dependencia correcta');
  }
  if (!Number.isInteger(final.categoriaId) || final.categoriaId <= 0) {
    throw new Error('Selecciona la categoría correcta');
  }
  const { error: ticketError } = await client
    .from('tickets')
    .update({ mesa_id: final.mesaId, categoria_id: final.categoriaId })
    .eq('id', ticketId);
  if (ticketError) throw new Error(ticketError.message);
  const { data, error } = await client
    .from('ticket_ia_feedback')
    .update({
      estado: 'corregida',
      final_mesa_id: final.mesaId,
      final_categoria_id: final.categoriaId,
      validado_por: validadorId,
      validado_en: new Date().toISOString(),
    })
    .eq('ticket_id', ticketId)
    .eq('estado', 'pendiente')
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}
