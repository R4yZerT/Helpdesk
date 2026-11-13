import type { SupabaseClient } from '@supabase/supabase-js';

export type DashboardQueryFilters = {
  desde?: string;
  hasta?: string;
  mesaIds?: number[];
  categoriaId?: number;
  estado?: string;
  prioridad?: string;
  tecnicoId?: string;
};

const DASHBOARD_PAGE_SIZE = 1000;

function applyFilters(query: any, filters: DashboardQueryFilters) {
  if (filters.desde) query = query.gte('creado_en', filters.desde);
  if (filters.hasta) query = query.lte('creado_en', filters.hasta);
  if (filters.mesaIds?.length) query = query.in('mesa_id', filters.mesaIds);
  if (filters.categoriaId) query = query.eq('categoria_id', filters.categoriaId);
  if (filters.estado) query = query.eq('estado', filters.estado);
  if (filters.prioridad) query = query.eq('prioridad', filters.prioridad);
  if (filters.tecnicoId) query = query.eq('tecnico_asignado_id', filters.tecnicoId);
  return query;
}

export async function fetchDashboardTicketRows(
  client: SupabaseClient,
  columns: string,
  filters: DashboardQueryFilters,
): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; ; offset += DASHBOARD_PAGE_SIZE) {
    let query: any = client.from('tickets').select(columns)
      .order('id', { ascending: true })
      .range(offset, offset + DASHBOARD_PAGE_SIZE - 1);
    query = applyFilters(query, filters);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const page = (data ?? []) as any[];
    rows.push(...page);
    if (page.length < DASHBOARD_PAGE_SIZE) return rows;
  }
}

export async function fetchTicketsFiltrados(
  client: SupabaseClient,
  filters: DashboardQueryFilters,
  limit = 2000,
): Promise<any[]> {
  const maxRows = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  const rows: any[] = [];
  for (let offset = 0; offset < maxRows; offset += DASHBOARD_PAGE_SIZE) {
    const pageSize = Math.min(DASHBOARD_PAGE_SIZE, maxRows - offset);
    let query: any = client.from('tickets')
      .select('numero,asunto,estado,prioridad,mesa_id,categoria_id,creado_en,actualizado_en')
      .order('creado_en', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1);
    query = applyFilters(query, filters);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const page = (data ?? []) as any[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}
