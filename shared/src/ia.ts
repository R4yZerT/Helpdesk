// Clasificación IA — descripción -> dependencia + categoría (RF-06 / RF-22)
// La IA solo sugiere dependencia y categoría (editable por el usuario).
// No sugiere técnico: el ticket entra a la cola de la dependencia.
//
// Reglas estables ante seeds/migraciones:
// - Las reglas apuntan a NOMBRES canónicos (dominio + subcategoría), nunca a IDs.
// - Cada predicción se resuelve contra el catálogo vivo (categorías/mesas de BD).
// - La prioridad sale del mapa por nombre en types.ts.
// - La mesa se resuelve por NOMBRE de mesa (IDs reales, no 1..4 fijos).
// Fuente primaria: micro-API BETO (ml/src/serve.py); fallback: reglas locales.

import type { PrioridadTicket } from './types.js';
import { getPrioridadPorSubcategoria, normalizarNombre } from './types.js';
import type { Mesa, TicketCategoria } from './tickets.js';

// Minúsculas + sin tildes, preservando espacios (para keywords como 'red ').
const sinTildes = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Dominio normalizado -> nombre canónico de mesa (seed: TIC/Comunicaciones/Infraestructura/EAPSA)
const DOMINIO_A_MESA_NOMBRE: Record<string, string> = {
  tic: 'TIC',
  comunicaciones: 'Comunicaciones',
  infraestructura: 'Infraestructura',
  eapsa: 'EAPSA',
  general: 'EAPSA',
};

export function getMesaNombrePorDominio(dominio: string): string | null {
  return DOMINIO_A_MESA_NOMBRE[normalizarNombre(dominio)] ?? null;
}

// Compatibilidad: Dashboard/FilterBar comparan contra IDs de mesa 1..4 del seed inicial.
// Para crear tickets se prefiere resolverMesaId (por nombre, con IDs reales).
export function getMesaIdPorDominio(dominio: string): number | null {
  switch (normalizarNombre(dominio)) {
    case 'tic': return 1; // TIC
    case 'comunicaciones': return 2;
    case 'infraestructura': return 3;
    case 'general':
    case 'eapsa': return 4; // EAPSA como fallback
    default: return null;
  }
}

// Resuelve el ID real de la mesa buscando por nombre; fallback al mapeo legacy.
export function resolverMesaId(dominio: string, mesas: Mesa[]): number | null {
  const esperado = getMesaNombrePorDominio(dominio);
  if (esperado) {
    const mesa = mesas.find((m) => normalizarNombre(m.nombre) === normalizarNombre(esperado));
    if (mesa) return mesa.id;
  }
  return getMesaIdPorDominio(dominio);
}

// Prioridad por categoría viva (por nombre); ID desconocido -> 'media'.
export function getPrioridadPorCategoria(categoriaId: number, categorias: TicketCategoria[]): PrioridadTicket {
  const cat = categorias.find((c) => c.id === categoriaId);
  if (!cat) return 'media';
  return getPrioridadPorSubcategoria(cat.subcategoria);
}

// Heurística local por keywords — fallback cuando la API BETO no responde.
// Cada regla apunta a (dominio, subcategoría) canónicos ya normalizados.
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

export type Clasificacion = { categoriaId: number; confianza: number; prioridad: PrioridadTicket; mesaId: number | null; dominio: string };

export function classifyLocal(texto: string, categorias: TicketCategoria[]): Clasificacion | null {
  const t = sinTildes(texto.trim());
  if (t.length < 20) return null;
  const puntuadas = RULES.map((regla) => {
    let score = 0;
    for (const kw of regla.kws) {
      if (t.includes(sinTildes(kw))) score += kw.length > 5 ? 2 : 1;
    }
    return { regla, score };
  })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);
  for (const { regla, score } of puntuadas) {
    const cat = categorias.find(
      (c) => normalizarNombre(c.dominio) === regla.dominio && normalizarNombre(c.subcategoria) === regla.subcategoria,
    );
    if (!cat) continue; // la regla apunta a una categoría que ya no existe: se ignora
    return {
      categoriaId: cat.id,
      confianza: Math.min(0.55 + score * 0.12, 0.92),
      prioridad: getPrioridadPorSubcategoria(cat.subcategoria),
      mesaId: null, // la mesa la resuelve la pantalla con resolverMesaId (IDs reales)
      dominio: cat.dominio,
    };
  }
  return null; // sin match: no se fuerza ninguna categoría
}

