-- Fija search_path mutable en funciones (fix advisors WARN search_path)
create or replace function public.puede_ver_ticket(ticket_id uuid)
 returns boolean
 language sql stable
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.tickets t
    where t.id = ticket_id
      and (
        t.usuario_id = auth.uid()
        or t.tecnico_asignado_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.activo and p.rol in ('jefe', 'administrador')
        )
      )
  );
$function$;

create or replace function public.ticket_cambio_trigger()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  -- Cambio de estado -> historial con estado_anterior/nuevo
  if new.estado is distinct from old.estado then
    insert into public.ticket_estados (ticket_id, tipo_evento, estado_anterior, estado_nuevo, usuario_id, comentario)
    values (new.id, 'estado', old.estado, new.estado, auth.uid(), null);
  end if;

  -- Cambio de responsable -> historial con tecnico_de/para (E9)
  if new.tecnico_asignado_id is distinct from old.tecnico_asignado_id then
    insert into public.ticket_estados (ticket_id, tipo_evento, tecnico_de, tecnico_para, usuario_id, comentario)
    values (new.id, 'asignacion', old.tecnico_asignado_id, new.tecnico_asignado_id, auth.uid(), null);
  end if;

  -- Capturar fecha de resolución al pasar a solucionado/cerrado (RF-11)
  if new.estado in ('solucionado', 'cerrado') and new.fecha_resolucion is null then
    new.fecha_resolucion := now();
  end if;

  new.actualizado_en := now();
  return new;
end;
$function$;
