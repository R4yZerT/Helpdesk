// Tipos de dominio espejo de la base de datos (enums de schema_inicial.sql).
// Prototipo: esqueleto inicial.

export type RolUsuario = 'usuario' | 'tecnico' | 'jefe' | 'administrador';

export type EstadoTicket =
  'abierto' | 'en_proceso' | 'solucionado' | 'cerrado' | 'devuelto' | 'programado';

export type PrioridadTicket = 'baja' | 'media' | 'alta' | 'critica';

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
