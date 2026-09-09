import { describe, expect, it } from 'vitest';
import { buildExportFilename, formatFiltrosResumen, ticketsToRows, toCsv, toCsvWithMeta } from './export.js';

describe('RF-18 export helpers', () => {
  it('ticketsToRows soporta Ticket camelCase y raw snake_case', () => {
    const ticket: any = { numero: 42, asunto: 'Hola\nmundo', estado: 'abierto', prioridad: 'alta', mesaId: 1, categoriaId: 5, creadoEn: '2026-09-08T10:00:00Z', actualizadoEn: '2026-09-08T11:00:00Z' };
    const raw: any = { numero: 99, asunto: 'raw', estado: 'cerrado', prioridad: 'baja', mesa_id: 2, categoria_id: 7, creado_en: '2026-09-07T00:00:00Z', actualizado_en: '2026-09-07T01:00:00Z' };
    const rows = ticketsToRows([ticket, raw], (id) => `Mesa-${id}`);
    expect(rows[0]).toMatchObject({ numero: 42, mesa: 'Mesa-1', categoria: 5 });
    expect(rows[0].asunto).toBe('Hola mundo'); // \n -> espacio
    expect(rows[1]).toMatchObject({ numero: 99, mesa: 'Mesa-2', categoria: 7 });
  });

  it('toCsv escapa comillas y usa header fijo', () => {
    const rows = [{ numero: 1, asunto: 'a\"b', estado: 'abierto', prioridad: 'media', mesa: 'TIC', categoria: 1, creado: '2026-09-08', actualizado: '2026-09-08' }];
    const csv = toCsv(rows as any);
    expect(csv.split('\r\n')[0]).toBe('"numero","asunto","estado","prioridad","mesa","categoria","creado","actualizado"');
    expect(csv).toContain('"a""b"'); // comillas duplicadas
  });

  it('buildExportFilename formatea prefix-fecha.ext', () => {
    const name = buildExportFilename('dashboard', 'csv');
    expect(name).toMatch(/^dashboard-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('formatFiltrosResumen sin filtros -> Sin filtros', () => {
    expect(formatFiltrosResumen({})).toBe('Sin filtros (todo)');
  });

  it('formatFiltrosResumen combina 6 filtros', () => {
    const s = formatFiltrosResumen(
      { desde: '2026-09-01T00:00:00Z', hasta: '2026-09-08T00:00:00Z', mesaIds: [1], categoriaId: 5, estado: 'abierto', prioridad: 'alta', tecnicoId: 'uuid-1' },
      { mesaName: (id) => (id === 1 ? 'TIC' : String(id)), categoriaName: (id) => `Cat-${id}`, tecnicoName: (id) => `Tec-${id}` },
    );
    expect(s).toContain('Rango: 2026-09-01 → 2026-09-08');
    expect(s).toContain('Mesas: TIC');
    expect(s).toContain('Categoría: Cat-5');
    expect(s).toContain('Estado: abierto');
    expect(s).toContain('Prioridad: alta');
    expect(s).toContain('Técnico: Tec-uuid-1');
  });

  it('toCsvWithMeta incluye 3 lineas # + csv', () => {
    const rows = [{ numero: 1, asunto: 'x', estado: 'abierto', prioridad: 'media', mesa: 'TIC', categoria: 1, creado: '2026-09-08', actualizado: '2026-09-08' }];
    const csv = toCsvWithMeta(rows as any, { estado: 'abierto' });
    const lines = csv.split('\r\n');
    expect(lines[0]).toMatch(/^# Generado:/);
    expect(lines[1]).toContain('# Filtros: Estado: abierto');
    expect(lines[2]).toContain('# Registros: 1');
    expect(lines[3]).toContain('"numero"');
  });

  it('toCsv vacio solo header', () => {
    expect(toCsv([]).split('\r\n')).toHaveLength(1);
  });
});
