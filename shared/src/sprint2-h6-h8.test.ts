// Sprint 2 — pins estáticos H6 (pantallas aisladas) y H8 (mapAdjunto canónico).
// Siguen el patrón de los tests de regresión SQL: leen fuentes y verifican
// invariantes. El aislamiento runtime se verifica en E2E/smoke (Sprint 4).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function leer(ruta: string): string {
  return readFileSync(new URL(ruta, import.meta.url), 'utf-8');
}

describe('H8 mapAdjunto sin fallbacks legacy', () => {
  const src = leer('./tickets.ts');

  it('no referencia columnas heredadas', () => {
    for (const col of ['row.ruta', 'row.nombre ', 'row.filename', 'mime_type', 'row.size', 'row.bytes']) {
      expect(src).not.toContain(col);
    }
  });

  it('usa solo columnas canónicas', () => {
    for (const col of ['storage_path', 'nombre_original', 'row.mime ', 'tamano_bytes']) {
      expect(src).toContain(col);
    }
  });
});

describe('H6 pantallas aisladas con withScreenBoundary', () => {
  const casos: Array<{ archivo: string; pantallas: string[] }> = [
    {
      archivo: '../../apps/web/src/features/tecnico/TecnicoNavigator.tsx',
      pantallas: ['BandejaTecnicoScreen', 'CreateTicketScreen', 'DetalleTecnicoScreen', 'PerfilScreen'],
    },
    {
      archivo: '../../apps/web/src/features/admin/AdminNavigator.tsx',
      pantallas: ['AdminMesaTicketsScreen', 'AdminMesasScreen', 'AdminUsuariosScreen', 'AdminCategoriasScreen', 'AdminImportScreen', 'TicketDetailScreen', 'PerfilScreen'],
    },
    {
      archivo: '../../apps/mobile/src/navigation/TecnicoNavigator.tsx',
      pantallas: ['BandejaTecnicoScreen', 'CreateTicketScreen', 'DetalleTecnicoScreen'],
    },
    {
      archivo: '../../apps/mobile/src/features/admin/AdminNavigator.tsx',
      pantallas: ['AdminUsuariosScreen', 'AdminMesaTicketsScreen', 'AdminMesasScreen', 'AdminCategoriasScreen', 'DetalleTecnicoScreen', 'PerfilScreen'],
    },
  ];

  for (const { archivo, pantallas } of casos) {
    it(`${archivo} envuelve cada pantalla`, () => {
      const src = leer(archivo);
      expect(src).toContain('withScreenBoundary');
      expect(src).toContain('reportError');
      for (const p of pantallas) {
        expect(src).toContain(`withScreenBoundary(${p}`);
      }
      // Ninguna pantalla cruda llega directo al Navigator
      for (const p of pantallas) {
        expect(src).not.toContain(`component={${p}}`);
      }
    });
  }
});
