// Contratos tipados compartidos entre mobile y web.

export type { RolUsuario, EstadoTicket, PrioridadTicket } from './types.js';
export type { Ticket as TicketBase } from './types.js';
export * from './roles.js';
export * from './permissions.js';
export * from './supabase.js';
export * from './auth.js';
export * from './password.js';
export type { TicketCategoria, Mesa, Ticket, TicketEstado, TicketComentario, TicketDetail, CreateTicketInput, CreateTicketErrors, ListMyTicketsParams, ListMyTicketsResult, UpdateTicketInput, ListAssignedParams } from './tickets.js';
export { PRIORIDADES, ESTADOS, isPrioridadTicket, isEstadoTicket, validateCreateTicket, isCreateTicketValid, validateComentario, fetchCategorias, fetchMesas, createTicket, listMyTickets, getTicketDetail, addComentario, updateTicket, cancelTicket, transitionTicket, canTransition, reassignTicket, listAssignedTickets, PRIORIDAD_PESO, validateUpdateTicket } from './tickets.js';
export * from './ui/theme.js';
export * from './ui/components.js';
