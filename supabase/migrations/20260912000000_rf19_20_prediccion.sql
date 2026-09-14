-- RF-19/20 — Predicción de picos y patrones por categoría (dashboard)
-- SECURITY DEFINER con chequeo is_jefe_admin / puede_ver_ticket
-- Fallback cliente en shared/src/dashboard.ts si RPC no existe

-- ─────────────────────────────────────────────
-- RF-19: Predicción de picos por hora/día/mesa
-- ─────────────────────────────────────────────
-- Señal: promedio histórico 30 días agrupado por (dow,hour,mesa_id).
-- Forecast: avg * factor estacional mensual (histórico mismo mes / promedio anual).
-- Pico predicho: forecast >= 6 (alta) o >=10 (pico) o top 15% del ranking.
create or replace function public.dashboard_picos_prediccion(
  p_dias int default 30,
  p_mesa_ids int[] default null,
  p_categoria_id int default null
) returns table (
  dow int,
  hour int,
  mesa_id int,
  mesa_nombre text,
  avg_cnt numeric,
  forecast_cnt numeric,
  nivel text,
  es_pico boolean
)
language plpgsql security definer set search_path = public as $$
declare
  v_weeks numeric;
begin
  v_weeks := greatest(p_dias / 7.0, 1);

  return query
  with hist as (
    select
      ((extract(dow from t.creado_en)::int + 6) % 7) as dow,
      extract(hour from t.creado_en)::int as hour,
      t.mesa_id,
      count(*)::numeric as cnt
    from public.tickets t
    where t.creado_en >= now() - (p_dias || ' days')::interval
      and ((extract(dow from t.creado_en)::int + 6) % 7) between 0 and 4
      and extract(hour from t.creado_en)::int between 7 and 21
      and (p_mesa_ids is null or t.mesa_id = any(p_mesa_ids))
      and (p_categoria_id is null or t.categoria_id = p_categoria_id)
      and (public.is_jefe_admin() or public.puede_ver_ticket(t.id))
    group by 1,2,3
  ),
  agg as (
    select
      h.dow, h.hour, h.mesa_id,
      h.cnt / v_weeks as avg_cnt
    from hist h
  ),
  -- factor estacional mensual simple: ratio mes actual vs promedio anual (últimos 12 meses)
  estacional as (
    select
      coalesce(
        (select count(*)::numeric from public.tickets t2
          where extract(month from t2.creado_en) = extract(month from now())
            and t2.creado_en >= now() - interval '12 months'
            and (p_mesa_ids is null or t2.mesa_id = any(p_mesa_ids))
            and (p_categoria_id is null or t2.categoria_id = p_categoria_id)
            and (public.is_jefe_admin() or public.puede_ver_ticket(t2.id))
        ) / nullif(
          (select count(*)::numeric / 12 from public.tickets t3
            where t3.creado_en >= now() - interval '12 months'
              and (p_mesa_ids is null or t3.mesa_id = any(p_mesa_ids))
              and (p_categoria_id is null or t3.categoria_id = p_categoria_id)
              and (public.is_jefe_admin() or public.puede_ver_ticket(t3.id))
          ), 0),
        1
      ) as factor
  ),
  ranked as (
    select
      a.dow, a.hour, a.mesa_id,
      round(a.avg_cnt, 2) as avg_cnt,
      round(a.avg_cnt * (select factor from estacional), 2) as forecast_cnt
    from agg a
  ),
  with_nivel as (
    select
      r.*,
      case
        when r.forecast_cnt >= 10 then 'pico'
        when r.forecast_cnt >= 6 then 'alta'
        when r.forecast_cnt >= 3 then 'media'
        else 'baja'
      end as nivel
    from ranked r
  )
  select
    w.dow, w.hour, w.mesa_id,
    m.nombre as mesa_nombre,
    w.avg_cnt, w.forecast_cnt, w.nivel,
    (w.nivel in ('alta','pico')) as es_pico
  from with_nivel w
  left join public.mesas m on m.id = w.mesa_id
  order by w.forecast_cnt desc, w.dow, w.hour
  limit 60;
end; $$;

grant execute on function public.dashboard_picos_prediccion(int,int[],int) to authenticated;

