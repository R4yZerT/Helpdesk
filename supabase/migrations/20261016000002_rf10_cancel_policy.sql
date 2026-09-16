-- RF-10/B1: el dueño puede cancelar su solicitud (abierto -> cerrado) mientras siga
-- sin técnico asignado. La policy tickets_update_empleado exige estado='abierto' en el
-- WITH CHECK, así que el UPDATE de cancelación (estado nuevo 'cerrado') era rechazado
-- por RLS aunque el trigger ticket_fsm_check (RF-13) sí permite abierto -> cerrado sin
-- técnico (excepción RF-10) y la UI (cancelTicket) lo ofrece. Sin esta policy permisiva
-- adicional, el botón "cancelar" fallaba con 42501.
-- Mínimo privilegio: USING y WITH CHECK exigen dueño + abierto/cerrado + sin técnico.
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'tickets_update_empleado_cancelar' and tablename = 'tickets') then
    create policy "tickets_update_empleado_cancelar" on public.tickets
      for update to authenticated
      using (usuario_id = auth.uid() and estado = 'abierto' and tecnico_asignado_id is null)
      with check (usuario_id = auth.uid() and estado = 'cerrado' and tecnico_asignado_id is null);
  end if;
end $$;
