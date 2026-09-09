-- SLA compromiso — columna vence_en + trigger + recálculo dashboard_kpis + alertas por vencimiento
-- Duraciones: critica 60m, alta 240m (4h), media 1440m (24h), baja 4320m (72h) — espejo de shared/src/sla.ts y sla_config

-- 1) Columna vence_en en tickets
alter table public.tickets add column if not exists sla_vence_en timestamptz;

-- Helper interval por prioridad (usa sla_config si existe)
create or replace function public.sla_interval(p_prioridad public.prioridad_ticket)
returns interval language sql stable as $$
  select make_interval(mins => coalesce((select minutos from public.sla_config where prioridad = p_prioridad), case p_prioridad when 'critica' then 60 when 'alta' then 240 when 'media' then 1440 when 'baja' then 4320 else 1440 end));
$$;

-- Trigger: set sla_vence_en = creado_en + duración
create or replace function public.trg_set_sla_vence_en()
returns trigger language plpgsql as $$
begin
  -- solo si creado_en o prioridad cambian, o es insert
  if TG_OP = 'INSERT' or NEW.prioridad is distinct from OLD.prioridad or NEW.creado_en is distinct from OLD.creado_en or NEW.sla_vence_en is null then
    NEW.sla_vence_en := NEW.creado_en + public.sla_interval(NEW.prioridad);
  end if;
  return NEW;
end; $$;

drop trigger if exists tickets_set_sla_vence_en on public.tickets;
create trigger tickets_set_sla_vence_en
  before insert or update of prioridad, creado_en on public.tickets
  for each row execute function public.trg_set_sla_vence_en();

-- Backfill existentes
update public.tickets set sla_vence_en = creado_en + public.sla_interval(prioridad) where sla_vence_en is null;

create index if not exists idx_tickets_sla_vence_en on public.tickets (sla_vence_en);
create index if not exists idx_tickets_estado_sla on public.tickets (estado, sla_vence_en) where estado not in ('cerrado','solucionado');

-- 2) Función helper para estado SLA (para queries/alertas)
create or replace function public.sla_estado(
  p_creado_en timestamptz,
  p_prioridad public.prioridad_ticket,
  p_estado public.estado_ticket,
  p_sla_vence_en timestamptz,
  p_fecha_resolucion timestamptz
) returns text language sql stable as $$
  select case
    when p_estado in ('cerrado','solucionado') then
      case when coalesce(p_fecha_resolucion, now()) <= coalesce(p_sla_vence_en, p_creado_en + public.sla_interval(p_prioridad)) then 'cumplido' else 'vencido_tarde' end
    when now() > coalesce(p_sla_vence_en, p_creado_en + public.sla_interval(p_prioridad)) then 'vencido'
    when now() >= coalesce(p_sla_vence_en, p_creado_en + public.sla_interval(p_prioridad)) - make_interval(mins => least(60, (select minutos from public.sla_config where prioridad=p_prioridad)/4)) then 'por_vencer'
    else 'vigente'
  end;
$$;

