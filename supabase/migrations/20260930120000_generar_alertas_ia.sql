-- Generador de alertas IA RF-21: pico_inusual + ticket_estancado (2 días)
-- Idempotente: no duplica alerta misma mesa/ticket dentro de ventana
-- SECURITY DEFINER para que cron (postgres) y service_role puedan insertar

-- 1) RLS: permitir a jefe/admin marcar alertas como vista/resuelta
do $$ begin
  if not exists (select 1 from pg_policies where policyname='alertas_ia_update_jefe_admin' and tablename='alertas_ia') then
    create policy "alertas_ia_update_jefe_admin" on public.alertas_ia
      for update to authenticated
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.activo and p.rol in ('jefe','administrador')))
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.activo and p.rol in ('jefe','administrador')));
  end if;
end $$;

-- 2) Índice para dedup rápido
create index if not exists idx_alertas_tipo_mesa_ticket_creado on public.alertas_ia (tipo, mesa_id, ticket_id, creado_en);

-- 3) Función generadora
create or replace function public.generar_alertas_ia()
returns table (insertados bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estancados bigint := 0;
  v_picos bigint := 0;
  v_sla bigint := 0;
begin
  -- A) Tickets estancados > 2 días sin movimiento (abierto/en_proceso/devuelto)
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
          and a.ticket_id = t.id
          and a.estado = 'nueva'
          and a.creado_en > now() - interval '2 days'
      )
  )
  insert into public.alertas_ia (tipo, ticket_id, mesa_id, mensaje, severidad, estado)
  select
    'ticket_estancado'::public.tipo_alerta_ia,
    cand.id,
    cand.mesa_id,
    format('Ticket #%s estancado %s días en %s — %s · %s',
      cand.numero,
      extract(day from now() - cand.actualizado_en)::int,
      cand.estado,
      cand.subcategoria,
      coalesce(cand.mesa_nombre,'Sin mesa')
    ),
    case cand.prioridad
      when 'critica' then 'critica'
      when 'alta' then 'alta'
      when 'media' then 'media'
      else 'baja'
    end,
    'nueva'
  from candidatos cand;
  GET DIAGNOSTICS v_estancados = ROW_COUNT;

  -- B) Picos inusuales por mesa: volumen 24h > 1.5× promedio diario 7d y >=5
  with stats_24h as (
    select t.mesa_id, count(*)::numeric as cnt_24h
    from public.tickets t
    where t.creado_en > now() - interval '24 hours'
    group by t.mesa_id
  ),
  stats_7d as (
    select t.mesa_id, count(*)::numeric / 7.0 as avg_dia
    from public.tickets t
    where t.creado_en >= now() - interval '7 days'
      and t.creado_en < now() - interval '1 hour'
    group by t.mesa_id
  ),
  picos as (
    select
      s24.mesa_id,
      s24.cnt_24h,
      coalesce(s7.avg_dia, 0) as avg_dia,
      case when coalesce(s7.avg_dia,0) > 0 then s24.cnt_24h / s7.avg_dia else 999 end as ratio,
      m.nombre as mesa_nombre
    from stats_24h s24
    left join stats_7d s7 on s7.mesa_id is not distinct from s24.mesa_id
    left join public.mesas m on m.id = s24.mesa_id
    where s24.cnt_24h >= 5
      and (
        (coalesce(s7.avg_dia,0) = 0 and s24.cnt_24h >= 8)
        or s24.cnt_24h > coalesce(s7.avg_dia,0) * 1.5
      )
      and not exists (
        select 1 from public.alertas_ia a
        where a.tipo = 'pico_inusual'::public.tipo_alerta_ia
          and coalesce(a.mesa_id, -1) = coalesce(s24.mesa_id, -1)
          and a.estado = 'nueva'
          and a.creado_en > now() - interval '24 hours'
      )
  )
  insert into public.alertas_ia (tipo, mesa_id, mensaje, severidad, estado)
  select
    'pico_inusual'::public.tipo_alerta_ia,
    p.mesa_id,
    format('Pico inusual en %s: %s tickets en 24h (promedio 7d: %s, +%s%%)',
      coalesce(p.mesa_nombre,'General'),
      p.cnt_24h::int,
      round(p.avg_dia,1),
      round((p.ratio - 1)*100)
    ),
    case when p.ratio >= 2.5 then 'critica' when p.ratio >= 2.0 then 'alta' when p.ratio >= 1.5 then 'media' else 'baja' end,
    'nueva'
  from picos p;
  GET DIAGNOSTICS v_picos = ROW_COUNT;

  -- C) SLA vencidos (sincronizado con 20260911000000)
  with vencidos as (
    select t.id, t.numero, t.mesa_id, t.prioridad, m.nombre as mesa_nombre, c.subcategoria, t.sla_vence_en
    from public.tickets t
    left join public.mesas m on m.id=t.mesa_id
    left join public.ticket_categories c on c.id=t.categoria_id
    where t.estado not in ('cerrado','solucionado')
      and now() > coalesce(t.sla_vence_en, t.creado_en + public.sla_interval(t.prioridad))
      and not exists (select 1 from public.alertas_ia a where a.tipo='ticket_estancado'::public.tipo_alerta_ia and a.ticket_id=t.id and a.mensaje like '%SLA vencido%' and a.creado_en > now()-interval '12 hours')
  )
  insert into public.alertas_ia (tipo, ticket_id, mesa_id, mensaje, severidad, estado)
  select 'ticket_estancado'::public.tipo_alerta_ia, v.id, v.mesa_id, format('SLA vencido — Ticket #%s (%s) en %s · vence %s', v.numero, v.subcategoria, coalesce(v.mesa_nombre,'Sin mesa'), to_char(v.sla_vence_en,'YYYY-MM-DD HH24:MI')), case v.prioridad when 'critica' then 'critica' when 'alta' then 'alta' else 'media' end, 'nueva' from vencidos v;
  GET DIAGNOSTICS v_sla = ROW_COUNT;

  return query select (v_estancados + v_picos + v_sla)::bigint;
end;
$$;

grant execute on function public.generar_alertas_ia() to authenticated;
grant execute on function public.generar_alertas_ia() to service_role;

-- 4) pg_cron: cada hora (si extensión disponible)
do $$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('generar_alertas_ia_cada_hora', '0 * * * *', $cron$select public.generar_alertas_ia()$cron$);
  end if;
exception when others then null;
end $$;
