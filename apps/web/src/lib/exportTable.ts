// Exportación basada en datos (no screenshots).
// Motivo: html2canvas sobre FlatList virtualizados / scroll produce PNG y PDF
// vacíos; y exportar solo la página cargada deja CSV incompletos. Estas
// funciones generan los archivos desde el dataset completo ya filtrado.
import { toCsvSimple, downloadCsv, buildExportFilename } from '@helpdesk/shared';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export type ExportTable = {
  title: string;
  subtitle?: string;
  header: string[];
  rows: unknown[][];
};

const PDF_MAX_ROWS = 2000;
const PNG_MAX_ROWS = 120;

/** CSV limpio apto para Excel: primera fila siempre el header, sin líneas `#`. */
export function exportTableCsv(prefix: string, table: ExportTable): { filename: string; count: number; ok: boolean } {
  const filename = buildExportFilename(prefix, 'csv');
  const ok = downloadCsv(filename, toCsvSimple(table.header, table.rows));
  return { filename, count: table.rows.length, ok };
}

/** PDF tabulado con jsPDF (texto real, paginado). No depende del DOM renderizado. */
export function exportTablePdf(prefix: string, table: ExportTable): { filename: string; count: number } {
  const filename = buildExportFilename(prefix, 'pdf');
  const rows = table.rows.slice(0, PDF_MAX_ROWS);
  const truncated = table.rows.length > rows.length;
  // Horizontal si hay muchas columnas o celdas largas
  const landscape = table.header.length > 4;
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageW = landscape ? 297 : 210;
  const pageH = landscape ? 210 : 297;
  const margin = 12;
  const usableW = pageW - margin * 2;
  const colW = usableW / Math.max(1, table.header.length);
  const fontSize = table.header.length > 5 ? 7.5 : 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(table.title, margin, 16);
  let y = 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  const subtitle = `${table.subtitle ?? ''}${table.subtitle ? ' · ' : ''}${rows.length} registros${truncated ? ` (primeros ${PDF_MAX_ROWS} — usa CSV para el total)` : ''} · ${new Date().toLocaleString()}`;
  doc.text(subtitle, margin, y);
  y += 8;
  doc.setTextColor(0);

  const drawHeader = () => {
    doc.setFillColor(14, 135, 226);
    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize);
    doc.rect(margin, y, usableW, 8, 'F');
    table.header.forEach((h, i) => {
      doc.text(String(h).slice(0, 28), margin + i * colW + 2, y + 5.5);
    });
    y += 8;
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
  };

  drawHeader();
  rows.forEach((row, r) => {
    // Altura de fila según la celda con más líneas
    const cellLines = table.header.map((_, i) => doc.splitTextToSize(String(row[i] ?? ''), colW - 4) as string[]);
    const lines = Math.max(1, ...cellLines.map((l) => l.length));
    const rowH = Math.min(24, lines * (fontSize * 0.45) + 3);
    if (y + rowH > pageH - 14) {
      doc.addPage();
      y = 16;
      drawHeader();
    }
    if (r % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, usableW, rowH, 'F');
    }
    doc.setFontSize(fontSize);
    cellLines.forEach((cell, i) => {
      doc.text(cell.slice(0, 4), margin + i * colW + 2, y + 4.5);
    });
    y += rowH;
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`${table.title} · pág. ${p}/${pages}`, margin, pageH - 8);
  }
  doc.save(filename);
  return { filename, count: rows.length };
}

/** PNG desde una tabla HTML plana offscreen (incluye todas las filas visibles, no viewport). */
export async function exportTablePng(prefix: string, table: ExportTable): Promise<{ filename: string; count: number }> {
  if (typeof document === 'undefined') throw new Error('Exportar PNG solo disponible en web');
  const filename = buildExportFilename(prefix, 'png');
  const rows = table.rows.slice(0, PNG_MAX_ROWS);
  const truncated = table.rows.length > rows.length;
  const host = document.createElement('div');
  host.setAttribute('data-export-snapshot', 'true');
  const cell = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  host.innerHTML =
    `<div style="font-family:Arial,sans-serif;background:#F8FAFC;padding:24px;width:960px;">` +
    `<h2 style="font-size:18px;color:#0F172A;margin:0 0 4px;">${cell(table.title)}</h2>` +
    `<p style="font-size:12px;color:#64748B;margin:0 0 12px;">${cell(table.subtitle ?? '')} · ${rows.length} registros${truncated ? ` (primeros ${PNG_MAX_ROWS} — usa CSV/PDF para el total)` : ''}</p>` +
    `<table style="border-collapse:collapse;width:100%;background:#fff;font-size:12px;">` +
    `<tr>${table.header.map((h) => `<th style="background:#0E87E2;color:#fff;text-align:left;padding:6px 8px;border:1px solid #0E87E2;">${cell(h)}</th>`).join('')}</tr>` +
    rows.map((r) => `<tr>${table.header.map((_, i) => `<td style="padding:6px 8px;border:1px solid #E2E8F0;color:#0F172A;">${cell(r[i])}</td>`).join('')}</tr>`).join('') +
    `</table></div>`;
  // Fuera de pantalla pero con layout real (html2canvas necesita medidas)
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  document.body.appendChild(host);
  try {
    const el = host.firstElementChild as HTMLElement;
    const canvas = await html2canvas(el, { backgroundColor: '#F8FAFC', scale: 2, useCORS: true, logging: false });
    const url = canvas.toDataURL('image/png');
    if (!canvas.width || !canvas.height || url.length < 4000) {
      throw new Error('La captura salió vacía. Usa CSV o PDF para este contenido.');
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    return { filename, count: rows.length };
  } finally {
    host.remove();
  }
}