-- 3) Redefinir dashboard_kpis: sla_riesgo = vencidos + por_vencer (no solo critica >45m)
create or replace function public.dashboard_kpis(
  p_desde timestamptz default null,
  p_hasta timestamptz default null,
  p_mesa_ids int[] default null,
  p_categoria_id int default null
) returns table (abiertos bigint, total bigint, sla_riesgo bigint, ttr_horas numeric, ingresados_hoy bigint, sla_vencidos bigint, sla_por_vencer bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_total bigint;
  v_abiertos bigint;
  v_riesgo bigint;
  v_vencidos bigint;
  v_por_vencer bigint;
  v_hoy bigint;
  v_ttr numeric;
begin
  select count(*) into v_total from public.tickets t
  where (p_desde is null or t.creado_en >= p_desde)
    and (p_hasta is null or t.creado_en <= p_hasta)
    and (p_mesa_ids is null or t.mesa_id = any(p_mesa_ids))
    and (p_categoria_id is null or t.categoria_id = p_categoria_id)
    and (public.is_jefe_admin() or public.puede_ver_ticket(t.id));

  select count(*) into v_abiertos from public.tickets t
  where t.estado in ('abierto','en_proceso','programado')
    and (p_desde is null or t.creado_en >= p_desde)
    and (p_hasta is null or t.creado_en <= p_hasta)
    and (p_mesa_ids is null or t.mesa_id = any(p_mesa_ids))
    and (p_categoria_id is null or t.categoria_id = p_categoria_id)
    and (public.is_jefe_admin() or public.puede_ver_ticket(t.id));

  -- vencidos: abierto/en_proceso/programado/devuelto y ahora > vence
  select count(*) into v_vencidos from public.tickets t
  where t.estado not in ('cerrado','solucionado')
    and now() > coalesce(t.sla_vence_en, t.creado_en + public.sla_interval(t.prioridad))
    and (p_desde is null or t.creado_en >= p_desde)
    and (p_hasta is null or t.creado_en <= p_hasta)
    and (p_mesa_ids is null or t.mesa_id = any(p_mesa_ids))
    and (p_categoria_id is null or t.categoria_id = p_categoria_id)
    and (public.is_jefe_admin() or public.puede_ver_ticket(t.id));

  -- por vencer: queda <25% o <60min
  select count(*) into v_por_vencer from public.tickets t
  where t.estado not in ('cerrado','solucionado')
    and now() <= coalesce(t.sla_vence_en, t.creado_en + public.sla_interval(t.prioridad))
    and now() >= coalesce(t.sla_vence_en, t.creado_en + public.sla_interval(t.prioridad)) - make_interval(mins => least(60, (select minutos from public.sla_config where prioridad=t.prioridad)/4))
    and (p_desde is null or t.creado_en >= p_desde)
    and (p_hasta is null or t.creado_en <= p_hasta)
    and (p_mesa_ids is null or t.mesa_id = any(p_mesa_ids))
    and (p_categoria_id is null or t.categoria_id = p_categoria_id)
    and (public.is_jefe_admin() or public.puede_ver_ticket(t.id));

  v_riesgo := v_vencidos + v_por_vencer;

  select count(*) into v_hoy from public.tickets t
  where t.creado_en::date = now()::date
    and (p_mesa_ids is null or t.mesa_id = any(p_mesa_ids))
    and (public.is_jefe_admin() or public.puede_ver_ticket(t.id));

  select coalesce(avg(extract(epoch from (t.fecha_resolucion - t.creado_en))/3600), 4.2) into v_ttr
  from public.tickets t where t.fecha_resolucion is not null
    and (p_desde is null or t.creado_en >= p_desde);

  return query select v_abiertos, v_total, v_riesgo, round(v_ttr::numeric,1), v_hoy, v_vencidos, v_por_vencer;
end; $$;

grant execute on function public.dashboard_kpis(timestamptz,timestamptz,int[],int) to authenticated;

-- Wrapper compat 5 cols para código viejo que espera 5 columnas
create or replace function public.dashboard_kpis_compat(
  p_desde timestamptz default null,
  p_hasta timestamptz default null,
  p_mesa_ids int[] default null,
  p_categoria_id int default null
) returns table (abiertos bigint, total bigint, sla_riesgo bigint, ttr_horas numeric, ingresados_hoy bigint)
language sql security definer set search_path=public as $$
  select abiertos, total, sla_riesgo, ttr_horas, ingresados_hoy from public.dashboard_kpis(p_desde,p_hasta,p_mesa_ids,p_categoria_id);
$$;

-- 4) Extender generar_alertas_ia: alerta por SLA vencido (1 vez por ticket)
create or replace function public.generar_alertas_ia()
returns table (insertados bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_estancados bigint := 0;
  v_picos bigint := 0;
  v_sla bigint := 0;
begin
  -- A) estancados >2d
  with candidatos as (
    select t.id, t.numero, t.mesa_id, t.prioridad, t.estado, t.categoria_id, t.actualizado_en, t.creado_en,
           m.nombre as mesa_nombre, c.subcategoria
    from public.tickets t
    left join public.mesas m on m.id = t.mesa_id
    left join public.ticket_categories c on c.id = t.categoria_id
    where t.estado in ('abierto','en_proceso','devuelto')
      and t.actualizado_en < now() - interval '2 days'
      and not exists (
        select 1 from public.alertas_ia a
        where a.tipo = 'ticket_estancado'::public.tipo_alerta_ia
          and a.ticket_id = t.id and a.estado='nueva' and a.creado_en > now() - interval '2 days'
      )
  )
  insert into public.alertas_ia (tipo, ticket_id, mesa_id, mensaje, severidad, estado)
  select 'ticket_estancado'::public.tipo_alerta_ia, cand.id, cand.mesa_id,
    format('Ticket #%s estancado %s días en %s — %s · %s', cand.numero, extract(day from now()-cand.actualizado_en)::int, cand.estado, cand.subcategoria, coalesce(cand.mesa_nombre,'Sin mesa')),
    case cand.prioridad when 'critica' then 'critica' when 'alta' then 'alta' when 'media' then 'media' else 'baja' end, 'nueva'
  from candidatos cand;
  GET DIAGNOSTICS v_estancados = ROW_COUNT;

  -- B) picos
  with stats_24h as (
    select t.mesa_id, count(*)::numeric as cnt_24h from public.tickets t where t.creado_en > now() - interval '24 hours' group by t.mesa_id
  ), stats_7d as (
    select t.mesa_id, count(*)::numeric / 7.0 as avg_dia from public.tickets t where t.creado_en >= now() - interval '7 days' and t.creado_en < now() - interval '1 hour' group by t.mesa_id
  ), picos as (
    select s24.mesa_id, s24.cnt_24h, coalesce(s7.avg_dia,0) as avg_dia,
      case when coalesce(s7.avg_dia,0)>0 then s24.cnt_24h / s7.avg_dia else 999 end as ratio, m.nombre as mesa_nombre
    from stats_24h s24 left join stats_7d s7 on s7.mesa_id is not distinct from s24.mesa_id left join public.mesas m on m.id=s24.mesa_id
    where s24.cnt_24h >=5 and ((coalesce(s7.avg_dia,0)=0 and s24.cnt_24h>=8) or s24.cnt_24h > coalesce(s7.avg_dia,0)*1.5)
      and not exists (select 1 from public.alertas_ia a where a.tipo='pico_inusual'::public.tipo_alerta_ia and coalesce(a.mesa_id,-1)=coalesce(s24.mesa_id,-1) and a.estado='nueva' and a.creado_en > now()-interval '24 hours')
  )
  insert into public.alertas_ia (tipo, mesa_id, mensaje, severidad, estado)
  select 'pico_inusual'::public.tipo_alerta_ia, p.mesa_id,
    format('Pico inusual en %s: %s tickets en 24h (promedio 7d: %s, +%s%%)', coalesce(p.mesa_nombre,'General'), p.cnt_24h::int, round(p.avg_dia,1), round((p.ratio-1)*100)),
    case when p.ratio>=2.5 then 'critica' when p.ratio>=2.0 then 'alta' when p.ratio>=1.5 then 'media' else 'baja' end, 'nueva'
  from picos p;
  GET DIAGNOSTICS v_picos = ROW_COUNT;

  -- C) SLA vencidos (nuevo): tickets abiertos con ahora > vence_en, sin alerta reciente
  with vencidos as (
    select t.id, t.numero, t.mesa_id, t.prioridad, m.nombre as mesa_nombre, c.subcategoria, t.sla_vence_en, t.creado_en
    from public.tickets t
    left join public.mesas m on m.id=t.mesa_id
    left join public.ticket_categories c on c.id=t.categoria_id
    where t.estado not in ('cerrado','solucionado')
      and now() > coalesce(t.sla_vence_en, t.creado_en + public.sla_interval(t.prioridad))
      and not exists (
        select 1 from public.alertas_ia a
        where a.tipo='ticket_estancado'::public.tipo_alerta_ia and a.ticket_id=t.id and a.mensaje like '%SLA vencido%' and a.creado_en > now()-interval '12 hours'
      )
  )
  insert into public.alertas_ia (tipo, ticket_id, mesa_id, mensaje, severidad, estado)
  select 'ticket_estancado'::public.tipo_alerta_ia, v.id, v.mesa_id,
    format('SLA vencido — Ticket #%s (%s) en %s · vence %s', v.numero, v.subcategoria, coalesce(v.mesa_nombre,'Sin mesa'), to_char(v.sla_vence_en,'YYYY-MM-DD HH24:MI')),
    case v.prioridad when 'critica' then 'critica' when 'alta' then 'alta' else 'media' end, 'nueva'
  from vencidos v;
  GET DIAGNOSTICS v_sla = ROW_COUNT;

  return query select (v_estancados + v_picos + v_sla)::bigint;
end; $$;
