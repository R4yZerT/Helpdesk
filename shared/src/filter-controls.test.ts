import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as TestRenderer from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Modal: 'Modal',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
  StyleSheet: {
    absoluteFill: {},
    create: (styles: unknown) => styles,
  },
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const { CalendarDatePicker } = await import('./ui/CalendarDatePicker.js');
const { FilterToolbar } = await import('./ui/FilterToolbar.js');
const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));

function leerArchivo(relativePath: string): string {
  return readFileSync(resolve(PROJECT_ROOT, relativePath), 'utf8');
}

describe('CalendarDatePicker compartido', () => {
  it('abre el calendario y emite la fecha seleccionada en formato ISO', () => {
    const onChange = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      renderer = TestRenderer.create(
        React.createElement(CalendarDatePicker, {
          label: 'Desde',
          value: '2026-06-15',
          onChange,
        }),
      );
    });

    TestRenderer.act(() => {
      renderer.root.findByProps({ testID: 'date-picker-trigger' }).props.onPress();
    });
    expect(renderer.root.findByProps({ testID: 'date-picker-modal' }).props.visible).toBe(true);

    TestRenderer.act(() => {
      renderer.root.findByProps({ testID: 'calendar-day-2026-06-20' }).props.onPress();
    });

    expect(onChange).toHaveBeenCalledWith('2026-06-20');
    expect(renderer.root.findByProps({ testID: 'date-picker-modal' }).props.visible).toBe(false);
  });

  it('deshabilita fechas fuera del rango permitido y permite limpiar', () => {
    const onChange = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      renderer = TestRenderer.create(
        React.createElement(CalendarDatePicker, {
          label: 'Hasta',
          value: '2026-06-15',
          minDate: '2026-06-10',
          maxDate: '2026-06-20',
          onChange,
        }),
      );
    });

    expect(renderer.root.findByProps({ testID: 'calendar-day-2026-06-09' }).props.disabled).toBe(true);
    expect(renderer.root.findByProps({ testID: 'calendar-day-2026-06-21' }).props.disabled).toBe(true);
    expect(renderer.root.findByProps({ testID: 'calendar-day-2026-06-15' }).props.disabled).toBe(false);

    TestRenderer.act(() => {
      renderer.root.findByProps({ testID: 'date-picker-clear' }).props.onPress();
    });
    expect(onChange).toHaveBeenCalledWith('');
  });
});

describe('FilterToolbar compartido', () => {
  it('mantiene la búsqueda controlada, limpia el texto y conserva filtros hijos', () => {
    const onChangeText = vi.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      renderer = TestRenderer.create(
        React.createElement(
          FilterToolbar,
          {
            value: 'impresora',
            onChangeText,
            placeholder: 'Buscar tickets',
            accessibilityLabel: 'Buscar tickets',
          },
          React.createElement('Text', null, 'Estado'),
        ),
      );
    });

    renderer.root.findByProps({ accessibilityLabel: 'Buscar tickets' }).props.onChangeText('red');
    expect(onChangeText).toHaveBeenCalledWith('red');
    expect(renderer.root.findAllByType('Text' as never).some((node) => node.children.includes('Estado'))).toBe(true);

    TestRenderer.act(() => {
      renderer.root.findByProps({ testID: 'filter-search-clear' }).props.onPress();
    });
    expect(onChangeText).toHaveBeenLastCalledWith('');
  });
});

describe('integración de filtros compartidos', () => {
  it('conecta el rango personalizado del dashboard a calendarios con límites cruzados', () => {
    const filterBar = leerArchivo('shared/src/ui/layout/FilterBar.tsx');
    expect(filterBar).toContain('<CalendarDatePicker');
    expect(filterBar).toContain('maxDate={customHasta}');
    expect(filterBar).toContain('minDate={customDesde}');
    expect(filterBar).not.toContain('function DatePickers');
  });

  it('usa FilterToolbar en los listados admin y elimina el buscador duplicado', () => {
    const pantallas = [
      'apps/web/src/features/admin/AdminMesasScreen.tsx',
      'apps/mobile/src/features/admin/AdminMesasScreen.tsx',
      'apps/web/src/features/admin/AdminUsuariosScreen.tsx',
      'apps/mobile/src/features/admin/AdminUsuariosScreen.tsx',
      'apps/web/src/features/admin/AdminCategoriasScreen.tsx',
      'apps/mobile/src/features/admin/AdminCategoriasScreen.tsx',
      'apps/web/src/features/admin/AdminMesaTicketsScreen.tsx',
      'apps/mobile/src/features/admin/AdminMesaTicketsScreen.tsx',
    ];

    const duplicadas = pantallas.filter((path) => {
      const source = leerArchivo(path);
      return !source.includes('FilterToolbar') || /searchWrap\s*:|searchIcon\s*:/.test(source);
    });

    expect(duplicadas).toEqual([]);
  });
});
