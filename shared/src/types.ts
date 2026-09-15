// Tipos de dominio espejo de la base de datos (enums de schema_inicial.sql).
// Prototipo: esqueleto inicial.

export type RolUsuario = 'usuario' | 'tecnico' | 'jefe' | 'administrador';

export type EstadoTicket =
  'abierto' | 'en_proceso' | 'solucionado' | 'cerrado' | 'devuelto' | 'programado';

export type PrioridadTicket = 'baja' | 'media' | 'alta' | 'critica';

// Normalización para comparar nombres de catálogo (minúsculas, sin tildes, sin bordes).
export function normalizarNombre(v: string): string {
  return v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// RF-06 — Prioridad única por categoría, claveada por NOMBRE de subcategoría.
// Los IDs de ticket_categories son seriales y cambian con seeds/migraciones;
// el nombre es el identificador estable. Desconocida -> 'media'.
export const PRIORIDAD_POR_SUBCATEGORIA: Record<string, PrioridadTicket> = {
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

export function getPrioridadPorSubcategoria(subcategoria: string): PrioridadTicket {
  return PRIORIDAD_POR_SUBCATEGORIA[normalizarNombre(subcategoria)] ?? 'media';
}

export interface Ticket {
  id: string;
  numero: number;
  usuarioId: string;
  mesaId?: number;
  categoriaId: number;
  asunto: string;
  descripcion: string;
  prioridad: PrioridadTicket;
  estado: EstadoTicket;
  tecnicoAsignadoId?: string;
  fechaResolucion?: string;
  creadoEn: string;
}
