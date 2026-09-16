// Edge Function: clasificación descripción -> categoría/prioridad/mesa (RF-22)
// Heurística por keywords sobre las 13 clases consolidadas del notebook 02 (Fase 0),
// espejo de shared/src/ia.ts: las reglas apuntan a NOMBRES canónicos (dominio +
// subcategoría), nunca a IDs. Los IDs de categoría/mesa se resuelven contra el
// catálogo vivo (ticket_categories + mesas) para no romperse con seeds/migraciones.
// No bloquea creación: sin match o sin catálogo retorna sugerencia null + motivo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// Minúsculas + sin tildes (para keywords como 'red '). Espejo de ia.ts/types.ts.
function sinTildes(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function normalizarNombre(v: string): string {
  return sinTildes(v).trim();
}

// RF-06 — Prioridad única por NOMBRE de subcategoría (espejo de types.ts).
const PRIORIDAD_POR_SUBCATEGORIA: Record<string, string> = {
  'conectividad y redes': 'critica',
  'correo electronico': 'media',
  'equipos e infraestructura': 'alta',
  'gestion de accesos y seguridad': 'alta',
  'software y sistemas': 'media',
  'audiovisual': 'media',
  'eventos y branding': 'baja',
  'piezas graficas y diseno': 'baja',
  'web y publicaciones': 'media',
  'carpinteria y mobiliario': 'baja',
  'electrica': 'critica',
  'hidrosanitaria': 'alta',
  'obra civil y mantenimiento locativo': 'media',
};

// Dominio normalizado -> nombre canónico de mesa (seed: TIC/Comunicaciones/Infraestructura/EAPSA).
const DOMINIO_A_MESA_NOMBRE: Record<string, string> = {
  tic: 'TIC',
  comunicaciones: 'Comunicaciones',
  infraestructura: 'Infraestructura',
  eapsa: 'EAPSA',
  general: 'EAPSA',
};

// 13 reglas consolidadas — espejo de RULES en shared/src/ia.ts.
type ReglaCategoria = { dominio: string; subcategoria: string; kws: string[] };
const RULES: ReglaCategoria[] = [
  { dominio: 'tic', subcategoria: 'conectividad y redes', kws: ['wifi', 'internet', 'red ', 'vpn', 'sin internet', 'sin conexión', 'conectividad', 'caída de red', 'switch', 'router', 'punto de red', 'fibra óptica', 'sin red'] },
  { dominio: 'tic', subcategoria: 'correo electronico', kws: ['correo', 'email', 'outlook', 'bandeja', 'buzón', 'no llegan correos', 'firma de correo'] },
  { dominio: 'tic', subcategoria: 'equipos e infraestructura', kws: ['equipo', 'hardware', 'pc ', 'computador', 'portátil', 'laptop', 'no enciende', 'pantalla', 'teclado', 'mouse', 'impresora', 'escáner', 'tóner', 'fotocopiadora', 'atasco de papel', 'imprimir', 'ups', 'disco duro', 'memoria ram', 'servidor'] },
  { dominio: 'tic', subcategoria: 'gestion de accesos y seguridad', kws: ['contraseña', 'password', 'clave', 'crear cuenta', 'crear usuario', 'activar usuario', 'desactivar usuario', 'permiso', 'acceso', 'rol ', 'credencial', 'bloqueada', 'bloqueado', 'autenticación', 'antivirus', 'phishing', 'no puedo entrar'] },
  { dominio: 'tic', subcategoria: 'software y sistemas', kws: ['software', 'aplicación', 'instalar', 'licencia', 'actualizar', 'error al abrir', 'moodle', 'plataforma virtual', 'campus virtual', 'aula virtual', 'microsoft office', 'windows', 'respaldo', 'backup', 'base de datos', 'restaurar'] },
  { dominio: 'infraestructura', subcategoria: 'hidrosanitaria', kws: ['agua', 'fuga', 'tubería', 'baño', 'sanitario', 'grifo', 'alcantarillado', 'inundación', 'hidrosanitaria', 'lavamanos', 'orinal'] },
  { dominio: 'infraestructura', subcategoria: 'electrica', kws: ['eléctrica', 'luz', 'breaker', 'corto', 'apagón', 'energía', 'toma corriente', 'lámpara', 'iluminación'] },
  { dominio: 'infraestructura', subcategoria: 'carpinteria y mobiliario', kws: ['carpintería', 'mueble', 'silla', 'escritorio', 'puerta', 'chapa', 'bisagra', 'ventana', 'archivador', 'estantería'] },
  { dominio: 'infraestructura', subcategoria: 'obra civil y mantenimiento locativo', kws: ['obra', 'pintura', 'pared', 'techo', 'piso', 'gotera', 'humedad', 'mantenimiento locativo', 'grieta', 'enchape', 'cielo raso'] },
  { dominio: 'comunicaciones', subcategoria: 'audiovisual', kws: ['audiovisual', 'video', 'sonido', 'micrófono', 'cámara', 'streaming', 'grabación', 'videobeam', 'proyector', 'edición de video', 'fotografía'] },
  { dominio: 'comunicaciones', subcategoria: 'eventos y branding', kws: ['evento', 'ceremonia', 'protocolo', 'tarima', 'logística', 'branding', 'montaje de evento'] },
  { dominio: 'comunicaciones', subcategoria: 'piezas graficas y diseno', kws: ['diseño', 'pieza gráfica', 'flyer', 'banner', 'afiche', 'logo', 'folleto', 'tarjeta de presentación', 'ilustración', 'pendón'] },
  { dominio: 'comunicaciones', subcategoria: 'web y publicaciones', kws: ['página web', 'sitio web', 'cms', 'redes sociales', 'noticia', 'portal web', 'contenido web', 'publicación'] },
];

type CategoriaViva = { id: number; dominio: string; subcategoria: string };
type MesaViva = { id: number; nombre: string };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,content-type' } });
  }
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  try {
    const { asunto = '', descripcion = '' } = await req.json();
    const texto = `${asunto} ${descripcion}`.trim();
    if (texto.length < 20) {
      return Response.json({ sugerencia: null, motivo: 'texto muy corto (<20)' }, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // Catálogo vivo (service_role): categorías activas + mesas.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);
    const [{ data: cats, error: errCats }, { data: mesas, error: errMesas }] = await Promise.all([
      admin.from('ticket_categories').select('id,dominio,subcategoria').eq('activa', true),
      admin.from('mesas').select('id,nombre'),
    ]);
    if (errCats || errMesas) {
      return Response.json({ sugerencia: null, motivo: `catálogo no disponible: ${errCats?.message ?? errMesas?.message}` }, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    const categorias = (cats ?? []) as CategoriaViva[];
    const mesasVivas = (mesas ?? []) as MesaViva[];

    // Puntuar reglas por nombre y resolver contra el catálogo vivo.
    const t = sinTildes(texto);
    const puntuadas = RULES.map((regla) => {
      let score = 0;
      for (const kw of regla.kws) {
        if (t.includes(sinTildes(kw))) score += kw.length > 5 ? 2 : 1;
      }
      return { regla, score };
    }).filter((p) => p.score > 0).sort((a, b) => b.score - a.score);

    for (const { regla, score } of puntuadas) {
      const cat = categorias.find(
        (c) => normalizarNombre(c.dominio) === regla.dominio && normalizarNombre(c.subcategoria) === regla.subcategoria,
      );
      if (!cat) continue; // la regla apunta a una categoría desactivada/inexistente: se ignora
      const mesaNombre = DOMINIO_A_MESA_NOMBRE[normalizarNombre(cat.dominio)] ?? null;
      const mesa = mesaNombre ? mesasVivas.find((m) => normalizarNombre(m.nombre) === normalizarNombre(mesaNombre)) : undefined;
      const sugerencia = {
        categoriaId: cat.id,
        confianza: Math.min(0.55 + score * 0.12, 0.92),
        prioridad: PRIORIDAD_POR_SUBCATEGORIA[normalizarNombre(cat.subcategoria)] ?? 'media',
        mesaId: mesa?.id ?? null,
        dominio: cat.dominio,
        subcategoria: cat.subcategoria,
        fuente: 'reglas',
      };
      return Response.json({ sugerencia }, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    return Response.json({ sugerencia: null, motivo: 'sin match en las 13 clases' }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  } catch (e) {
    return Response.json({ sugerencia: null, motivo: String(e) }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }
});
