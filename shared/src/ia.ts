// Clasificación IA local — descripción -> categoría / prioridad / mesa (RF-22)
// Prioridad única por categoría (editable categoría, prioridad bloqueada)
// Mesa se deriva del dominio de la categoría.

import type { PrioridadTicket } from './types.js';
import type { TicketCategoria } from './tickets.js';

// Mapeo categoría id (seed orden 1..19) -> prioridad única
export const PRIORIDAD_POR_CATEGORIA: Record<number, PrioridadTicket> = {
  1: 'media',  // tic Gestión de usuarios
  2: 'alta',   // tic Permisos y accesos
  3: 'alta',   // tic Contraseñas y seguridad
  4: 'media',  // tic Correo electrónico
  5: 'critica',// tic Conectividad y redes
  6: 'alta',   // tic Equipos y hardware
  7: 'baja',   // tic Impresoras y escáneres
  8: 'media',  // tic Software y aplicaciones
  9: 'critica',// tic Datos y respaldos
  10: 'alta',  // tic Soporte y aplicaciones institucionales
  11: 'baja',  // comunicaciones Piezas gráficas y diseño
  12: 'media', // comunicaciones Audiovisual
  13: 'media', // comunicaciones Web y publicaciones
  14: 'baja',  // comunicaciones Eventos y branding
  15: 'critica',// infraestructura Eléctrica
  16: 'alta',  // infraestructura Hidrosanitaria
  17: 'baja',  // infraestructura Carpintería y mobiliario
  18: 'media', // infraestructura Obra civil y mantenimiento locativo
  19: 'media', // general Sin clasificar / Otros
};

export function getPrioridadPorCategoria(categoriaId: number): PrioridadTicket {
  return PRIORIDAD_POR_CATEGORIA[categoriaId] ?? 'media';
}

export function getMesaIdPorDominio(dominio: string): number | null {
  switch (dominio) {
    case 'tic': return 1; // TIC
    case 'comunicaciones': return 2;
    case 'infraestructura': return 3;
    case 'general': return 4; // EAPSA como fallback
    default: return null;
  }
}

// Heurística local por keywords — MVP sin modelo externo
type KeywordRule = { catId: number; kws: string[] };
const RULES: KeywordRule[] = [
  { catId: 5, kws: ['wifi','internet','red ','vpn','sin internet','sin conexión','conectividad','caída de red','switch','router','caida red'] },
  { catId: 9, kws: ['respaldo','backup','pérdida de datos','perdida de datos','restaurar','restore','base de datos','bd ','sql'] },
  { catId: 15, kws: ['eléctrica','electrica','luz','breaker','corto','apagón','apagon','energía','energia','toma corriente'] },
  { catId: 3, kws: ['contraseña','password','clave','bloqueada','bloqueado','acceso denegado','no puedo entrar','credencial'] },
  { catId: 2, kws: ['permiso','acceso','no tengo acceso','autorización','autorizacion','rol ','privilegio'] },
  { catId: 6, kws: ['equipo','hardware','pc ','computador','portátil','portatil','no enciende','pantalla','teclado','mouse'] },
  { catId: 10, kws: ['moodle','plataforma','institucional','académica','academica','campus virtual','aula virtual'] },
  { catId: 4, kws: ['correo','email','outlook','bandeja','no llegan correos'] },
  { catId: 7, kws: ['impresora','escáner','escaner','tóner','toner','atasco','imprimir'] },
  { catId: 8, kws: ['software','aplicación','aplicacion','instalar','licencia','actualizar','error al abrir'] },
  { catId: 1, kws: ['usuario','crear usuario','activar usuario','desactivar'] },
  { catId: 16, kws: ['agua','fuga','tubería','tuberia','baño','sanitario','hidrosanitaria','inundación'] },
  { catId: 17, kws: ['carpintería','carpinteria','mueble','silla','mesa','puerta','chapa','bisagra'] },
  { catId: 18, kws: ['obra','pintura','pared','techo','piso','mantenimiento locativo','gotera','humedad'] },
  { catId: 11, kws: ['diseño','diseno','pieza gráfica','pieza grafica','flyer','banner','logo','branding'] },
  { catId: 12, kws: ['audiovisual','video','sonido','micrófono','microfono','cámara','camara','streaming','grabación'] },
  { catId: 13, kws: ['web','publicación','publicacion','sitio','página web','pagina web','cms'] },
  { catId: 14, kws: ['evento','ceremonia','protocolo','montaje evento'] },
];

export type Clasificacion = { categoriaId: number; confianza: number; prioridad: PrioridadTicket; mesaId: number | null; dominio: string };

export function classifyLocal(texto: string, categorias: TicketCategoria[]): Clasificacion | null {
  const t = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (t.trim().length < 20) return null;
  let best: { catId: number; score: number } | null = null;
  for (const r of RULES) {
    let score = 0;
    for (const kw of r.kws) {
      const k = kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (t.includes(k)) score += k.length > 5 ? 2 : 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { catId: r.catId, score };
  }
  const categoriaId = best?.catId ?? 19;
  const confianza = best ? Math.min(0.55 + best.score * 0.12, 0.92) : 0.45;
  const cat = categorias.find(c => c.id === categoriaId);
  const dominio = cat?.dominio ?? 'general';
  return {
    categoriaId,
    confianza,
    prioridad: getPrioridadPorCategoria(categoriaId),
    mesaId: getMesaIdPorDominio(dominio),
    dominio,
  };
}
