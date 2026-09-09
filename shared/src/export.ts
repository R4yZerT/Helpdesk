// Export helpers RF-18 — CSV / PDF del dashboard filtrado (Sprint 6)
// Soporta todos los filtros RF-17: desde/hasta, mesaIds, categoriaId, estado, prioridad, tecnicoId
import type { DashboardFilters } from './dashboard.js';
import type { Ticket } from './types.js';

export type ExportRow = {
  numero: number;
  asunto: string;
  estado: string;
  prioridad: string;
  mesa: string | number;
  categoria: number;
  creado: string;
  actualizado: string;
};

// Acepta tanto Ticket (camelCase) como filas crudas de Supabase (snake_case)
type RawRow = Partial<Ticket> & Record<string, unknown>;

function toNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function ticketsToRows(
  tickets: (Ticket | RawRow)[],
  mesaName?: (id: number | null) => string,
): ExportRow[] {
  return tickets.map((t: any) => {
    const numero = toNumber(t.numero ?? t.id, 0);
    const asunto = String(t.asunto ?? '').replace(/\r?\n/g, ' ');
    const estado = String(t.estado ?? '');
    const prioridad = String(t.prioridad ?? '');
    // mesa: acepta mesaId (Ticket) o mesa_id (raw)
    const rawMesa = t.mesaId ?? t.mesa_id ?? null;
    const mesa: string | number =
      mesaName && rawMesa != null ? mesaName(toNumber(rawMesa, rawMesa as number)) : (rawMesa ?? '—');
    const categoria = toNumber(t.categoriaId ?? t.categoria_id, 0);
    const creado = String(t.creadoEn ?? t.creado_en ?? '');
    const actualizado = String(t.actualizadoEn ?? t.actualizado_en ?? creado);
    return { numero, asunto, estado, prioridad, mesa, categoria, creado, actualizado };
  });
}

export function toCsv(rows: ExportRow[]): string {
  const header = ['numero', 'asunto', 'estado', 'prioridad', 'mesa', 'categoria', 'creado', 'actualizado'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [header.map(esc).join(','), ...rows.map((r) => header.map((k) => esc((r as any)[k])).join(','))];
  return lines.join('\r\n');
}

/** Nombre de archivo con fecha local YYYY-MM-DD */
export function buildExportFilename(prefix: string, ext: 'csv' | 'pdf' | 'png' = 'csv'): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

/** Resumen legible de filtros aplicados para cabecera PDF/CSV */
export function formatFiltrosResumen(
  f: DashboardFilters,
  opts?: {
    mesaName?: (id: number) => string;
    categoriaName?: (id: number) => string;
    tecnicoName?: (id: string) => string;
  },
): string {
  const parts: string[] = [];
  if (f.desde || f.hasta) {
    const d = f.desde ? String(f.desde).slice(0, 10) : '—';
    const h = f.hasta ? String(f.hasta).slice(0, 10) : '—';
    parts.push(`Rango: ${d} → ${h}`);
  }
  if (f.mesaIds?.length) {
    const names = opts?.mesaName ? f.mesaIds.map((id) => opts!.mesaName!(id)) : f.mesaIds;
    parts.push(`Mesas: ${names.join(', ')}`);
  }
  if (f.categoriaId) {
    const name = opts?.categoriaName ? opts.categoriaName(f.categoriaId) : String(f.categoriaId);
    parts.push(`Categoría: ${name}`);
  }
  if (f.estado) parts.push(`Estado: ${f.estado}`);
  if (f.prioridad) parts.push(`Prioridad: ${f.prioridad}`);
  if (f.tecnicoId) {
    const name = opts?.tecnicoName ? opts.tecnicoName(f.tecnicoId) : f.tecnicoId;
    parts.push(`Técnico: ${name}`);
  }
  return parts.length ? parts.join(' · ') : 'Sin filtros (todo)';
}

/** CSV con metadatos en comentarios `#` — respeta RF-18 (filtros + fecha generación) */
export function toCsvWithMeta(rows: ExportRow[], f: DashboardFilters, opts?: Parameters<typeof formatFiltrosResumen>[1]): string {
  const meta = [`# Generado: ${new Date().toISOString()}`, `# Filtros: ${formatFiltrosResumen(f, opts)}`, `# Registros: ${rows.length}`];
  return [...meta, toCsv(rows)].join('\r\n');
}

export function downloadCsv(filename: string, csv: string) {
  // RN no tiene document — caller debe manejar fallback
  if (typeof document === 'undefined') return false;
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export function printDashboard() {
  if (typeof window !== 'undefined' && typeof window.print === 'function') window.print();
}