-- ─────────────────────────────────────────────
-- RF-19 agregado por día/mes/mesa (forecast 7 días y mensual)
-- ─────────────────────────────────────────────
create or replace function public.dashboard_picos_resumen(
  p_dias int default 30,
  p_mesa_ids int[] default null
) returns table (
  mesa_id int,
  mesa_nombre text,
  avg_dia numeric,
  forecast_7d numeric,
  forecast_30d numeric,
  peak_hour int,
  peak_dow int
)
language sql security definer set search_path = public as $$
  with hist as (
    select t.mesa_id,
           count(*)::numeric as cnt,
           extract(hour from t.creado_en)::int as hr,
           ((extract(dow from t.creado_en)::int + 6) % 7) as dow
    from public.tickets t
    where t.creado_en >= now() - (p_dias || ' days')::interval
      and (p_mesa_ids is null or t.mesa_id = any(p_mesa_ids))
      and (public.is_jefe_admin() or public.puede_ver_ticket(t.id))
    group by t.mesa_id, hr, dow
  ),
  por_mesa as (
    select mesa_id,
           sum(cnt) / greatest(p_dias,1)::numeric as avg_dia,
           -- hora y dow con más volumen
           (array_agg(hr order by cnt desc))[1] as peak_hour,
           (array_agg(dow order by cnt desc))[1] as peak_dow
    from hist group by mesa_id
  )
  select
    pm.mesa_id, m.nombre as mesa_nombre,
    round(pm.avg_dia,1) as avg_dia,
    round(pm.avg_dia * 7,0) as forecast_7d,
    round(pm.avg_dia * 30,0) as forecast_30d,
    pm.peak_hour, pm.peak_dow
  from por_mesa pm left join public.mesas m on m.id = pm.mesa_id
  order by avg_dia desc;
$$;

grant execute on function public.dashboard_picos_resumen(int,int[]) to authenticated;

-- ─────────────────────────────────────────────
-- RF-20: Patrones de demanda por categoría normalizada
-- ─────────────────────────────────────────────
create or replace function public.dashboard_patrones_categoria(
  p_dias int default 30,
  p_mesa_ids int[] default null
) returns table (
  categoria_id int,
  subcategoria text,
  dominio text,
  cnt_actual bigint,
  cnt_previo bigint,
  variacion_pct numeric,
  share_pct numeric,
  tendencia text
)
language sql security definer set search_path = public as $$
  with actual as (
    select t.categoria_id, count(*)::bigint as cnt
    from public.tickets t
    where t.creado_en >= now() - (p_dias || ' days')::interval
      and (p_mesa_ids is null or t.mesa_id = any(p_mesa_ids))
      and (public.is_jefe_admin() or public.puede_ver_ticket(t.id))
    group by t.categoria_id
  ),
  previo as (
    select t.categoria_id, count(*)::bigint as cnt
    from public.tickets t
    where t.creado_en >= now() - (p_dias*2 || ' days')::interval
      and t.creado_en < now() - (p_dias || ' days')::interval
      and (p_mesa_ids is null or t.mesa_id = any(p_mesa_ids))
      and (public.is_jefe_admin() or public.puede_ver_ticket(t.id))
    group by t.categoria_id
  ),
  total_actual as (
    select coalesce(sum(cnt),0)::numeric as tot from actual
  )
  select
    coalesce(a.categoria_id, p.categoria_id) as categoria_id,
    c.subcategoria,
    c.dominio,
    coalesce(a.cnt,0) as cnt_actual,
    coalesce(p.cnt,0) as cnt_previo,
    case when coalesce(p.cnt,0)=0 then
      case when coalesce(a.cnt,0)>0 then 100 else 0 end
      else round((coalesce(a.cnt,0) - p.cnt)::numeric / p.cnt * 100, 1)
    end as variacion_pct,
    case when (select tot from total_actual)=0 then 0
      else round(coalesce(a.cnt,0)::numeric / (select tot from total_actual) * 100, 1)
    end as share_pct,
    case
      when coalesce(a.cnt,0) = 0 then 'sin_demanda'
      when coalesce(p.cnt,0)=0 and coalesce(a.cnt,0) >= 5 then 'nueva_alta'
      when coalesce(p.cnt,0) > 0 and (coalesce(a.cnt,0)::numeric / p.cnt) >= 1.5 then 'al_alza'
      when coalesce(p.cnt,0) > 0 and (coalesce(a.cnt,0)::numeric / p.cnt) <= 0.6 then 'a_la_baja'
      else 'estable'
    end as tendencia
  from actual a
  full join previo p on p.categoria_id = a.categoria_id
  join public.ticket_categories c on c.id = coalesce(a.categoria_id, p.categoria_id)
  order by coalesce(a.cnt,0) desc
  limit 30;
$$;

grant execute on function public.dashboard_patrones_categoria(int,int[]) to authenticated;

comment on function public.dashboard_picos_prediccion is 'RF-19: picos por hora/dow/mesa con forecast estacional';
comment on function public.dashboard_patrones_categoria is 'RF-20: patrones por categoria normalizada (variacion vs periodo previo)';
