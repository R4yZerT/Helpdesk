// Tarjeta métricas BETO en dashboard jefe — regresión.
// Si alguien elimina el fetch, la tarjeta o el render en web/móvil, este test falla.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { getMetricasIaFeedback } from './dashboard.js';

function repo(rel: string): string {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
}

function fakeClient(rows: any[] | null, error: any = null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(async () => ({ data: rows, error })),
      })),
    })),
  } as any;
}

describe('getMetricasIaFeedback', () => {
  it('mapea filas snake_case a MetricaIaFuente', async () => {
    const out = await getMetricasIaFeedback(fakeClient([
      { fuente: 'beto', total: 10, pendientes: 2, confirmadas: 7, corregidas: 1, precision_validada: 0.875, confianza_promedio: 0.91 },
      { fuente: 'reglas', total: 5, pendientes: 5, confirmadas: 0, corregidas: 0, precision_validada: null, confianza_promedio: null },
    ]));
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ fuente: 'beto', total: 10, pendientes: 2, confirmadas: 7, corregidas: 1, precisionValidada: 0.875, confianzaPromedio: 0.91 });
    expect(out[1].precisionValidada).toBeNull();
  });

  it('retorna [] ante error o excepción (vista aún sin migrar)', async () => {
    expect(await getMetricasIaFeedback(fakeClient(null, { message: 'relation does not exist' }))).toEqual([]);
    expect(await getMetricasIaFeedback({ from: () => { throw new Error('off'); } } as any)).toEqual([]);
  });
});

describe('tarjeta PrecisionIa cableada', () => {
  it('componente con empty-state, precisión y resumen a11y', () => {
    const c = repo('shared/src/ui/charts/PrecisionIa.tsx');
    expect(c).toContain('precisionValidada');
    expect(c).toContain('accessibilityLabel');
    expect(c).toMatch(/sin validaciones|vac[ií]o|sin datos/i);
  });

  it('dashboards web y móvil la consultan y renderizan', () => {
    for (const f of ['apps/web/src/features/dashboard/DashboardScreen.tsx', 'apps/mobile/src/features/dashboard/DashboardScreen.tsx']) {
      const s = repo(f);
      expect(s, f).toContain('getMetricasIaFeedback');
      expect(s, f).toContain('setMetricasIa');
      expect(s, f).toContain('<PrecisionIa data={metricasIa}');
    }
  });

  it('PrecisionIa y getMetricasIaFeedback se exportan desde shared', () => {
    const idx = repo('shared/src/index.ts');
    expect(idx).toContain('PrecisionIa');
    const dash = repo('shared/src/dashboard.ts');
    expect(dash).toContain('metricas_ia_feedback');
  });
});
