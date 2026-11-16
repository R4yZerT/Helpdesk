// Regresión de layout compartido: ScreenHeader renderiza y navegadores no duplican tokens.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import * as TestRenderer from 'react-test-renderer';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (s: unknown) => s },
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const { ScreenHeader } = await import('./ui/layout/ScreenHeader.js');
const { EmptyState, ListFooter, ListLoading } = await import('./ui/ListStates.js');

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function leer(rel: string): string {
  return readFileSync(`${ROOT}${rel}`, 'utf-8');
}

function textos(root: TestRenderer.ReactTestRenderer): string {
  return root.root
    .findAllByType('Text' as never)
    .map((n) => String(n.props.children ?? ''))
    .join(' | ');
}

describe('ScreenHeader compartido', () => {
  it('muestra kicker, título, subtítulo, acciones y contenido', () => {
    let root!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      root = TestRenderer.create(
        React.createElement(
          ScreenHeader,
          {
            kicker: 'Administrador',
            kickerDot: true,
            title: 'Usuarios',
            subtitle: 'Gestión centralizada',
            actions: React.createElement('Text', null, 'Acción'),
          },
          React.createElement('Text', null, 'Contenido'),
        ),
      );
    });
    const salida = textos(root);
    expect(salida).toContain('Administrador');
    expect(salida).toContain('Usuarios');
    expect(salida).toContain('Gestión centralizada');
    expect(salida).toContain('Acción');
    expect(salida).toContain('Contenido');
  });
});

describe('estados de lista compartidos', () => {
  it('muestra carga, contenido vacío y estado opcional de paginación', () => {
    let loading!: TestRenderer.ReactTestRenderer;
    let empty!: TestRenderer.ReactTestRenderer;
    let footer!: TestRenderer.ReactTestRenderer;
    let hiddenFooter!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      loading = TestRenderer.create(
        React.createElement(ListLoading, { label: 'Cargando usuarios…' }),
      );
      empty = TestRenderer.create(
        React.createElement(
          EmptyState,
          { title: 'Sin usuarios', description: 'Ajusta filtros.' },
          React.createElement('Text', null, 'Crear usuario'),
        ),
      );
      footer = TestRenderer.create(React.createElement(ListFooter, { loading: true }));
      hiddenFooter = TestRenderer.create(React.createElement(ListFooter, { loading: false }));
    });

    expect(textos(loading)).toContain('Cargando usuarios…');
    expect(textos(empty)).toContain('Sin usuarios');
    expect(textos(empty)).toContain('Ajusta filtros.');
    expect(textos(empty)).toContain('Crear usuario');
    expect(footer.root.findAllByType('ActivityIndicator' as never)).toHaveLength(1);
    expect(hiddenFooter.toJSON()).toBeNull();
  });
});

describe('navegación y headers sin duplicación local', () => {
  const WEB_NAVEGADORES = [
    'apps/web/src/features/admin/AdminNavigator.tsx',
    'apps/web/src/features/tecnico/TecnicoNavigator.tsx',
    'apps/web/src/features/jefe/JefeNavigator.tsx',
    'apps/web/src/features/usuario/UsuarioNavigator.tsx',
  ];

  it('los navegadores web usan las opciones compartidas', () => {
    const faltantes = WEB_NAVEGADORES.filter((rel) => {
      const fuente = leer(rel);
      return !fuente.includes('APP_HEADER_OPTIONS') || /const screenOpts\s*=/.test(fuente);
    });
    expect(faltantes).toEqual([]);
  });

  it('mobile centraliza header y tabs en nav-options', () => {
    const fuente = leer('apps/mobile/src/navigation/nav-options.tsx');
    expect(fuente).toContain('APP_HEADER_OPTIONS');
    expect(fuente).toContain('APP_TAB_OPTIONS');
  });

  it('el shell web móvil reutiliza AppShell', () => {
    const fuente = leer('apps/mobile/src/features/usuario/UsuarioNavigator.tsx');
    expect(fuente).toContain('<AppShell');
    expect(fuente).not.toContain('UsuarioWebInner');
    expect(fuente).not.toContain('w.sidebar');
  });

  it('las pantallas migradas usan ScreenHeader', () => {
    const pantallas = [
      'apps/mobile/src/features/tecnico/BandejaTecnicoScreen.tsx',
      'apps/mobile/src/features/admin/AdminMesasScreen.tsx',
      'apps/mobile/src/features/admin/AdminUsuariosScreen.tsx',
      'apps/web/src/features/admin/AdminMesasScreen.tsx',
      'apps/web/src/features/admin/AdminUsuariosScreen.tsx',
    ];
    const faltantes = pantallas.filter((rel) => !leer(rel).includes('ScreenHeader'));
    expect(faltantes).toEqual([]);
  });

  it('las pantallas admin comparten loading, empty state y paginación', () => {
    const pantallas = [
      'apps/mobile/src/features/admin/AdminMesasScreen.tsx',
      'apps/mobile/src/features/admin/AdminUsuariosScreen.tsx',
      'apps/web/src/features/admin/AdminMesasScreen.tsx',
      'apps/web/src/features/admin/AdminUsuariosScreen.tsx',
    ];
    const faltantes = pantallas.filter((rel) => {
      const fuente = leer(rel);
      return (
        !fuente.includes('<ListLoading') ||
        !fuente.includes('<EmptyState') ||
        !fuente.includes('<ListFooter') ||
        /emptyTitle:\s*\{/.test(fuente)
      );
    });
    expect(faltantes).toEqual([]);
  });
});
