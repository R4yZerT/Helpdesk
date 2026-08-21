-- Habilita RLS en ticket_categories (fix RLS deshabilitado detectado en advisors)
alter table public.ticket_categories enable row level security;
