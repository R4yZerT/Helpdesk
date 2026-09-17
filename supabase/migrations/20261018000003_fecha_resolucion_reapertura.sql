-- QA-H5 — fecha_resolucion stale al reabrir (RF-11/SLA).
-- El trigger solo fijaba fecha_resolucion cuando era null: el ciclo
-- solucionado→devuelto→cerrado reutilizaba la fecha vieja y el SLA quedaba
-- "cumplido" en falso. Ahora: al salir de un estado resuelto hacia uno no
-- resuelto se limpia; al entrar a solucionado/cerrado se fija si es null
-- (se conserva la primera resolución en solucionado→cerrado, que es lo que
-- mide el SLA). De paso fija search_path (reabre QA-A13/H-13: la redefinición
-- 20261003000000 lo había perdido).

create or replace function public.ticket_cambio_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  -- Cambio de dependencia -> historial con mesa_de/para y quién lo hizo
  if new.mesa_id is distinct from old.mesa_id then
    insert into public.ticket_estados (ticket_id, tipo_evento, mesa_de, mesa_para, usuario_id, comentario)
    values (new.id, 'asignacion', old.mesa_id, new.mesa_id, auth.uid(), null);
  end if;

  -- Cambio de categoría -> historial con categoria_de/para y quién lo hizo
  if new.categoria_id is distinct from old.categoria_id then
    insert into public.ticket_estados (ticket_id, tipo_evento, categoria_de, categoria_para, usuario_id, comentario)
    values (new.id, 'asignacion', old.categoria_id, new.categoria_id, auth.uid(), null);
  end if;

  -- Fecha de resolución (RF-11): fijar al resolver, limpiar al reabrir
  if new.estado in ('solucionado', 'cerrado') then
    if new.fecha_resolucion is null then
      new.fecha_resolucion := now();
    end if;
  elsif old.estado in ('solucionado', 'cerrado') then
    -- Reapertura (p. ej. solucionado→devuelto): la fecha vieja ya no vale
    new.fecha_resolucion := null;
  end if;

  new.actualizado_en := now();
  return new;
end;
$$;
