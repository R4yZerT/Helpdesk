// H10 — Operaciones en lote sobre tickets (reasignar/cerrar/prioridad).
// Reusa las operaciones unitarias (FSM + RLS reales) con concurrencia acotada.
// La auditoría (trigger de historial) la genera la BD por cada UPDATE.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EstadoTicket, PrioridadTicket } from './types.js';
import { isPrioridadTicket } from './tickets.js';
import { reassignTicket, transitionTicket, updateTicket } from './tickets.js';

export type BulkOperacion = 'reasignar' | 'cerrar' | 'prioridad';

export type BulkParams = {
  ids: string[];
  operacion: BulkOperacion;
  /** reasignar: destino (al menos uno) */
  tecnicoId?: string | null;
  mesaId?: number | null;
  /** cerrar: solución requerida por RF-11 */
  solucion?: string;
  /** prioridad: nuevo nivel (técnico no puede: RLS lo rechaza, se reporta por ítem) */
  prioridad?: PrioridadTicket;
  /** Concurrencia máxima (defecto 5) */
  concurrencia?: number;
};

export type BulkItemResultado = { id: string; ok: boolean; error?: string };

export type BulkResultado = {
  total: number;
  ok: number;
  fallos: number;
  items: BulkItemResultado[];
  ms: number;
};

async function conConcurrencia<T>(items: string[], n: number, fn: (id: string) => Promise<T>): Promise<T[]> {
  const out: T[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function ejecutarBulk(client: SupabaseClient, params: BulkParams): Promise<BulkResultado> {
  const t0 = Date.now();
  const ids = [...new Set(params.ids.filter(Boolean))];
  if (!ids.length) throw new Error('Selecciona al menos un ticket');
  if (ids.length > 100) throw new Error('Máximo 100 tickets por lote');
  const concurrencia = Math.max(1, Math.min(params.concurrencia ?? 5, 10));

  const aplicar = async (id: string): Promise<BulkItemResultado> => {
    try {
      if (params.operacion === 'reasignar') {
        if (params.tecnicoId === undefined && params.mesaId === undefined) throw new Error('Nada que reasignar');
        await reassignTicket(client, id, { tecnicoId: params.tecnicoId, mesaId: params.mesaId });
      } else if (params.operacion === 'cerrar') {
        const sol = (params.solucion ?? '').trim();
        if (sol.length < 5) throw new Error('Solución mínimo 5 caracteres');
        // Cierre directo: el FSM en BD valida la transición por ticket
        await transitionTicket(client, id, 'cerrado' as EstadoTicket, { solucionAplicada: sol });
      } else {
        if (!params.prioridad || !isPrioridadTicket(params.prioridad)) throw new Error('Prioridad inválida');
        await updateTicket(client, id, { prioridad: params.prioridad });
      }
      return { id, ok: true };
    } catch (e) {
      return { id, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };

  const items = await conConcurrencia(ids, concurrencia, aplicar);
  const ok = items.filter((r) => r.ok).length;
  return { total: ids.length, ok, fallos: ids.length - ok, items, ms: Date.now() - t0 };
}
