// RF-26/A5 — Tests del mapeo CSV → tickets (puro, sin BD).
import { describe, expect, test } from 'vitest';
import {
  mapImportRowsToTickets,
  type ImportCategoria,
  type ImportColumnMap,
} from './import-historico.js';

const CATS: ImportCategoria[] = [
  { id: 1, dominio: 'tic', subcategoria: 'Soporte técnico' },
  { id: 2, dominio: 'rrhh', subcategoria: 'Nómina' },
];
const MESAS = [
  { id: 1, nombre: 'TIC' },
  { id: 2, nombre: 'Talento Humano' },
];
const MAP: ImportColumnMap = { texto: 0, categoria: 1, dependencia: 2, fecha: 3 };
const UID = '00000000-0000-0000-0000-000000000001';

describe('mapImportRowsToTickets', () => {
  test('fila válida mapea todos los campos', () => {
    const res = mapImportRowsToTickets(
      [['El computador no enciende desde ayer en la mañana', 'Soporte técnico', 'TIC', '2024-03-01']],
      MAP,
      CATS,
      MESAS,
      UID,
    );
    expect(res.cuarentena).toBe(0);
    expect(res.valid).toHaveLength(1);
    expect(res.valid[0]).toMatchObject({
      usuario_id: UID,
      mesa_id: 1,
      categoria_id: 1,
      prioridad: 'media',
      estado: 'abierto',
      creado_en: '2024-03-01T00:00:00.000Z',
    });
    expect(res.valid[0].asunto.length).toBeLessThanOrEqual(200);
  });

  test('duplicada y vacía van a cuarentena', () => {
    const texto = 'El computador no enciende desde ayer en la mañana';
    const res = mapImportRowsToTickets(
      [
        [texto, 'Soporte técnico', 'TIC', ''],
        [texto.toUpperCase(), 'Soporte técnico', 'TIC', ''],
        ['', 'Soporte técnico', 'TIC', ''],
      ],
      MAP,
      CATS,
      MESAS,
      UID,
    );
    expect(res.valid).toHaveLength(1);
    expect(res.cuarentena).toBe(2);
  });

  test('texto corto (<10) va a cuarentena (CHECK descripcion)', () => {
    const res = mapImportRowsToTickets([['corto', 'Soporte técnico', 'TIC', '']], MAP, CATS, MESAS, UID);
    expect(res.valid).toHaveLength(0);
    expect(res.cuarentena).toBe(1);
  });

  test('categoría desconocida va a cuarentena (NOT NULL fail-closed)', () => {
    const res = mapImportRowsToTickets(
      [['Un texto suficientemente largo para pasar validación', 'Categoría inexistente', 'TIC', '']],
      MAP,
      CATS,
      MESAS,
      UID,
    );
    expect(res.valid).toHaveLength(0);
    expect(res.cuarentena).toBe(1);
  });

  test('mesa desconocida va a cuarentena', () => {
    const res = mapImportRowsToTickets(
      [['Un texto suficientemente largo para pasar validación', 'Soporte técnico', 'Mesa Fantasma', '']],
      MAP,
      CATS,
      MESAS,
      UID,
    );
    expect(res.valid).toHaveLength(0);
    expect(res.cuarentena).toBe(1);
  });

  test('match categoria dominio:subcategoria y mesa case-insensitive', () => {
    const res = mapImportRowsToTickets(
      [['Un texto suficientemente largo para pasar validación x', 'tic:Soporte Técnico', 'tic', '']],
      MAP,
      CATS,
      MESAS,
      UID,
    );
    expect(res.valid).toHaveLength(1);
    expect(res.valid[0]).toMatchObject({ categoria_id: 1, mesa_id: 1 });
  });

  test('fecha inválida se omite (BD aplica now()) sin descartar la fila', () => {
    const res = mapImportRowsToTickets(
      [['Un texto suficientemente largo para pasar validación', 'Nómina', 'Talento Humano', 'no-es-fecha']],
      MAP,
      CATS,
      MESAS,
      UID,
    );
    expect(res.valid).toHaveLength(1);
    expect(res.valid[0].creado_en).toBeUndefined();
  });
});
