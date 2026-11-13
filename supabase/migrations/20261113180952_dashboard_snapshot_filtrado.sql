-- Consolida KPI y tres agregados del dashboard en una lectura filtrada.
create or replace function public.dashboard_snapshot_filtrado(
  p_desde timestamptz default null,
  p_hasta timestamptz default null,
  p_mesa_ids int[] default null,
  p_categoria_id int default null,
  p_estado public.estado_ticket default null,
  p_prioridad public.prioridad_ticket default null,
  p_tecnico_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with filtrados as materialized (
    select t.id, t.estado, t.prioridad, t.creado_en, t.sla_vence_en,
      t.fecha_resolucion, t.mesa_id
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
  kpi as (
    select
      count(*) filter (where estado in ('abierto', 'en_proceso', 'programado')) as abiertos,
      count(*) as total,
      count(*) filter (
        where estado not in ('cerrado', 'solucionado')
          and pg_catalog.now() > coalesce(sla_vence_en, creado_en + public.sla_interval(prioridad))
      ) as sla_vencidos,
      count(*) filter (
        where estado not in ('cerrado', 'solucionado')
          and pg_catalog.now() <= coalesce(sla_vence_en, creado_en + public.sla_interval(prioridad))
          and pg_catalog.now() >= coalesce(sla_vence_en, creado_en + public.sla_interval(prioridad))
            - pg_catalog.make_interval(mins => least(60, extract(epoch from public.sla_interval(prioridad))::int / 240))
      ) as sla_por_vencer,
      count(*) filter (where creado_en::date = pg_catalog.now()::date) as ingresados_hoy,
      avg(extract(epoch from (fecha_resolucion - creado_en)) / 3600)
        filter (where fecha_resolucion is not null and estado in ('cerrado', 'solucionado')) as ttr
    from filtrados
  ),
  estados as (
    select estado, count(*) as cantidad from filtrados group by estado
  ),
  prioridades as (
    select prioridad, count(*) as cantidad from filtrados group by prioridad
  ),
  carga as (
    select ((extract(dow from creado_en)::int + 6) % 7) as dow,
      extract(hour from creado_en)::int as hora, count(*) as cantidad
    from filtrados
    where ((extract(dow from creado_en)::int + 6) % 7) between 0 and 4
      and extract(hour from creado_en)::int between 7 and 21
    group by 1, 2
  ),
  evolucion as (
    select creado_en::date as dia, mesa_id, count(*) as cantidad
    from filtrados
    where creado_en >= coalesce(p_desde, pg_catalog.now() - interval '30 days')
    group by 1, 2
  )
  select pg_catalog.jsonb_build_object(
    'kpis', (
      select pg_catalog.jsonb_build_object(
        'abiertos', abiertos,
        'total', total,
        'sla_vencidos', sla_vencidos,
        'sla_por_vencer', sla_por_vencer,
        'sla_riesgo', sla_vencidos + sla_por_vencer,
        'ingresados_hoy', ingresados_hoy,
        'ttr_horas', pg_catalog.round(ttr::numeric, 1)
      ) from kpi
    ),
    'estados', coalesce(
      (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('estado', estado, 'count', cantidad) order by cantidad desc) from estados),
      '[]'::jsonb
    ),
    'prioridades', coalesce(
      (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('prioridad', prioridad, 'count', cantidad) order by cantidad desc) from prioridades),
      '[]'::jsonb
    ),
    'carga_horaria', coalesce(
      (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('dow', dow, 'hour', hora, 'count', cantidad) order by dow, hora) from carga),
      '[]'::jsonb
    ),
    'evolucion', coalesce(
      (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('dia', dia, 'mesa_id', mesa_id, 'count', cantidad) order by dia, mesa_id) from evolucion),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.dashboard_snapshot_filtrado(
  timestamptz, timestamptz, int[], int, public.estado_ticket, public.prioridad_ticket, uuid
) from public, anon;
grant execute on function public.dashboard_snapshot_filtrado(
  timestamptz, timestamptz, int[], int, public.estado_ticket, public.prioridad_ticket, uuid
) to authenticated, service_role;
