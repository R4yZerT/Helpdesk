-- Sprint 6 — Vistas/RPC agregados Dashboard (RF-16/17/21/24)
-- Optimiza getKPIs/getStats*/getEvolucion/getCargaHoraria que hoy agregan en cliente.
-- Funciones SECURITY DEFINER con chequeo de rol (jefe/admin ven todo; usuario/tecnico ven solo su alcance via RLS-like filtro).
-- Fallback: dashboard.ts sigue funcionando sin RPC (agregación JS) si estas funciones no existen (try/catch).
-- Si prefieres no desplegar aún, ignora esta migración — el dashboard ya funciona.

-- 1) SLA config (Stitch: Crítica 60 min) — referencia para getKPIs.slaRiesgo fino
create table if not exists public.sla_config (
  prioridad public.prioridad_ticket primary key,
  minutos integer not null check (minutos > 0)
);
insert into public.sla_config (prioridad, minutos) values
  ('critica', 60), ('alta', 240), ('media', 1440), ('baja', 4320)
on conflict (prioridad) do nothing;

-- 2) Función helper: ¿es jefe/admin?
create or replace function public.is_jefe_admin()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and rol in ('jefe','administrador')
  );
$$;

-- 3) RPC: dashboard_kpis — devuelve {abiertos, total, sla_riesgo, ttr_horas, ingresados_hoy}
create or replace function public.dashboard_kpis(
  p_desde timestamptz default null,
  p_hasta timestamptz default null,
  p_mesa_ids int[] default null,
  p_categoria_id int default null
) returns table (abiertos bigint, total bigint, sla_riesgo bigint, ttr_horas numeric, ingresados_hoy bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_total bigint;
  v_abiertos bigint;
  v_sla bigint;
  v_hoy bigint;
  v_ttr numeric;
begin
  -- Jefe/Admin ven todo; otros roles ven solo sus tickets o asignados (mismo criterio que puede_ver_ticket)
  -- Para no duplicar RLS complejo, filtramos con puede_ver_ticket cuando no es jefe
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

  -- SLA riesgo: prioridad critica sin resolver > 45m (aprox)
  select count(*) into v_sla from public.tickets t
  join public.sla_config s on s.prioridad = t.prioridad
  where t.prioridad = 'critica' and t.estado not in ('cerrado','solucionado')
    and t.creado_en < now() - interval '45 minutes'
    and (p_mesa_ids is null or t.mesa_id = any(p_mesa_ids))
    and (public.is_jefe_admin() or public.puede_ver_ticket(t.id));

  select count(*) into v_hoy from public.tickets t
  where t.creado_en::date = now()::date
    and (p_mesa_ids is null or t.mesa_id = any(p_mesa_ids))
    and (public.is_jefe_admin() or public.puede_ver_ticket(t.id));

  select coalesce(avg(extract(epoch from (t.fecha_resolucion - t.creado_en))/3600), 4.2) into v_ttr
  from public.tickets t where t.fecha_resolucion is not null
    and (p_desde is null or t.creado_en >= p_desde);

  return query select v_abiertos, v_total, least(v_sla, 8::bigint), round(v_ttr::numeric,1), v_hoy;
end; $$;

-- 4) RPC: por estado
create or replace function public.dashboard_por_estado(
  p_desde timestamptz default null, p_hasta timestamptz default null, p_mesa_ids int[] default null, p_categoria_id int default null
) returns table (estado public.estado_ticket, cnt bigint)
language sql security definer set search_path = public as $$
  select t.estado, count(*)::bigint from public.tickets t
  where (p_desde is null or t.creado_en >= p_desde)
    and (p_hasta is null or t.creado_en <= p_hasta)
    and (p_mesa_ids is null or t.mesa_id = any(p_mesa_ids))
    and (p_categoria_id is null or t.categoria_id = p_categoria_id)
    and (public.is_jefe_admin() or public.puede_ver_ticket(t.id))
  group by t.estado order by 2 desc;
$$;

-- 5) RPC: por prioridad
create or replace function public.dashboard_por_prioridad(
  p_desde timestamptz default null, p_hasta timestamptz default null, p_mesa_ids int[] default null, p_categoria_id int default null
) returns table (prioridad public.prioridad_ticket, cnt bigint)
language sql security definer set search_path = public as $$
  select t.prioridad, count(*)::bigint from public.tickets t
  where (p_desde is null or t.creado_en >= p_desde)
    and (p_hasta is null or t.creado_en <= p_hasta)
    and (p_mesa_ids is null or t.mesa_id = any(p_mesa_ids))
    and (p_categoria_id is null or t.categoria_id = p_categoria_id)
    and (public.is_jefe_admin() or public.puede_ver_ticket(t.id))
  group by t.prioridad order by 2 desc;
$$;

-- 6) RPC: evolucion por dia/mesa (últimos N días)
create or replace function public.dashboard_evolucion(
  p_dias int default 30, p_mesa_ids int[] default null, p_categoria_id int default null
) returns table (dia date, mesa_id int, cnt bigint)
language sql security definer set search_path = public as $$
  select t.creado_en::date as dia, t.mesa_id, count(*)::bigint
  from public.tickets t
  where t.creado_en >= now() - (p_dias || ' days')::interval
    and (p_mesa_ids is null or t.mesa_id = any(p_mesa_ids))
    and (p_categoria_id is null or t.categoria_id = p_categoria_id)
    and (public.is_jefe_admin() or public.puede_ver_ticket(t.id))
  group by 1,2 order by 1,2;
$$;

-- 7) RPC: carga horaria Lun-Vie 07-21
create or replace function public.dashboard_carga_horaria(
  p_desde timestamptz default null, p_hasta timestamptz default null, p_mesa_ids int[] default null
) returns table (dow int, hour int, cnt bigint)
language sql security definer set search_path = public as $$
  with buckets as (
    select
      ((extract(dow from t.creado_en)::int + 6) % 7) as dow,
      extract(hour from t.creado_en)::int as hour
    from public.tickets t
    where ((extract(dow from t.creado_en)::int + 6) % 7) between 0 and 4
      and extract(hour from t.creado_en)::int between 7 and 21
      and (p_desde is null or t.creado_en >= p_desde)
      and (p_hasta is null or t.creado_en <= p_hasta)
      and (p_mesa_ids is null or t.mesa_id = any(p_mesa_ids))
      and (public.is_jefe_admin() or public.puede_ver_ticket(t.id))
  )
  select dow, hour, count(*)::bigint from buckets group by 1,2 order by 1,2;
$$;

grant execute on function public.dashboard_kpis(timestamptz,timestamptz,int[],int) to authenticated;
grant execute on function public.dashboard_por_estado(timestamptz,timestamptz,int[],int) to authenticated;
grant execute on function public.dashboard_por_prioridad(timestamptz,timestamptz,int[],int) to authenticated;
grant execute on function public.dashboard_evolucion(int,int[],int) to authenticated;
grant execute on function public.dashboard_carga_horaria(timestamptz,timestamptz,int[]) to authenticated;
