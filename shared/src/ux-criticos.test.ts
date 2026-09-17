// UX críticos — regresión: Donut svg+a11y, contraste inkOnAccent,
// deep-link cold-start (cola + respuesta inicial + linking) y 0 alert().
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { theme } from './ui/theme.js';

const SRC = new URL('.', import.meta.url);
function leer(rel: string): string {
  return readFileSync(new URL(rel, SRC), 'utf-8');
}

// Luminancia relativa WCAG 2.x para validar el token inkOnAccent.
function luminancia(hex: string): number {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a: string, b: string): number {
  const [hi, lo] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('UX contraste accent', () => {
  it('existe el token inkOnAccent', () => {
    expect(theme.colors.inkOnAccent).toBe('#1A1000');
  });
  it('inkOnAccent sobre accent cumple AA (>= 4.5:1)', () => {
    expect(contraste(theme.colors.accent, theme.colors.inkOnAccent)).toBeGreaterThanOrEqual(4.5);
  });
  it('documenta por qué el blanco salió: blanco sobre accent falla AA', () => {
    expect(contraste(theme.colors.accent, '#FFFFFF')).toBeLessThan(4.5);
  });
  it('Button compartido usa inkOnAccent en variante accent', () => {
    expect(leer('./ui/components.tsx')).toMatch(/buttonAccentText:\s*\{\s*color:\s*theme\.colors\.inkOnAccent/);
  });
});

describe('UX DonutEstado nativo', () => {
  const donut = leer('./ui/charts/DonutEstado.tsx');
  it('usa react-native-svg en vez de conic-gradient', () => {
    expect(donut).toMatch(/from 'react-native-svg'/);
    expect(donut).not.toMatch(/conic-gradient/);
    expect(donut).not.toMatch(/backgroundImage/);
  });
  it('expone resumen accesible para lector de pantalla', () => {
    expect(donut).toMatch(/accessibilityRole="image"/);
    expect(donut).toMatch(/accessibilityLabel=\{resumen\}/);
  });
});

describe('UX deep-link cold-start', () => {
  it('navigationRef tiene cola de pendientes role-aware', () => {
    const nav = leer('../../apps/mobile/src/navigation/navigationRef.ts');
    expect(nav).toMatch(/encolarTicketPendiente/);
    expect(nav).toMatch(/drenarTicketsPendientes/);
    expect(nav).toMatch(/extraerTicketIdDeUrl/);
  });
  it('push.ts lee la respuesta inicial del SO', () => {
    expect(leer('../../apps/mobile/src/lib/push.ts')).toMatch(/getLastNotificationResponseAsync/);
  });
  it('el hook consume respuesta inicial + URL inicial y drena en refresh', () => {
    const hook = leer('../../apps/mobile/src/hooks/usePushNotificaciones.ts');
    expect(hook).toMatch(/getInitialURL/);
    expect(hook).toMatch(/drenarTicketsPendientes/);
  });
  it('RootNavigator declara linking con scheme helpdesk://', () => {
    const root = leer('../../apps/mobile/src/navigation/RootNavigator.tsx');
    expect(root).toMatch(/linking=\{\{/);
    expect(root).toMatch(/helpdesk:\/\//);
  });
});

describe('UX cero alert() nativos', () => {
  function* tsx(dir: string): Generator<string> {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) yield* tsx(p);
      else if (/\.(ts|tsx)$/.test(e) && !/\.test\.(ts|tsx)$/.test(e)) yield p;
    }
  }
  const patron = /(^|[^\w.])alert\(|Alert\.alert\(|window\.alert\(/;
  for (const base of ['../../apps/mobile/src', '../../apps/web/src', '.']) {
    it(`sin alert() en ${base}`, () => {
      const dir = new URL(base, SRC);
      const mal: string[] = [];
      for (const f of tsx(dir.pathname)) {
        const src = readFileSync(f, 'utf-8');
        // useFeedback.show() es el reemplazo válido (no es alert nativo)
        const sinHook = src.replace(/fb\.show\(/g, 'fb_show(');
        if (patron.test(sinHook)) mal.push(f);
      }
      expect(mal).toEqual([]);
    });
  }
  it('useFeedback expone show/ask/close/modal', () => {
    const hook = leer('./ui/useFeedback.tsx');
    expect(hook).toMatch(/export function useFeedback/);
    expect(hook).toMatch(/show/);
    expect(hook).toMatch(/ask/);
    expect(hook).toMatch(/<FeedbackModal/);
  });
});
