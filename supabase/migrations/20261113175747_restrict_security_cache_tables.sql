-- Evita que las tablas internas de contraseñas y SLA queden expuestas por la Data API.
-- El acceso de las funciones privilegiadas se conserva vía SECURITY DEFINER;
-- los procesos backend pueden usar service_role explícitamente.
alter table public.hibp_cache enable row level security;
alter table public.sla_config enable row level security;

revoke all on table public.hibp_cache from public, anon, authenticated;
revoke all on table public.sla_config from public, anon, authenticated;

grant all on table public.hibp_cache to service_role;
grant all on table public.sla_config to service_role;
