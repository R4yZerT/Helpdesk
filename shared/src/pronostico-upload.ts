// RF-19/B3 — Constructor puro de filas `pronosticos_picos` desde forecast_7d.json.
// Espeja las restricciones de BD: fecha DATE válida, forecast numérico finito,
// nivel CHECK (baja/media/alta/pico), unique (fecha, serie, modelo_version).
// Los guards de vacío lanzan Error descriptivo: un push silencioso de 0 filas
// dejaría el bloque ML del dashboard vacío sin que nadie se entere.

export const NIVELES_PRONOSTICO = ['baja', 'media', 'alta', 'pico'] as const;
export type NivelPronostico = (typeof NIVELES_PRONOSTICO)[number];

export type PronosticoJsonDia = {
  fecha: string;
  forecast: number;
  nivel: string;
  es_pico?: boolean;
  dow?: number;
  lo?: number;
  hi?: number;
};

export type PronosticoUploadRow = {
  fecha: string;
  serie: string;
  forecast: number;
  nivel: NivelPronostico;
  es_pico: boolean;
  modelo_version: string;
  lo: number;
  hi: number;
  generado_en: string | null;
};

const isFecha = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

function esNivel(n: unknown): n is NivelPronostico {
  return typeof n === 'string' && (NIVELES_PRONOSTICO as readonly string[]).includes(n);
}

/** Valida el JSON crudo y construye las filas a insertar. Lanza Error si hay algo mal. */
export function buildPronosticoRows(data: unknown, version: string, generadoEn?: string | null): PronosticoUploadRow[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('[pronostico] JSON raíz inválido: se esperaba objeto {serie: dias[]}');
  }
  const series = Object.entries(data as Record<string, unknown>);
  if (series.length === 0) {
    throw new Error('[pronostico] JSON vacío (0 series): regenera con pnpm forecast:refresh');
  }
  if (!version || !version.trim()) throw new Error('[pronostico] modelo_version vacío');
  // generado_en (frescura): ISO válido o null (JSON viejo sin meta). Nunca inventa fecha.
  const gen = generadoEn?.trim() ? generadoEn.trim() : null;
  if (gen && Number.isNaN(Date.parse(gen))) {
    throw new Error(`[pronostico] generado_en inválido: ${JSON.stringify(generadoEn)}`);
  }
  const rows: PronosticoUploadRow[] = [];
  for (const [serie, dias] of series) {
    if (!Array.isArray(dias) || dias.length === 0) {
      throw new Error(`[pronostico] serie "${serie}" vacía o inválida: regenera con pnpm forecast:refresh`);
    }
    for (const d of dias as PronosticoJsonDia[]) {
      if (!isFecha(d?.fecha)) {
        throw new Error(`[pronostico] fecha inválida en serie "${serie}": ${JSON.stringify(d)}`);
      }
      if (typeof d?.forecast !== 'number' || !Number.isFinite(d.forecast)) {
        throw new Error(`[pronostico] forecast no-numérico en serie "${serie}" fecha ${d?.fecha}`);
      }
      if (!esNivel(d?.nivel)) {
        throw new Error(
          `[pronostico] nivel inválido en serie "${serie}" fecha ${d.fecha}: ${JSON.stringify(d?.nivel)} (CHECK bd: baja/media/alta/pico)`,
        );
      }
      // Rango q10–q90: si el JSON no los trae (versión vieja), colapsa al puntual.
      const lo = typeof d?.lo === 'number' && Number.isFinite(d.lo) ? d.lo : d.forecast;
      const hi = typeof d?.hi === 'number' && Number.isFinite(d.hi) ? d.hi : d.forecast;
      rows.push({
        fecha: d.fecha,
        serie,
        forecast: d.forecast,
        nivel: d.nivel,
        es_pico: d.es_pico === true,
        modelo_version: version.trim(),
        lo,
        hi,
        generado_en: gen,
      });
    }
  }
  return rows;
}
