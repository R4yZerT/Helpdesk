-- Agrega los KPI una sola vez en la base y acepta todos los filtros activos.
-- SECURITY DEFINER conserva la visibilidad del RPC histórico mediante la misma
-- política explícita de acceso al ticket.
create or replace function public.dashboard_kpis_filtrado(
  p_desde timestamptz default null,
  p_hasta timestamptz default null,
  p_mesa_ids int[] default null,
  p_categoria_id int default null,
  p_estado public.estado_ticket default null,
  p_prioridad public.prioridad_ticket default null,
  p_tecnico_id uuid default null
)
returns table (
  abiertos bigint,
  total bigint,
  sla_riesgo bigint,
  ttr_horas numeric,
  ingresados_hoy bigint,
  sla_vencidos bigint,
  sla_por_vencer bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with filtrados as materialized (
    select t.*
    from public.tickets t
    where (p_desde is null or t.creado_en >= p_desde)
      and (p_hasta is null or t.creado_en <= p_hasta)
      and (p_mesa_ids is null or t.mesa_id = any(p_mesa_ids))
      and (p_categoria_id is null or t.categoria_id = p_categoria_id)
      and (p_estado is null or t.estado = p_estado)
      and (p_prioridad is null or t.prioridad = p_prioridad)
      and (p_tecnico_id is null or t.tecnico_asignado_id = p_tecnico_id)
      and (public.is_jefe_admin() or public.puede_ver_ticket(t.id))
  ),
  agregados as (
    select
      count(*) filter (where estado in ('abierto', 'en_proceso', 'programado')) as abiertos,
      count(*) as total,
      count(*) filter (
        where estado not in ('cerrado', 'solucionado')
          and pg_catalog.now() > coalesce(sla_vence_en, creado_en + public.sla_interval(prioridad))
      ) as vencidos,
      count(*) filter (
        where estado not in ('cerrado', 'solucionado')
          and pg_catalog.now() <= coalesce(sla_vence_en, creado_en + public.sla_interval(prioridad))
          and pg_catalog.now() >= coalesce(sla_vence_en, creado_en + public.sla_interval(prioridad))
            - pg_catalog.make_interval(mins => least(
                60,
                extract(epoch from public.sla_interval(prioridad))::int / 240
              ))
      ) as por_vencer,
      count(*) filter (where creado_en::date = pg_catalog.now()::date) as ingresados_hoy,
      avg(extract(epoch from (fecha_resolucion - creado_en)) / 3600)
        filter (where fecha_resolucion is not null and estado in ('cerrado', 'solucionado')) as ttr
    from filtrados
  )
  select abiertos, total, vencidos + por_vencer, round(ttr::numeric, 1),
    ingresados_hoy, vencidos, por_vencer
  from agregados;
$$;

revoke all on function public.dashboard_kpis_filtrado(
  timestamptz, timestamptz, int[], int, public.estado_ticket,
  public.prioridad_ticket, uuid
) from public, anon;
grant execute on function public.dashboard_kpis_filtrado(
  timestamptz, timestamptz, int[], int, public.estado_ticket,
  public.prioridad_ticket, uuid
) to authenticated, service_role;
