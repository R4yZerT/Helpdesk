-- QA-C4 — tickets_update_tecnico: WITH CHECK (true) permitía al técnico mutar
-- usuario_id, numero, categoria_id, prioridad, asunto, descripcion y creado_en.
-- Ahora esas columnas quedan fijadas a sus valores previos (inmutables para el técnico).
-- Siguen mutables: estado, solucion_aplicada (FSM RF-13), tecnico_asignado_id y
-- mesa_id (reasignación RF-14), más las gestionadas por triggers (fecha_resolucion,
-- sla_vence_en, actualizado_en). La subconsulta ve la foto previa al UPDATE
-- (snapshot del comando), por lo que comparar contra ella fija los valores viejos.

drop policy if exists "tickets_update_tecnico" on public.tickets;

create policy "tickets_update_tecnico" on public.tickets
  for update to authenticated
  using (
    tecnico_asignado_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.activo and p.rol = 'tecnico')
  )
  with check (
    usuario_id = (select t.usuario_id from public.tickets t where t.id = tickets.id)
    and numero = (select t.numero from public.tickets t where t.id = tickets.id)
    and categoria_id = (select t.categoria_id from public.tickets t where t.id = tickets.id)
    and prioridad = (select t.prioridad from public.tickets t where t.id = tickets.id)
    and asunto = (select t.asunto from public.tickets t where t.id = tickets.id)
    and descripcion = (select t.descripcion from public.tickets t where t.id = tickets.id)
    and creado_en = (select t.creado_en from public.tickets t where t.id = tickets.id)
  );
