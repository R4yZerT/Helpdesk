-- Integración forecast ML clásico (RF-19): tabla pronosticos_picos + alerta preventiva pico_esperado
-- Flujo: scripts/upload-pronostico.ts puebla la tabla -> generar_alertas_pronostico() crea alertas
--   -> trg_alerta_ia_notificar avisa a jefes/admins vía notificaciones (Realtime + send-push cada 5 min)
-- Todo idempotente (IF NOT EXISTS / DROP IF EXISTS) y con dedup de 24h.

-- 1) Nuevo tipo de alerta preventiva
-- NOTA: ALTER TYPE ... ADD VALUE no puede correr dentro de la transacción de `db push`,
-- por eso se aplica ANTES con:  alter type public.tipo_alerta_ia add value 'pico_esperado';
-- (SQL editor del dashboard o psql; statement único = transacción propia).
do $$ begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'tipo_alerta_ia' and e.enumlabel = 'pico_esperado'
  ) then
    raise exception 'Falta el valor pico_esperado en tipo_alerta_ia: ejecútalo primero fuera de transacción -> alter type public.tipo_alerta_ia add value ''pico_esperado'';';
  end if;
end $$;

-- 2) Tabla de pronósticos (una fila por día x serie del modelo)
create table if not exists public.pronosticos_picos (
  id              bigserial primary key,
  fecha           date not null,
  serie           text not null, -- 'global' o dependencia ('Oficina TIC', ...)
  forecast        numeric not null,
  nivel           text not null check (nivel in ('baja', 'media', 'alta', 'pico')),
  es_pico         boolean not null default false,
  modelo_version  text not null, -- ej 'rf-forecast-20260915'
  creado_en       timestamptz not null default now(),
  unique (fecha, serie, modelo_version)
);
create index if not exists idx_pronosticos_fecha on public.pronosticos_picos (fecha, es_pico);
alter table public.pronosticos_picos enable row level security;
drop policy if exists pronosticos_select_jefe_admin on public.pronosticos_picos;
create policy pronosticos_select_jefe_admin on public.pronosticos_picos
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.activo and p.rol in ('jefe', 'administrador')));
grant select on public.pronosticos_picos to authenticated;

-- 3) Generadora de alertas preventivas: picos pronosticados en las próximas 48h
create or replace function public.generar_alertas_pronostico()
returns table (insertados bigint)
language plpgsql security definer set search_path = public as $$
declare v_n bigint := 0;
begin
  with proximos as (
    select p.fecha, p.serie, p.forecast, p.modelo_version
    from public.pronosticos_picos p
    where p.fecha between current_date and current_date + 2
      and p.es_pico and p.nivel = 'pico'
      and not exists (
        select 1 from public.alertas_ia a
        where a.tipo = 'pico_esperado'::public.tipo_alerta_ia
          and a.estado = 'nueva'
          and a.mensaje like '%' || p.fecha::text || '%'
          and a.creado_en > now() - interval '24 hours'
      )
  )
  insert into public.alertas_ia (tipo, mensaje, severidad, estado)
  select
    'pico_esperado'::public.tipo_alerta_ia,
    format('Pico esperado %s (%s): ~%s tickets [modelo %s]',
      pr.fecha::text, pr.serie, round(pr.forecast)::int, pr.modelo_version),
    case when pr.forecast >= 100 then 'critica' else 'alta' end,
    'nueva'
  from proximos pr;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  return query select v_n;
end; $$;
grant execute on function public.generar_alertas_pronostico() to authenticated;
grant execute on function public.generar_alertas_pronostico() to service_role;

-- 4) Comunicaciones: toda alerta de pico (inusual o esperada, alta/crítica) notifica a jefes/admins.
--    Las notificaciones llegan por Realtime al instante y por push vía send-push (cron 5 min).
create or replace function public.trg_notificar_alerta_ia()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.tipo in ('pico_inusual'::public.tipo_alerta_ia, 'pico_esperado'::public.tipo_alerta_ia)
     and NEW.severidad in ('alta', 'critica') then
    insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo)
    select p.id,
           'alerta_pico',
           case NEW.tipo when 'pico_esperado'::public.tipo_alerta_ia then 'Pico de tickets esperado' else 'Pico inusual de tickets' end,
           NEW.mensaje
    from public.profiles p
    where p.activo and p.rol in ('jefe', 'administrador');
  end if;
  return NEW;
end; $$;
drop trigger if exists trg_alerta_ia_notificar on public.alertas_ia;
create trigger trg_alerta_ia_notificar
  after insert on public.alertas_ia
  for each row execute function public.trg_notificar_alerta_ia();

-- 5) Cron diario 06:00 (si pg_cron disponible; el edge generate-alertas también la dispara bajo demanda)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('generar_alertas_pronostico_diario', '0 6 * * *', $cron$select public.generar_alertas_pronostico()$cron$);
  end if;
exception when others then null;
end $$;
