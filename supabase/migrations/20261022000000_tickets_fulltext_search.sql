-- H9 — Búsqueda full-text en español sobre tickets (asunto + descripción).
-- Columna generada: se recalcula sola en insert/update y se backfillea al crearla.
alter table public.tickets
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('spanish', coalesce(asunto, '') || ' ' || coalesce(descripcion, ''))
  ) stored;

-- Índice GIN para búsquedas @@ rápidas.
create index if not exists tickets_search_vector_gin
  on public.tickets using gin (search_vector);
