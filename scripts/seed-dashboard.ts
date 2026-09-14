// Seed medio 2500 tickets 3 meses — mesas/SLA/estados variados, batch 200, delay 400ms, sin hardcode
// Uso: pnpm dlx tsx scripts/seed-dashboard.ts -- --dry --count 2500
//      pnpm dlx tsx scripts/seed-dashboard.ts -- --push --count 2500
import { readFileSync } from 'node:fs';

const COUNT_DEFAULT = 2500;
const BATCH = 200;
const DELAY_MS = 450;

function arg(name: string, dflt?: string) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i+1] : dflt;
}
function hasFlag(f: string){ return process.argv.includes(f); }
function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }
function pick<T>(a:T[]):T{ return a[Math.floor(Math.random()*a.length)]; }
function weighted<T>(items:[T,number][]):T{
  const tot = items.reduce((s,[,w])=>s+w,0);
  let r=Math.random()*tot; for(const [v,w] of items){ r-=w; if(r<=0) return v; } return items[0][0];
}

async function main(){
  const count = Number(arg('--count', String(COUNT_DEFAULT)));
  const dry = hasFlag('--dry') || !hasFlag('--push');
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = service || anon;
  if(!url || !key){ console.error('Falta EXPO_PUBLIC_SUPABASE_URL / SERVICE_ROLE_KEY|ANON_KEY (ver .env)'); process.exit(1); }
  if(!service) console.warn('⚠️  Sin SERVICE_ROLE_KEY — insertará como anon (RLS limita usuario_id). Para diversidad real usa service_role desde Dashboard > API.');

  const { createClient } = await import('@supabase/supabase-js');
  const supa:any = createClient(url, key);

  console.log(`[seed] ${dry?'DRY':'PUSH'} count=${count} batch=${BATCH} url=${url.slice(0,32)}... key=${service?'service':'anon'}`);

  // Cargar catálogos dinámicos (sin hardcode)
  const { data: mesas } = await supa.from('mesas').select('id,nombre').limit(20) as any;
  const { data: cats } = await supa.from('ticket_categories').select('id,dominio,subcategoria').limit(50) as any;
  const { data: perfiles } = await supa.from('profiles').select('id,rol,mesa_id').limit(200) as any;
  if(!mesas?.length) throw new Error('Sin mesas — pobla mesas primero');
  if(!cats?.length) throw new Error('Sin categorias');
  const usuarios = (perfiles||[]).filter((p:any)=>p.rol==='usuario' || p.rol==='empleado');
  const tecnicos = (perfiles||[]).filter((p:any)=>p.rol==='tecnico');
  const allUsers = usuarios.length ? usuarios : perfiles||[];
  if(!allUsers.length) throw new Error('Sin profiles — crea usuarios primero');

  console.log(`[seed] catálogos: mesas=${mesas.length} cats=${cats.length} usuarios=${usuarios.length} tecnicos=${tecnicos.length}`);

  // Plantillas variadas para no hardcodear un solo texto
  const asuntos = [
    'Sin acceso a {svc}', 'Error impresora {dep}', 'Caída red en {dep}', 'Solicitud instalación {svc}',
    'Correo no sincroniza', 'VPN no conecta', 'Equipo lento — {dep}', 'Falla teléfono IP',
    'Permisos carpeta compartida', 'Actualización {svc} requerida', 'Pantalla azul {dep}', 'Licencia {svc} vencida'
  ];
  const descs = [
    'Usuario reporta incidencia en {dep} con {svc}. Requiere atención prioritaria. Detalle: {rand}.',
    'Se solicita soporte para {svc} en dependencia {dep}. Evidencia adjunta. {rand}',
    'Incidencia recurrente de {svc}. Afecta operación normal. {rand}',
  ];
  const soluciones = ['Se reinició servicio y se validó conectividad','Se reinstaló driver y se probó impresión','Se restableció contraseña y se verificó acceso','Se escaló a proveedor y se cerró con confirmación usuario'];

  // SLA minutos espejo de sla_interval
  const slaMin: Record<string,number> = { critica:60, alta:240, media:1440, baja:4320 };

  function randomDate90(): Date {
    // 90 días atrás, con sesgo lun-mar y 9-11h
    const now = new Date();
    const daysAgo = (()=>{ const r=Math.random(); if(r<0.35) return Math.floor(Math.random()*14); // recientes para por_vencer/vigente
      if(r<0.65) return 14+Math.floor(Math.random()*30); return 44+Math.floor(Math.random()*46); })();
    const d = new Date(now); d.setDate(d.getDate()-daysAgo);
    // día semana sesgo
    let dow = d.getDay(); if(Math.random()<0.45){ // fuerza lun(1)-mar(2)
      const target = Math.random()<0.55?1:2; const diff = (target - dow +7)%7; d.setDate(d.getDate() - diff);
    }
    // hora pico 9-11
    let h: number; if(Math.random()<0.42) h = 9 + Math.floor(Math.random()*2) + (Math.random()<0.5?0:0.5); // 9-11
    else h = weighted<number>([[8,1],[10,1],[14,1],[15,1],[16,0.7],[11,1],[13,0.8]] as any);
    d.setHours(Math.floor(h), Math.floor(Math.random()*60), 0, 0);
    return d;
  }

  // Contadores para resumen
  const stats:Record<string,number>={};

  // Generar rows en memoria
  const rows:any[] = [];
  for(let i=0;i<count;i++){
    const prioridad = weighted<string>([['critica',0.08],['alta',0.22],['media',0.45],['baja',0.25]] as any) as any;
    const cat = pick(cats);
    const mesa = pick(mesas);
    const usuario = pick(allUsers);
    const tecnico = Math.random()<0.65 && tecnicos.length ? pick(tecnicos) : null;

    const creado = randomDate90();
    // Decide estado con lógica SLA mixta
    let estado: string;
    let fecha_resolucion: string|null = null;
    let solucion: string|null = null;
    const r = Math.random();
    // Ajuste para garantizar mezcla vencido/cumplido
    if(r<0.18) estado='abierto';
    else if(r<0.34) estado='en_proceso';
    else if(r<0.43) estado='programado';
    else if(r<0.50) estado='devuelto';
    else if(r<0.72) estado='solucionado';
    else estado='cerrado';

    // Si tiene técnico y está abierto, a veces en_proceso; si no técnico y abierto queda abierto
    if(!tecnico && estado==='en_proceso' && Math.random()<0.6) estado='abierto';

    const slaDur = slaMin[prioridad] ?? 1440;
    const vence = new Date(creado.getTime()+ slaDur*60000);

    if(estado==='solucionado' || estado==='cerrado'){
      // 50% cumplido (resuelto antes de vencer), 50% vencido_tarde (después)
      const cumplido = Math.random()<0.52;
      const deltaMin = cumplido
        ? - (10 + Math.floor(Math.random()* Math.min(slaDur*0.8, 1200))) // antes
        : + (15 + Math.floor(Math.random()* 1800)); // después 15min-30h
      const res = new Date(vence.getTime()+ deltaMin*60000);
      // No futuro
      const now=new Date(); if(res>now) res.setTime(now.getTime()- Math.floor(Math.random()*3600)*1000);
      fecha_resolucion = res.toISOString();
      solucion = pick(soluciones);
    } else {
      // abierto/en_proceso/programado/devuelto — deja fecha_resolucion null
      // Para forzar vencido/por_vencer/vigente, ajustamos creado según estado deseado
      // 20% vencido (creado hace > SLA), 15% por_vencer (creado hace SLA-30min), resto vigente
      const modo = weighted<string>([['vencido',0.20],['por_vencer',0.15],['vigente',0.65]] as any);
      if(modo==='vencido'){
        // fuerza creado antiguo
        const ageDays = Math.ceil(slaDur/1440)+ 1 + Math.floor(Math.random()*7);
        creado.setDate(new Date().getDate()- ageDays);
        // conserva hora pico
      } else if(modo==='por_vencer'){
        // creado = ahora - (SLA - 35min)
        const now=new Date();
        creado.setTime(now.getTime() - (slaDur - 35 - Math.floor(Math.random()*20))*60000);
      }
    }

    const svc = pick(['Office365','SAP','Greca','Impresora','Red','VPN']);
    const dep = mesa.nombre;
    const asuntoTpl = pick(asuntos);
    const descTpl = pick(descs);
    const rand = Math.random().toString(36).slice(2,7);
    const asunto = asuntoTpl.replace('{svc}',svc).replace('{dep}',dep).slice(0,180);
    const descripcion = descTpl.replace('{svc}',svc).replace('{dep}',dep).replace('{rand}',rand) + ` Prioridad ${prioridad}.`;

    const row:any = {
      usuario_id: usuario.id,
      mesa_id: mesa.id,
      categoria_id: cat.id,
      asunto,
      descripcion,
      prioridad,
      estado,
      tecnico_asignado_id: tecnico? tecnico.id : null,
      creado_en: creado.toISOString(),
      // fecha_resolucion / solucion si aplica (trigger setea vence_en)
    };
    if(fecha_resolucion) row.fecha_resolucion = fecha_resolucion;
    if(solucion) row.solucion_aplicada = solucion;
    // actualizado_en: default para todos, viejo para estancados (>2d)
    row.actualizado_en = creado.toISOString();
    if(Math.random()<0.12 && (estado==='abierto'||estado==='en_proceso')){
      const old=new Date(creado); old.setDate(old.getDate()+1);
      // si old es futuro, deja creado; si es antiguo, usa old para simular estancado
      if(old < new Date()) row.actualizado_en = old.toISOString();
    }
    rows.push(row);
    stats[estado]=(stats[estado]||0)+1;
    stats[prioridad]=(stats[prioridad]||0)+1;
  }

  console.log('[seed] distribución', stats, `ej vence critic=${slaMin.critica}m alta=${slaMin.alta}m`);
  console.log(`[seed] ejemplo row0`, JSON.stringify(rows[0], null,2).slice(0,500));

  if(dry){
    console.log(`[seed] DRY — no se escribe. Ejecuta con --push para insertar ${rows.length} filas en batches ${BATCH}.`);
    // Guardar sample local
    try{ const { writeFileSync } = await import('node:fs'); writeFileSync('/tmp/seed-sample.json', JSON.stringify(rows.slice(0,3), null,2)); console.log('[seed] sample -> /tmp/seed-sample.json'); }catch{}
    return;
  }

  // Push con control free-tier
  let ok=0, fail=0;
  for(let i=0;i<rows.length;i+=BATCH){
    const batch = rows.slice(i,i+BATCH);
    const { error, count:cnt } = await supa.from('tickets').insert(batch).select('id').limit(0) as any;
    // select limit 0 evita retorno pesado
    if(error){
      // Fallback sin select
      const { error: e2 } = await supa.from('tickets').insert(batch) as any;
      if(e2){ console.error(`[seed] batch ${i/BATCH+1} FAIL`, e2.message.slice(0,300)); fail+=batch.length; }
      else { ok+=batch.length; console.log(`[seed] batch ${i/BATCH+1} ok ${batch.length} (retry)`); }
    } else {
      ok+=batch.length;
      console.log(`[seed] batch ${i/BATCH+1}/${Math.ceil(rows.length/BATCH)} ok ${batch.length} totalOk=${ok}`);
    }
    if(i+BATCH < rows.length) await sleep(DELAY_MS);
    // Guard free-tier: aborta si muchos fallos
    if(fail> BATCH*2){ console.error('[seed] abortado: muchos fallos consecutivos (RLS o quota). Revisa SERVICE_ROLE_KEY.'); break; }
  }
  console.log(`[seed] FIN ok=${ok} fail=${fail} — verifica dashboard: picos/horas/días/patrones/SLA`);
  // Dispara alertas
  try{ const { data } = await supa.rpc('generar_alertas_ia') as any; console.log('[seed] generar_alertas_ia ->', data); }catch(e:any){ console.warn('[seed] alertas rpc skip', e?.message); }
}
main().catch(e=>{ console.error(e); process.exit(1); });
