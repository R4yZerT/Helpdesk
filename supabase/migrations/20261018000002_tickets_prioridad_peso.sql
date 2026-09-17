-- QA-H3 — prioridad ordenable en DB para la bandeja del técnico (RF-12).
-- listAssignedTickets paginaba por creado_en y reordenaba por prioridad en
-- memoria: una crítica de la página 1 nunca subía a la página 0.
-- Columna generada (siempre consistente con prioridad) + índice de bandeja;
-- el cliente ordena por prioridad_peso antes de .range().
-- Espeja shared/src/tickets.ts PRIORIDAD_PESO { critica:4, alta:3, media:2, baja:1 }.

alter table public.tickets
  add column if not exists prioridad_peso smallint
  generated always as (
    case prioridad
      when 'critica' then 4
      when 'alta' then 3
      when 'media' then 2
      when 'baja' then 1
      else 0
    end
  ) stored;

create index if not exists idx_tickets_bandeja_tecnico
  on public.tickets (tecnico_asignado_id, prioridad_peso desc, creado_en asc, id asc)
  where tecnico_asignado_id is not null;
