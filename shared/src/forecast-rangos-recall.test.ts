// Lote forecast B+C+A — contratos: rangos q10–q90, forecast fresco y recall.
// - Patrón repo: vitest que lee archivos como texto (sin importar RN ni ejecutar SQL).
// - Las funciones puras (estadoFrescuraPronostico, mapearPronosticoDia vía
//   getPronosticoSemanal con mocks) se prueban con ejecución real.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estadoFrescuraPronostico, getPronosticoSemanal, type PronosticoDia } from './dashboard.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const leer = (rel: string) => readFileSync(join(raiz, rel), 'utf8');

function mockQuery(result: { data?: unknown; error?: { message: string } | null }) {
  const q: Record<string, (...args: unknown[]) => unknown> = {};
  for (const m of ['select', 'order', 'limit', 'gte']) q[m] = () => q;
  (q as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(resolve);
  return q;
}
const dia = (parche: Partial<PronosticoDia> = {}): PronosticoDia => ({
  fecha: '2026-09-21', serie: 'global', forecast: 30, nivel: 'pico', esPico: true,
  modeloVersion: 'v1', lo: 24.1, hi: 36.8, generadoEn: '2026-09-14T06:00:00Z', ...parche,
});

describe('forecast B — rangos q10–q90', () => {
  it('forecast_picos.py emite lo/hi por día y cobertura en métricas', () => {
    const py = leer('ml/src/forecast_picos.py');
    expect(py).toMatch(/"lo":\s*round\(max\(0/);
    expect(py).toMatch(/"hi":\s*round\(max\(0/);
    expect(py).toMatch(/cobertura_q10_q90/);
    expect(py).toMatch(/--umbral-pico-q|--umbral_pico_q/);
  });
  it('migración añade columnas lo/hi/generado_en', () => {
    const sql = leer('supabase/migrations/20261021000000_forecast_rangos_frescura.sql');
    expect(sql).toMatch(/add column[^;]*\blo\b/i);
    expect(sql).toMatch(/add column[^;]*\bhi\b/i);
    expect(sql).toMatch(/add column[^;]*generado_en/i);
  });
  it('upload persiste lo/hi/generado_en (builder + SQL)', () => {
    const builder = leer('shared/src/pronostico-upload.ts');
    expect(builder).toMatch(/\blo\b/);
    expect(builder).toMatch(/\bhi\b/);
    expect(builder).toMatch(/generadoEn/);
    const up = leer('scripts/upload-pronostico.ts');
    expect(up).toMatch(/forecast_meta\.json/);
    expect(up).toMatch(/generado_en/);
  });
  it('dashboard mapea lo/hi/generadoEn y usa fallback legacy con from() fresco', () => {
    const ts = leer('shared/src/dashboard.ts');
    expect(ts).toMatch(/SELECT_PRONOSTICO_LEGACY/);
    expect(ts).toMatch(/lo: r\.lo == null \? null/);
  });
  it('getPronosticoSemanal recupera ante BD sin columnas (fallback legacy)', async () => {
    const fila = { fecha: '2026-09-20', serie: 'global', forecast: 12.5, nivel: 'alta', es_pico: true, modelo_version: 'v1' };
    let llamadas = 0;
    const cliente = {
      from: () => ({
        select: (cols: string) => {
          llamadas += 1;
          // Primera llamada (con lo/hi) falla como BD sin migración; la legacy no
          const error = cols.includes(',lo,') ? { message: 'column "lo" does not exist' } : null;
          return mockQuery({ data: error ? null : [fila], error });
        },
      }),
    } as never;
    const dias = await getPronosticoSemanal(cliente);
    expect(llamadas).toBe(2);
    expect(dias).toEqual([{ fecha: '2026-09-20', serie: 'global', forecast: 12.5, nivel: 'alta', esPico: true, modeloVersion: 'v1', lo: null, hi: null, generadoEn: null }]);
  });
});

describe('forecast C — forecast fresco', () => {
  const ahora = new Date('2026-09-20T12:00:00Z');
  it('vigente <5d, próximo 5–8d, vencido >8d, sin_datos sin generado_en', () => {
    expect(estadoFrescuraPronostico([dia({ generadoEn: '2026-09-18T06:00:00Z' })], ahora).estado).toBe('vigente');
    expect(estadoFrescuraPronostico([dia({ generadoEn: '2026-09-14T06:00:00Z' })], ahora).estado).toBe('proximo_a_vencer');
    expect(estadoFrescuraPronostico([dia({ generadoEn: '2026-09-10T06:00:00Z' })], ahora).estado).toBe('vencido');
    expect(estadoFrescuraPronostico([dia({ generadoEn: null })], ahora).estado).toBe('sin_datos');
    expect(estadoFrescuraPronostico([], ahora).estado).toBe('sin_datos');
  });
  it('toma el generado_en más reciente y reporta edad', () => {
    const r = estadoFrescuraPronostico([dia({ generadoEn: '2026-09-10T06:00:00Z' }), dia()], ahora);
    expect(r.generadoEn).toBe('2026-09-14T06:00:00Z');
    expect(r.estado).toBe('proximo_a_vencer');
    expect(r.edadDias).toBeCloseTo(6.25, 1);
  });
  it('UI muestra banner de frescura y rango del peor día', () => {
    const ui = leer('shared/src/ui/charts/PrediccionPicos.tsx');
    expect(ui).toMatch(/estadoFrescuraPronostico/);
    expect(ui).toMatch(/bannerFrescura/);
    expect(ui).toMatch(/pico\.lo\.toFixed\(1\)/);
  });
});

describe('forecast A — recall (atrapar más picos)', () => {
  it('la alerta dispara en es_pico con severidad por nivel y mensaje con rango', () => {
    const sql = leer('supabase/migrations/20261021000000_forecast_rangos_frescura.sql');
    expect(sql).toMatch(/p\.es_pico/);
    expect(sql).toMatch(/'media'/);
    expect(sql).toMatch(/rango/i);
  });
});
