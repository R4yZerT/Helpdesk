-- La asignación del técnico es automática al insertar (20261113153902), así que
-- exigir `tecnico_asignado_id is null` dejaba al solicitante sin poder cancelar:
-- el ticket ya tenía técnico desde el primer segundo. La cancelación solo puede
-- cambiar el estado a 'cerrado' y no puede tocar los campos inmutables.
drop policy if exists tickets_update_solicitante_cancelar on public.tickets;
create policy tickets_update_solicitante_cancelar on public.tickets
  for update to authenticated
  using (
    usuario_id = (select auth.uid())
    and estado = 'abierto'
  )
  with check (
    usuario_id = (select auth.uid())
    and estado = 'cerrado'
    and ticket_inmutables_ok(id, usuario_id, numero, categoria_id, prioridad, asunto, descripcion, creado_en)
  );

-- Política redundante: cubría solo tickets sin técnico y con la asignación
-- automática nunca aplicaba. La política anterior cubre a cualquier solicitante.
drop policy if exists tickets_update_empleado_cancelar on public.tickets;
