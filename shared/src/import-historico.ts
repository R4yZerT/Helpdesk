// RF-26/A5 — Mapeo CSV histórico → filas `tickets` (puro y testeable).
// Espeja las restricciones de BD: asunto 5–200, descripcion 10–5000,
// categoria_id/mesa_id NOT NULL, dedup por texto normalizado (NFD).
import type { EstadoTicket, PrioridadTicket } from './types.js';

export type ImportColumnMap = {
  texto: number;
  categoria: number;
  dependencia: number;
  fecha: number;
};

export type ImportCategoria = {
  id: number;
  dominio: string;
  subcategoria: string;
};

export type ImportMesa = {
  id: number;
  nombre: string;
};

export type ImportTicketRow = {
  usuario_id: string;
  mesa_id: number;
  categoria_id: number;
  asunto: string;
  descripcion: string;
  prioridad: PrioridadTicket;
  estado: EstadoTicket;
  creado_en?: string;
};

export type ImportMapResult = {
  valid: ImportTicketRow[];
  /** Filas descartadas: vacías, duplicadas, inválidas o sin match de categoría/mesa */
  cuarentena: number;
};

const norm = (s: string) => s.normalize('NFD').toLowerCase().trim();

function matchCategoria(label: string, categorias: ImportCategoria[]): number | null {
  const key = norm(label);
  if (!key) return null;
  for (const c of categorias) {
    if (key === norm(`${c.dominio}:${c.subcategoria}`) || key === norm(c.subcategoria)) return c.id;
  }
  return null;
}

function matchMesa(label: string, mesas: ImportMesa[]): number | null {
  const key = norm(label);
  if (!key) return null;
  for (const m of mesas) {
    if (key === norm(m.nombre)) return m.id;
  }
  return null;
}

export function mapImportRowsToTickets(
  rows: string[][],
  map: ImportColumnMap,
  categorias: ImportCategoria[],
  mesas: ImportMesa[],
  usuarioId: string,
): ImportMapResult {
  const valid: ImportTicketRow[] = [];
  let cuarentena = 0;
  const seen = new Set<string>();

  for (const r of rows) {
    const texto = map.texto >= 0 ? (r[map.texto] ?? '').trim() : '';
    const key = norm(texto);
    // Vacía o duplicada → cuarentena (igual que el resumen en cliente)
    if (!texto || seen.has(key)) {
      cuarentena++;
      continue;
    }
    // Espeja CHECK BD: descripcion 10–5000, asunto 5–200 (asunto = prefijo del texto)
    if (texto.length < 10 || texto.length > 5000) {
      cuarentena++;
      continue;
    }
    const categoriaId =
      map.categoria >= 0 ? matchCategoria(r[map.categoria] ?? '', categorias) : null;
    if (categoriaId === null) {
      cuarentena++;
      continue;
    }
    const mesaId =
      map.dependencia >= 0 ? matchMesa(r[map.dependencia] ?? '', mesas) : null;
    if (mesaId === null) {
      cuarentena++;
      continue;
    }
    seen.add(key);
    const row: ImportTicketRow = {
      usuario_id: usuarioId,
      mesa_id: mesaId,
      categoria_id: categoriaId,
      asunto: texto.slice(0, 200),
      descripcion: texto,
      prioridad: 'media',
      estado: 'abierto',
    };
    // Fecha histórica opcional: si no parsea se omite (BD aplica now())
    if (map.fecha >= 0) {
      const raw = (r[map.fecha] ?? '').trim();
      if (raw) {
        const t = Date.parse(raw);
        if (!Number.isNaN(t)) row.creado_en = new Date(t).toISOString();
      }
    }
    valid.push(row);
  }

  return { valid, cuarentena };
}
