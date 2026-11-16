-- La asignación se decide en la base de datos para que ningún cliente pueda
-- elegir un técnico ni omitir las reglas de carga y SLA.
drop table if exists public.tecnico_afinidades;

create or replace function public.trg_validar_asignacion_inicial()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tecnico_asignado_id is not null then
    raise exception 'La asignación inicial del técnico es automática'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists tickets_validar_asignacion_inicial on public.tickets;
create trigger tickets_validar_asignacion_inicial
before insert on public.tickets
for each row execute function public.trg_validar_asignacion_inicial();

create or replace function public.trg_autoasignar_ticket_nuevo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tecnico uuid;
begin
  if new.estado <> 'abierto' or new.mesa_id is null then
    return new;
  end if;

  -- Serializa asignaciones de la misma mesa para reducir empates por carrera.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.mesa_id::text, 71001)
  );

  select p.id
  into v_tecnico
  from public.profiles p
  left join lateral (
    select sum(
      case t.prioridad
        when 'critica' then 4
        when 'alta' then 3
        when 'media' then 2
        else 1
      end
      + case
          when t.sla_vence_en <= pg_catalog.now() + pg_catalog.make_interval(
            mins => least(
              60,
              coalesce(sc.minutos, case t.prioridad
                when 'critica' then 60
                when 'alta' then 240
                when 'media' then 1440
                else 4320
              end) / 4
            )
          )
          then 2
          else 0
        end
    ) as carga
    from public.tickets t
    left join public.sla_config sc on sc.prioridad = t.prioridad
    where t.tecnico_asignado_id = p.id
      and t.estado not in ('solucionado', 'cerrado')
  ) carga on true
  where p.rol = 'tecnico'
    and p.activo
    and p.mesa_id = new.mesa_id
  order by coalesce(carga.carga, 0), p.id
  limit 1;

  if v_tecnico is not null then
    update public.tickets
    set tecnico_asignado_id = v_tecnico
    where id = new.id and tecnico_asignado_id is null;
  end if;
  return new;
end;
$$;

revoke all on function public.trg_autoasignar_ticket_nuevo() from public, anon, authenticated;
revoke all on function public.trg_validar_asignacion_inicial() from public, anon, authenticated;

drop trigger if exists tickets_autoasignar_ticket_nuevo on public.tickets;
create trigger tickets_autoasignar_ticket_nuevo
after insert on public.tickets
for each row execute function public.trg_autoasignar_ticket_nuevo();

-- Los tickets recién creados siempre entran sin técnico desde el cliente.
drop policy if exists "tickets_insert_empleado" on public.tickets;
drop policy if exists tickets_insert_owner on public.tickets;
create policy tickets_insert_owner on public.tickets
  for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and tecnico_asignado_id is null
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.activo
        and p.rol <> 'administrador'
    )
  );

-- La exposición de tablas vía Data API no se concede automáticamente.
-- Estos grants habilitan operaciones que siguen restringidas por las políticas RLS.
grant select, insert, update on public.tickets to authenticated;
grant usage, select on sequence public.tickets_numero_seq to authenticated;
grant select on public.profiles to authenticated;

-- La policy de actualización de tickets invoca este predicado desde RLS.
-- Mantiene las referencias cualificadas y permite su evaluación a usuarios autenticados.
create or replace function public.ticket_inmutables_ok(
  p_id uuid,
  p_usuario_id uuid,
  p_numero int,
  p_categoria_id int,
  p_prioridad public.prioridad_ticket,
  p_asunto text,
  p_descripcion text,
  p_creado_en timestamptz
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tickets t
    where t.id = p_id
      and t.usuario_id = p_usuario_id
      and t.numero = p_numero
      and t.categoria_id = p_categoria_id
      and t.prioridad = p_prioridad
      and t.asunto = p_asunto
      and t.descripcion = p_descripcion
      and t.creado_en = p_creado_en
  );
$$;
revoke all on function public.ticket_inmutables_ok(uuid, uuid, int, int, public.prioridad_ticket, text, text, timestamptz) from public, anon;
grant execute on function public.ticket_inmutables_ok(uuid, uuid, int, int, public.prioridad_ticket, text, text, timestamptz) to authenticated;

-- El trigger de feedback crea una fila técnica con cada ticket; ejecutarlo
-- como invoker exigiría permisos de cliente sobre la tabla interna de feedback.
create or replace function public.crear_ticket_ia_feedback_pendiente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ticket_ia_feedback (ticket_id)
  values (new.id)
  on conflict (ticket_id) do nothing;
  return new;
end;
$$;
revoke all on function public.crear_ticket_ia_feedback_pendiente() from public, anon, authenticated;

-- La función solo expone la duración calculada, no el contenido de sla_config.
-- Definer evita conceder lectura directa de esa tabla a los clientes.
create or replace function public.sla_interval(p_prioridad public.prioridad_ticket)
returns interval
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.make_interval(
    mins => coalesce(
      (select sc.minutos from public.sla_config sc where sc.prioridad = p_prioridad),
      case p_prioridad
        when 'critica' then 60
        when 'alta' then 240
        when 'media' then 1440
        when 'baja' then 4320
        else 1440
      end
    )
  );
$$;
revoke all on function public.sla_interval(public.prioridad_ticket) from public, anon;
grant execute on function public.sla_interval(public.prioridad_ticket) to authenticated, service_role;
