-- RF-23 sender: columna enviada_en + cron cada 5 min para send-push
-- Idempotente y seguro si pg_cron / pg_net no están disponibles.

-- 1) Columna de despacho (dedup del Edge Function send-push)
alter table public.notificaciones
  add column if not exists enviada_en timestamptz;

create index if not exists idx_notificaciones_pendientes_envio
  on public.notificaciones (creado_en)
  where enviada_en is null;

-- 2) Disparador SQL del sender: invoca al Edge Function vía pg_net si está configurado.
-- Requiere (producción):
--   alter database ... set app.settings.functions_url = 'https://<ref>.supabase.co/functions/v1';
--   alter database ... set app.settings.service_role_key = '<service_role>';
-- Sin pg_net o sin configuración, retorna mensaje y sale 0 (el in-app sigue funcionando).
create or replace function public.send_push_disparo()
returns text
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  v_url text;
  v_key text;
  v_pendientes int;
begin
  select count(*)::int into v_pendientes
  from public.notificaciones
  where enviada_en is null;

  if v_pendientes = 0 then
    return 'sin pendientes';
  end if;

  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    return format('pg_net no disponible (%s pendientes, in-app intacto)', v_pendientes);
  end if;

  v_url := current_setting('app.settings.functions_url', true);
  v_key := current_setting('app.settings.service_role_key', true);
  if v_url is null or v_url = '' or v_key is null or v_key = '' then
    return format('sender sin configurar (%s pendientes: define app.settings.functions_url + service_role_key)', v_pendientes);
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object('limit', 100)
  );
  return format('disparo send-push ok (%s pendientes)', v_pendientes);
exception when others then
  return 'disparo send-push falló: ' || sqlerrm;
end;
$$;

grant execute on function public.send_push_disparo() to authenticated;
grant execute on function public.send_push_disparo() to service_role;

-- 3) pg_cron cada 5 min (solo si la extensión existe)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('send_push_cada_5min', '*/5 * * * *', $cron$select public.send_push_disparo()$cron$);
  end if;
exception when others then null;
end $$;
