// Seed visual para el dashboard del jefe: 60 días de tickets con picos y
// patrones por categoría claramente visibles (RF-19/RF-20).
// Uso: pnpm dlx tsx scripts/seed-demo-visual.ts -- --push [--recent 720] [--prev 480]
// Sin --push solo hace dry-run e imprime la distribución esperada.
import { readFileSync, existsSync } from 'node:fs';

const BATCH = 150;
const DELAY_MS = 350;

type Row = {
  usuario_id: string;
  mesa_id: number;
  categoria_id: number;
  asunto: string;
  descripcion: string;
  prioridad: string;
  estado: string;
  tecnico_asignado_id: string | null;
  creado_en: string;
  actualizado_en: string;
  fecha_resolucion?: string;
  solucion_aplicada?: string;
};

function arg(name: string, dflt: number): number {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? Number(process.argv[i + 1]) : dflt;
}
function hasFlag(f: string) { return process.argv.includes(f); }
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
function rnd() { return Math.random(); }
function pickWeighted<T>(items: Array<[T, number]>): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of items) { r -= w; if (r <= 0) return v; }
  return items[items.length - 1]![0];
}
function pick<T>(arr: T[]): T { return arr[Math.floor(rnd() * arr.length)]!; }

// ── Distribuciones pensadas para que el dashboard muestre señal real ──
const MESA_W: Array<[string, number]> = [['TIC', 40], ['Comunicaciones', 24], ['Infraestructura', 20], ['EAPSA', 16]];

const DOW_W: Record<string, number[]> = {
  TIC: [15, 15, 10, 55, 5],
  Comunicaciones: [5, 65, 15, 10, 5],
  Infraestructura: [60, 5, 25, 5, 5],
  EAPSA: [15, 10, 55, 15, 5],
};
const HOUR_W: Record<string, Array<[number, number]>> = {
  TIC: [[7, 2], [8, 8], [9, 30], [10, 30], [11, 17], [12, 4], [13, 2], [14, 3], [15, 2], [16, 2]],
  Comunicaciones: [[8, 3], [9, 15], [10, 32], [11, 28], [12, 15], [14, 5], [15, 2]],
  Infraestructura: [[9, 3], [10, 5], [11, 3], [13, 10], [14, 30], [15, 32], [16, 17]],
  EAPSA: [[8, 10], [9, 25], [10, 30], [11, 20], [14, 10], [15, 5]],
};

// Pesos por dominio: el periodo actual concentra categorías distintas al
// previo para que PatronesCategoria muestre al_alza / a_la_baja / nueva_alta.
const CAT_W_ACTUAL: Record<string, Array<[number, number]>> = {
  tic: [[4, 14], [5, 7], [20, 5], [21, 5], [22, 3]],
  comunicaciones: [[11, 8], [12, 12], [13, 5], [14, 12]],
  infraestructura: [[15, 8], [16, 10], [17, 8], [18, 4]],
  general: [[19, 10]],
};
const CAT_W_PREVIO: Record<string, Array<[number, number]>> = {
  tic: [[4, 7], [5, 14], [20, 3], [21, 3]],
  comunicaciones: [[11, 12], [12, 6], [13, 18], [14, 5]],
  infraestructura: [[15, 6], [16, 6], [17, 12], [18, 14]],
  general: [[19, 10]],
};

const PRIORIDAD_W: Array<[string, number]> = [['critica', 8], ['alta', 22], ['media', 45], ['baja', 25]];
const SLA_MIN: Record<string, number> = { critica: 60, alta: 240, media: 1440, baja: 4320 };
const DOMINIO_MESA: Record<string, string> = { TIC: 'tic', Comunicaciones: 'comunicaciones', Infraestructura: 'infraestructura', EAPSA: 'general' };

const ASUNTOS: Record<string, string[]> = {
  tic: ['Sin acceso a {svc}', 'Error de correo en {dep}', 'Permisos carpeta compartida', 'Contraseña vencida', 'VPN no conecta', 'Equipo lento en {dep}', 'Impresora sin responder', 'Solicitud instalación {svc}'],
  comunicaciones: ['Pieza gráfica para {dep}', 'Video institucional pendiente', 'Publicación web desactualizada', 'Branding de evento', 'Diseño de campaña interna'],
  infraestructura: ['Falla eléctrica en {dep}', 'Fuga de agua en {dep}', 'Reparación de mobiliario', 'Mantenimiento locativo', 'Puerta dañada en {dep}'],
  general: ['Solicitud de apoyo administrativo', 'Revisión de proceso interno', 'Requerimiento de {dep}', 'Caso sin clasificar'],
};
const DESCS = [
  'Usuario reporta la novedad en {dep}. Se adjunta evidencia y se solicita atención.',
  'Caso recurrente que afecta la operación normal de la dependencia. Requiere seguimiento.',
  'Se requiere soporte para continuar con las actividades programadas del área.',
  'Incidencia detectada durante la jornada; se solicita validación y cierre.',
];
const SOLUCIONES = [
  'Se reinició el servicio y se validó conectividad.',
  'Se reinstaló el componente y se probó con el usuario.',
  'Se restableció el acceso y se verificó funcionamiento.',
  'Se escaló al proveedor y se cerró con confirmación del usuario.',
  'Se reemplazó el equipo y se migraron los datos.',
];

