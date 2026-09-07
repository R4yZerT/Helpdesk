// Edge Function: clasificación descripción -> categoría/prioridad/mesa (RF-22)
// MVP keyword-heurística (misma que shared/src/ia.ts). No bloquea creación — fallback media/19.

const PRIORIDAD_POR_CATEGORIA: Record<number, string> = {
  1:'media',2:'alta',3:'alta',4:'media',5:'critica',6:'alta',7:'baja',8:'media',9:'critica',10:'alta',
  11:'baja',12:'media',13:'media',14:'baja',15:'critica',16:'alta',17:'baja',18:'media',19:'media',
};
function mesaPorDominio(d:string){ return d==='tic'?1:d==='comunicaciones'?2:d==='infraestructura'?3:4; }

const RULES: {catId:number;kws:string[]}[] = [
  {catId:5,kws:['wifi','internet','red ','vpn','sin internet','conectividad','switch','router']},
  {catId:9,kws:['respaldo','backup','perdida de datos','restaurar','base de datos']},
  {catId:15,kws:['electrica','luz','breaker','corto','apagon','energia']},
  {catId:3,kws:['contraseña','password','clave','bloqueada','acceso denegado']},
  {catId:2,kws:['permiso','acceso','autorizacion']},
  {catId:6,kws:['equipo','hardware','computador','portatil','no enciende']},
  {catId:10,kws:['moodle','plataforma','campus virtual']},
  {catId:4,kws:['correo','email','outlook']},
  {catId:7,kws:['impresora','escaner','toner']},
  {catId:8,kws:['software','aplicacion','instalar','licencia']},
  {catId:1,kws:['usuario','crear usuario']},
  {catId:16,kws:['agua','fuga','tuberia','baño','inundacion']},
  {catId:17,kws:['carpinteria','mueble','silla','puerta']},
  {catId:18,kws:['obra','pintura','pared','gotera']},
  {catId:11,kws:['diseño','pieza grafica','flyer','banner','logo']},
  {catId:12,kws:['audiovisual','video','sonido','microfono','camara']},
  {catId:13,kws:['web','publicacion','sitio','pagina web']},
  {catId:14,kws:['evento','ceremonia','protocolo']},
];

function classifyLocal(texto:string){
  const t = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(t.trim().length<20) return null;
  let best:{catId:number;score:number}|null=null;
  for(const r of RULES){ let s=0; for(const kw of r.kws){ const k=kw.normalize('NFD').replace(/[\u0300-\u036f]/g,''); if(t.includes(k)) s+=k.length>5?2:1; } if(s>0 && (!best||s>best.score)) best={catId:r.catId,score:s}; }
  const cid=best?.catId??19;
  const conf=best?Math.min(0.55+best.score*0.12,0.92):0.45;
  const dom = cid<=10?'tic':cid<=14?'comunicaciones':cid<=18?'infraestructura':'general';
  return { categoriaId:cid, confianza:conf, prioridad:PRIORIDAD_POR_CATEGORIA[cid], mesaId:mesaPorDominio(dom), dominio:dom };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null,{headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type'}});
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  try {
    const { asunto='', descripcion='' } = await req.json();
    const texto = `${asunto} ${descripcion}`.trim();
    const sugerencia = classifyLocal(texto) ?? { categoriaId: 19, confianza: 0.45, prioridad:'media', mesaId:4, dominio:'general' };
    return Response.json({ sugerencia }, { headers:{'Access-Control-Allow-Origin':'*'} });
  } catch(e){
    return Response.json({ sugerencia:{categoriaId:19,confianza:0,prioridad:'media',mesaId:4,dominio:'general'}, error:String(e) }, { headers:{'Access-Control-Allow-Origin':'*'} });
  }
});
