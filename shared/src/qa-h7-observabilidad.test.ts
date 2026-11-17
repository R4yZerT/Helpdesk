// H7 — regresión: las rutas críticas reportan a Sentry y no filtran datos con logs.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APPS_DIR = fileURLToPath(new URL('../../apps/', import.meta.url));

function listarFuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const ruta = join(dir, entry.name);
    if (entry.isDirectory()) return listarFuentes(ruta);
    return /\.(ts|tsx)$/.test(entry.name) ? [ruta] : [];
  });
}

function fuentesDeFeatures(): Array<{ ruta: string; contenido: string }> {
  return ['web', 'mobile'].flatMap((app) =>
    listarFuentes(join(APPS_DIR, app, 'src', 'features')).map((ruta) => ({
      ruta,
      contenido: readFileSync(ruta, 'utf-8'),
    })),
  );
}

const FLUJOS_CRITICOS = [
  'web/src/features/usuario/UsuarioNavigator.tsx',
  'web/src/features/admin/AdminUsuariosScreen.tsx',
  'web/src/features/tickets/MisSolicitudesScreen.tsx',
  'web/src/features/tickets/CreateTicketScreen.tsx',
  'mobile/src/features/admin/AdminUsuariosScreen.tsx',
  'mobile/src/features/admin/AdminMesasScreen.tsx',
  'mobile/src/features/admin/AdminCategoriasScreen.tsx',
  'mobile/src/features/admin/AdminMesaTicketsScreen.tsx',
  'mobile/src/features/tickets/MisSolicitudesScreen.tsx',
  'mobile/src/features/tickets/CreateTicketScreen.tsx',
  'mobile/src/features/tickets/components/TicketTabs.tsx',
  'mobile/src/lib/share-csv.ts',
];

describe('H7 observabilidad en rutas críticas', () => {
  const fuentes = fuentesDeFeatures();

  it('las features no escriben logs directos', () => {
    const infractoras = fuentes
      .filter(({ contenido }) => /console\.(log|warn|error)/.test(contenido))
      .map(({ ruta }) => ruta);
    expect(infractoras).toEqual([]);
  });

  it('crear ticket no registra el formulario en consola', () => {
    const infractoras = fuentes
      .filter(({ contenido }) => contenido.includes("console.log('[CreateTicket] submit'"))
      .map(({ ruta }) => ruta);
    expect(infractoras).toEqual([]);
  });

  it('los flujos críticos reportan errores con contexto', () => {
    const faltantes = FLUJOS_CRITICOS.filter((rel) => {
      const contenido = readFileSync(join(APPS_DIR, rel), 'utf-8');
      return !contenido.includes('reportError(') || !contenido.includes('flujo:');
    });
    expect(faltantes).toEqual([]);
    expect(fuentes.length).toBeGreaterThan(0);
  });
});

