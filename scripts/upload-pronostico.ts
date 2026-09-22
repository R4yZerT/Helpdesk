// Sube ml/models/forecast/forecast_7d.json a public.pronosticos_picos.
// Uso: pnpm run upload:pronostico              -> dry-run (sin DB, solo valida)
//      pnpm run upload:pronostico -- --push    -> inserta vía service_role
//      pnpm run upload:pronostico -- --push --version rf-forecast-20260915
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { buildPronosticoRows } from '../shared/src/pronostico-upload.js';

const ROOT = path.resolve(import.meta.dirname ?? '.', '..');
const FORECAST = path.join(ROOT, 'ml/models/forecast/forecast_7d.json');
const METRICS = path.join(ROOT, 'ml/models/forecast/metrics.json');
const META = path.join(ROOT, 'ml/models/forecast/forecast_meta.json');

type Dia = { fecha: string; dow?: number; forecast: number; lo?: number; hi?: number; nivel: string; es_pico: boolean };

function load(): Record<string, Dia[]> {
  if (!existsSync(FORECAST)) {
    console.error(`[pronostico] no existe ${FORECAST} — corre primero: python3 ml/src/forecast_picos.py`);
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(FORECAST, 'utf-8')) as Record<string, Dia[]>;
  // Validación + guards de vacío en shared (lanza Error descriptivo, nunca push silencioso)
  try {
    buildPronosticoRows(data, 'check');
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
  return data;
}

async function main() {
  const push = process.argv.includes('--push');
  const vi = process.argv.indexOf('--version');
  const version = vi >= 0 && process.argv[vi + 1] ? process.argv[vi + 1] : `rf-forecast-${new Date().toISOString().slice(0, 10)}`;
  const data = load();

  // Frescura (C): generado_en viaja con cada fila; si falta meta se deja null
  let generadoEn: string | undefined;
  if (existsSync(META)) {
    try {
      const meta = JSON.parse(readFileSync(META, 'utf-8')) as { generado_en?: string };
      if (meta.generado_en) generadoEn = meta.generado_en;
    } catch { /* meta ilegible: filas sin generado_en */ }
  }
  if (!generadoEn) console.warn('[pronostico] sin forecast_meta.json: generado_en=null (frescura desconocida)');

  const rows = buildPronosticoRows(data, version, generadoEn);
  const picos = rows.filter((r) => r.es_pico && r.nivel === 'pico');
  console.log(`[pronostico] series=${Object.keys(data).length} filas=${rows.length} picos=${picos.length} version=${version}`);
  for (const p of picos) console.log(`  pico ${p.fecha} [${p.serie}]: ~${p.forecast}`);

  if (existsSync(METRICS)) {
    const m = JSON.parse(readFileSync(METRICS, 'utf-8')) as Record<string, { mejor_modelo: string }>;
    console.log(`[pronostico] modelos: ${Object.entries(m).map(([k, v]) => `${k}=${v.mejor_modelo}`).join(', ')}`);
  }

  if (!push) { console.log('[pronostico] dry-run ok (usa --push para subir)'); return; }
  const si = process.argv.indexOf('--sql');
  if (si >= 0 && process.argv[si + 1]) {
    // Vía CLI supabase (conexión directa, salta RLS): pnpm supabase db query --linked --file <sql>
    const esc = (s: string) => `'${s.replace(/'/g, "''")}'`;
    const escNum = (n: number | null) => (n === null ? 'null' : String(n));
    const escTs = (s: string | null) => (s === null ? 'null' : `'${s}'`);
    const vals = rows.map((r) =>
      `(${esc(r.fecha)},${esc(r.serie)},${r.forecast},${escNum(r.lo)},${escNum(r.hi)},${esc(r.nivel)},${r.es_pico},${escTs(r.generado_en)},${esc(r.modelo_version)})`).join(',\n');
    const sql = `insert into public.pronosticos_picos (fecha,serie,forecast,lo,hi,nivel,es_pico,generado_en,modelo_version)\nvalues\n${vals}\non conflict (fecha,serie,modelo_version) do update set forecast=excluded.forecast,lo=excluded.lo,hi=excluded.hi,nivel=excluded.nivel,es_pico=excluded.es_pico,generado_en=excluded.generado_en;\n`;
    const { writeFileSync } = await import('node:fs');
    writeFileSync(process.argv[si + 1], sql);
    console.log(`[pronostico] sql ok: ${rows.length} filas -> ${process.argv[si + 1]}`);
    return;
  }

  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('[pronostico] push requiere SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, key);
  const { error } = await supabase.from('pronosticos_picos').upsert(rows, { onConflict: 'fecha,serie,modelo_version' });
  if (error) { console.error(`[pronostico] upsert falló: ${error.message}`); process.exit(1); }
  console.log(`[pronostico] upsert ok: ${rows.length} filas`);
}

main().catch((e) => { console.error('[pronostico] error:', e?.message ?? e); process.exit(1); });