// Días de cada día de semana dentro de la ventana (0 = hoy).
function buildDays(): { recent: Record<number, number[]>; prev: Record<number, number[]> } {
  const today = new Date();
  const recent: Record<number, number[]> = {};
  const prev: Record<number, number[]> = {};
  for (let ago = 0; ago < 60; ago++) {
    const d = new Date(today);
    d.setDate(d.getDate() - ago);
    const dow = (d.getDay() + 6) % 7;
    const target = ago < 30 ? recent : prev;
    (target[dow] ??= []).push(ago);
  }
  return { recent, prev };
}

function pickDayAgo(days: Record<number, number[]>, dowWeights: number[]): number {
  const dow = pickWeighted(dowWeights.map((w, i) => [i, w] as [number, number]));
  const list = days[dow];
  if (!list || !list.length) return 0;
  // Más peso a los días recientes para mostrar crecimiento.
  const weighted = list.map((ago) => [ago, 1 + 0.8 * (1 - ago / 30)] as [number, number]);
  return pickWeighted(weighted);
}

function main() {
  const recentN = arg('--recent', 720);
  const prevN = arg('--prev', 480);
  const push = hasFlag('--push');
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) { console.error('Falta EXPO_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const service = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (push && !service) { console.error('Con --push se requiere SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

  void (async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const supa = createClient(url, key) as any;

    const [{ data: mesas }, { data: cats }, { data: perfiles }] = await Promise.all([
      supa.from('mesas').select('id,nombre'),
      supa.from('ticket_categories').select('id,dominio,subcategoria').eq('activa', true),
      supa.from('profiles').select('id,rol,mesa_id'),
    ]);
    if (!mesas?.length || !cats?.length) throw new Error('Faltan mesas o categorías base');
    const usuarios = (perfiles ?? []).filter((p: any) => p.rol === 'usuario' || p.rol === 'empleado');
    const tecnicos = (perfiles ?? []).filter((p: any) => p.rol === 'tecnico');
    if (!usuarios.length) throw new Error('Faltan profiles con rol usuario');

    const mesasByName = new Map<string, number>(mesas.map((m: any) => [m.nombre, m.id]));
    const catsByDominio = new Map<string, any[]>();
    for (const c of cats) {
      const arr = catsByDominio.get(c.dominio) ?? [];
      arr.push(c);
      catsByDominio.set(c.dominio, arr);
    }

    const catFor = (dominio: string, periodo: 'actual' | 'previo'): number => {
      // EAPSA no tiene categorías propias activas: usa cualquiera del catálogo.
      const disponibles = catsByDominio.get(dominio)?.length ? catsByDominio.get(dominio)! : cats;
      const pesos = (periodo === 'actual' ? CAT_W_ACTUAL : CAT_W_PREVIO)[dominio] ?? [];
      const opciones = pesos
        .filter(([id]) => disponibles.some((c) => c.id === id))
        .map(([id, w]) => [id, w] as [number, number]);
      if (!opciones.length) return pick(disponibles).id;
      return pickWeighted(opciones);
    };

    const days = buildDays();
    const stats: Record<string, number> = {};
    const rows: Row[] = [];

    const buildRows = (n: number, periodo: 'actual' | 'previo') => {
      for (let i = 0; i < n; i++) {
        const mesaNombre = pickWeighted(MESA_W);
        const mesaId = mesasByName.get(mesaNombre);
        if (!mesaId) continue;
        const dominio = DOMINIO_MESA[mesaNombre] ?? 'general';
        const creado = new Date();
        const ago = pickDayAgo(periodo === 'actual' ? days.recent : days.prev, DOW_W[mesaNombre]!);
        creado.setDate(creado.getDate() - ago);
        const hour = pickWeighted(HOUR_W[mesaNombre]!);
        // Horas en UTC: los RPC del dashboard agrupan con extract(hour) sobre creado_en.
        creado.setUTCHours(hour, Math.floor(rnd() * 60), Math.floor(rnd() * 60), 0);
        if (creado > new Date()) creado.setTime(Date.now() - Math.floor(rnd() * 3600_000));

        const prioridad = pickWeighted(PRIORIDAD_W);
        const categoriaId = catFor(dominio, periodo);
        const cat = (catsByDominio.get(dominio) ?? []).find((c) => c.id === categoriaId);

        let estado: string;
        if (ago >= 7) {
          estado = pickWeighted([['solucionado', 55], ['cerrado', 30], ['abierto', 7], ['en_proceso', 5], ['devuelto', 3]]);
        } else if (ago >= 2) {
          estado = pickWeighted([['solucionado', 35], ['cerrado', 15], ['en_proceso', 20], ['abierto', 15], ['programado', 8], ['devuelto', 7]]);
        } else {
          estado = pickWeighted([['abierto', 32], ['en_proceso', 26], ['programado', 12], ['devuelto', 10], ['solucionado', 15], ['cerrado', 5]]);
        }

        const asignable = estado !== 'abierto' && estado !== 'devuelto';
        const tecnico = tecnicos.length && (asignable || rnd() < 0.2) ? pick(tecnicos.filter((t: any) => t.mesa_id == null || t.mesa_id === mesaId)) ?? pick(tecnicos) : null;

        const slaMs = (SLA_MIN[prioridad] ?? 1440) * 60_000;
        const row: Row = {
          usuario_id: pick(usuarios).id,
          mesa_id: mesaId,
          categoria_id: categoriaId,
          asunto: pick(ASUNTOS[dominio] ?? ASUNTOS.tic!).replace('{svc}', pick(['Office365', 'SAP', 'Greca', 'Red', 'VPN'])).replace('{dep}', mesaNombre).slice(0, 180),
          descripcion: pick(DESCS).replace('{dep}', mesaNombre) + ` Prioridad ${prioridad}.`,
          prioridad,
          estado,
          tecnico_asignado_id: tecnico?.id ?? null,
          creado_en: creado.toISOString(),
          actualizado_en: creado.toISOString(),
        };

        if (estado === 'solucionado' || estado === 'cerrado') {
          const cumplido = rnd() < 0.6;
          const delta = cumplido
            ? -Math.min(slaMs * 0.8, 10 * 60_000 + rnd() * slaMs * 0.7)
            : 15 * 60_000 + rnd() * 26 * 3600_000;
          const res = new Date(creado.getTime() + slaMs + delta);
          row.fecha_resolucion = (res > new Date() ? new Date(Date.now() - rnd() * 3600_000) : res).toISOString();
          row.solucion_aplicada = pick(SOLUCIONES);
          row.actualizado_en = row.fecha_resolucion;
        } else {
          const edadMs = Date.now() - creado.getTime();
          row.actualizado_en = new Date(creado.getTime() + Math.min(edadMs, rnd() * edadMs)).toISOString();
        }

        rows.push(row);
        stats[estado] = (stats[estado] ?? 0) + 1;
        stats[`prio:${prioridad}`] = (stats[`prio:${prioridad}`] ?? 0) + 1;
      }
    };

    buildRows(recentN, 'actual');
    buildRows(prevN, 'previo');

    console.log(`[seed-visual] ${push ? 'PUSH' : 'DRY'} filas=${rows.length} (recent=${recentN}, prev=${prevN})`);
    console.log('[seed-visual] distribución', stats);
    const hoy = rows.filter((r) => r.creado_en.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
    console.log(`[seed-visual] tickets con fecha de hoy=${hoy}`);

    if (!push) { console.log('[seed-visual] dry-run: usa --push para insertar'); return; }

    let ok = 0;
    let fail = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await supa.from('tickets').insert(batch);
      if (error) {
        fail += batch.length;
        console.error(`[seed-visual] batch ${i / BATCH + 1} FAIL: ${error.message.slice(0, 240)}`);
      } else {
        ok += batch.length;
        console.log(`[seed-visual] batch ${i / BATCH + 1}/${Math.ceil(rows.length / BATCH)} ok ${batch.length} total=${ok}`);
      }
      await sleep(DELAY_MS);
    }
    console.log(`[seed-visual] FIN ok=${ok} fail=${fail}`);
  })().catch((e) => { console.error(e); process.exit(1); });
}

// Carga .env local si el runner no lo hizo (tsx no lo hace solo).
function loadEnv() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.EXPO_PUBLIC_SUPABASE_URL) return;
  if (!existsSync('.env')) return;
  for (const line of readFileSync('.env', 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!;
  }
}

loadEnv();
main();