export type FuentePrediccion = 'beto' | 'reglas';
export type PrediccionCategoria = {
  categoriaId: number;
  dominio: string;
  subcategoria: string;
  prioridad: PrioridadTicket;
  mesaId: number | null;
  confianza: number;
  fuente: FuentePrediccion;
};
export type CatalogosPrediccion = { categorias: TicketCategoria[]; mesas: Mesa[] };

type GlobalConEnv = typeof globalThis & { process?: { env?: Record<string, string | undefined> } };

function betoUrlDefecto(): string {
  // EXPO_PUBLIC_BETO_URL se inyecta en build (web/móvil); default: micro-API local.
  const env = (globalThis as GlobalConEnv).process?.env?.EXPO_PUBLIC_BETO_URL;
  return (env?.trim() || 'http://127.0.0.1:8001').replace(/\/$/, '');
}

async function predecirConBeto(
  texto: string,
  catalogos: CatalogosPrediccion,
  opts?: { url?: string; timeoutMs?: number },
): Promise<PrediccionCategoria | null> {
  try {
    const base = (opts?.url ?? betoUrlDefecto()).replace(/\/$/, '');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts?.timeoutMs ?? 4000);
    try {
      const resp = await fetch(`${base}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: texto }),
        signal: ctrl.signal,
      });
      if (!resp.ok) return null;
      const data = (await resp.json()) as { dominio?: unknown; subcategoria?: unknown; confianza?: unknown; etiqueta?: unknown };
      if (typeof data?.dominio !== 'string' || typeof data?.subcategoria !== 'string') return null;
      const cat = catalogos.categorias.find(
        (c) => normalizarNombre(c.dominio) === normalizarNombre(data.dominio as string)
          && normalizarNombre(c.subcategoria) === normalizarNombre(data.subcategoria as string),
      );
      if (!cat) {
        // Etiqueta BETO sin match: se descarta y decide el fallback de reglas
        return null;
      }
      return {
        categoriaId: cat.id,
        dominio: cat.dominio,
        subcategoria: cat.subcategoria,
        prioridad: getPrioridadPorSubcategoria(cat.subcategoria),
        mesaId: resolverMesaId(cat.dominio, catalogos.mesas),
        confianza: typeof data.confianza === 'number' ? data.confianza : 0.7,
        fuente: 'beto',
      };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null; // API apagada o inalcanzable: fallback a reglas
  }
}

// Entrada principal de las pantallas: BETO primero, reglas locales como fallback.
export async function predecirCategoria(
  texto: string,
  catalogos: CatalogosPrediccion,
  opts?: { url?: string; timeoutMs?: number },
): Promise<PrediccionCategoria | null> {
  const t = texto.trim();
  if (t.length < 20) return null;
  const beto = await predecirConBeto(t, catalogos, opts);
  if (beto) return beto;
  const reglas = classifyLocal(t, catalogos.categorias);
  if (!reglas) return null;
  const cat = catalogos.categorias.find((c) => c.id === reglas.categoriaId);
  if (!cat) return null;
  return {
    categoriaId: cat.id,
    dominio: cat.dominio,
    subcategoria: cat.subcategoria,
    prioridad: reglas.prioridad,
    mesaId: resolverMesaId(cat.dominio, catalogos.mesas),
    confianza: reglas.confianza,
    fuente: 'reglas',
  };
}
