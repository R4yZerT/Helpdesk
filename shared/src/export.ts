// Export helpers — CSV (papaparse en web) / JSON fallback nativo, y Print-to-PDF via window.print
// Sprint 6: botones Exportar PDF/CSV del Dashboard usan estos helpers sin deps nativas extra.
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

export function ticketsToRows(tickets: Ticket[], mesaName?: (id: number | null) => string): ExportRow[] {
  return tickets.map((t) => ({
    numero: t.numero,
    asunto: t.asunto.replace(/\r?\n/g, ' '),
    estado: t.estado,
    prioridad: t.prioridad,
    mesa: mesaName ? mesaName(t.mesaId ?? null) : (t.mesaId ?? '—'),
    categoria: t.categoriaId,
    creado: t.creadoEn,
    actualizado: (t as any).actualizadoEn ?? t.creadoEn,
  }));
}

export function toCsv(rows: ExportRow[]): string {
  const header = ['numero', 'asunto', 'estado', 'prioridad', 'mesa', 'categoria', 'creado', 'actualizado'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [header.map(esc).join(','), ...rows.map((r) => header.map((k) => esc((r as any)[k])).join(','))];
  return lines.join('\r\n');
}

export function downloadCsv(filename: string, csv: string) {
  // RN no tiene document — caller debe manejar via FileSystem/Sharing; web usa blob
  if (typeof document === 'undefined') return;
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
}

export function printDashboard() {
  if (typeof window !== 'undefined' && typeof window.print === 'function') window.print();
}
