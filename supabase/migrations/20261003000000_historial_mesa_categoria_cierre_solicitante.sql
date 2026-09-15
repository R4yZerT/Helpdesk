-- Historial completo + cierre por solicitante
-- 1. El solicitante puede confirmar cierre o devolver cuando el ticket está solucionado
-- 2. El historial registra cambios de dependencia (mesa) y categoría con actor y hora
-- Nota: se reutiliza tipo_evento='asignacion' con columnas dedicadas (evita ALTER TYPE,
-- prohibido dentro de bloque transaccional). La UI distingue por mesa_*/categoria_*.

-- 1. RLS: el dueño confirma cierre/devuelve desde solucionado (RF-11)
drop policy if exists "tickets_update_solicitante_cierre" on public.tickets;
create policy "tickets_update_solicitante_cierre" on public.tickets
  for update to authenticated
  using (usuario_id = auth.uid() and estado = 'solucionado')
  with check (usuario_id = auth.uid() and estado in ('cerrado', 'devuelto'));

-- 2a. Columnas para detalle de dependencia/categoría
alter table public.ticket_estados
  add column if not exists mesa_de int references public.mesas (id) on delete set null,
  add column if not exists mesa_para int references public.mesas (id) on delete set null,
  add column if not exists categoria_de int references public.ticket_categories (id) on delete set null,
  add column if not exists categoria_para int references public.ticket_categories (id) on delete set null;

-- 2b. Trigger: registra mesa/categoría además de estado y técnico
create or replace function public.ticket_cambio_trigger()
returns trigger
language plpgsql
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

  -- Capturar fecha de resolución al pasar a solucionado/cerrado (RF-11)
  if new.estado in ('solucionado', 'cerrado') and new.fecha_resolucion is null then
    new.fecha_resolucion := now();
  end if;

  new.actualizado_en := now();
  return new;
end;
$$;
