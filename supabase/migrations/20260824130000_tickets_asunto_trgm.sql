-- RF-08 — Búsqueda asunto acelerada con pg_trgm (Performance: E24)
-- ILIKE '%q%' sin índice es seq scan; con GIN gin_trgm_ops usa bitmap
create extension if not exists pg_trgm;

-- Índice GIN para ILIKE en asunto (solo tickets, no afecta RLS)
create index if not exists idx_tickets_asunto_trgm on public.tickets using gin (asunto gin_trgm_ops);

-- Índice compuesto para paginación server: usuario_id + creado_en desc cubre listMyTickets orden
create index if not exists idx_tickets_usuario_creado on public.tickets (usuario_id, creado_en desc, id desc);
