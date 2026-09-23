// H6 — aislamiento runtime: una pantalla rota muestra fallback con reintentar,
// reporta a Sentry y no tumba el árbol; tras reintentar se recupera.
// react-native se sustituye por hosts básicos (el SDK nativo no carga en node).
// Sin JSX: el include de vitest es solo *.test.ts.
import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import * as TestRenderer from 'react-test-renderer';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { create: (s: unknown) => s },
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const { ErrorBoundary } = await import('./ui/ErrorBoundary.js');

let fallar = true;

function PantallaRota() {
  if (fallar) throw new Error('tab rota');
  return React.createElement('Text' as never, null, 'OK');
}

function textos(root: TestRenderer.ReactTestRenderer): string {
  return root.root
    .findAllByType('Text' as never)
    .map((n) => String(n.props.children ?? ''))
    .join(' | ');
}

describe('H6 ErrorBoundary aísla la pantalla rota', () => {
  it('fallback + reporte + reintento recupera', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      fallar = true;
      const onError = vi.fn();
      let root!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        root = TestRenderer.create(
          React.createElement(ErrorBoundary, {
            titulo: 'Sección caída',
            onError,
            children: React.createElement(PantallaRota),
          }),
        );
      });
      // 1. El error no tumba el árbol: hay fallback con reintentar
      expect(textos(root)).toContain('Reintentar');
      expect(textos(root)).toContain('Sección caída');
      // 2. El reportero recibe el error original
      expect(onError).toHaveBeenCalledTimes(1);
      expect((onError.mock.calls[0][0] as Error).message).toBe('tab rota');
      // 3. Reintentar recupera la pantalla cuando deja de fallar
      fallar = false;
      const boton = root.root.findByProps({ accessibilityLabel: 'Reintentar' });
      TestRenderer.act(() => {
        (boton.props.onPress as () => void)();
      });
      expect(textos(root)).toContain('OK');
    } finally {
      vi.restoreAllMocks();
    }
  });
});
