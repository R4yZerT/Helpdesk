-- RF-19/21/23 — Operación programada en Postgres.
-- Las migraciones previas solo agendaban los jobs `si pg_cron ya existía`, pero
-- la extensión nunca se instaló en el proyecto Cloud: las alertas IA quedaron
-- detenidas desde 2026-09-22 y el pronóstico dejó de refrescarse. Esta migración
-- habilita pg_cron y agenda los tres jobs de forma idempotente.

create extension if not exists pg_cron;

-- 1) Alertas reactivas (tickets estancados, picos inusuales, SLA vencido)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'generar_alertas_ia_cada_hora',
      '0 * * * *',
      $cron$select public.generar_alertas_ia()$cron$
    );
  end if;
end $$;

-- 2) Alertas preventivas a partir de pronosticos_picos (forecast ML)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'generar_alertas_pronostico_diario',
      '0 6 * * *',
      $cron$select public.generar_alertas_pronostico()$cron$
    );
  end if;
end $$;

-- 3) Sender push (no-op si faltan pg_net o app.settings.*; el in-app no depende)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'send_push_cada_5min',
      '*/5 * * * *',
      $cron$select public.send_push_disparo()$cron$
    );
  end if;
end $$;

-- 4) Limpieza del backlog: una alerta deja de tener sentido cuando el ticket
-- se resolvió o volvió a moverse después de crearse la alerta. Sin esto el
-- panel acumulaba miles de alertas "nueva" de septiembre.
update public.alertas_ia a
set estado = 'resuelta'
from public.tickets t
where t.id = a.ticket_id
  and a.estado in ('nueva', 'vista')
  and (
    t.estado in ('solucionado', 'cerrado')
    or (a.mensaje not like 'SLA vencido%' and t.actualizado_en > a.creado_en)
  );

-- 5) Mantener el panel limpio hacia adelante: al moverse un ticket, sus alertas
-- de estancamiento se resuelven solas en vez de esperar revisión manual.
create or replace function public.resolver_alertas_por_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.alertas_ia
  set estado = 'resuelta'
  where ticket_id = new.id
    and estado in ('nueva', 'vista')
    and (
      new.estado in ('solucionado', 'cerrado')
      or mensaje not like 'SLA vencido%'
    );
  return new;
end;
$$;

drop trigger if exists trg_resolver_alertas_ticket on public.tickets;
create trigger trg_resolver_alertas_ticket
after update of estado, actualizado_en on public.tickets
for each row
when (old.estado is distinct from new.estado or old.actualizado_en is distinct from new.actualizado_en)
execute function public.resolver_alertas_por_ticket();

-- 6) Una sola alerta abierta por ticket y tipo: el generador crea una cada 2
-- días mientras el ticket siga estancado, lo que llenaba el panel de repetidas.
create or replace function public.resolver_alertas_duplicadas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resueltas integer;
begin
  with duplicadas as (
    select a.id
    from public.alertas_ia a
    where a.estado = 'nueva'
      and a.ticket_id is not null
      and exists (
        select 1
        from public.alertas_ia b
        where b.ticket_id = a.ticket_id
          and b.tipo = a.tipo
          and b.estado = 'nueva'
          and (b.creado_en, b.id) > (a.creado_en, a.id)
      )
  )
  update public.alertas_ia
  set estado = 'resuelta'
  where id in (select id from duplicadas);

  get diagnostics v_resueltas = row_count;
  return v_resueltas;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- 5 minutos después de cada generación horaria
    perform cron.schedule(
      'resolver_alertas_duplicadas',
      '5 * * * *',
      $cron$select public.resolver_alertas_duplicadas()$cron$
    );
  end if;
end $$;

-- Backlog inicial de duplicadas
select public.resolver_alertas_duplicadas();
