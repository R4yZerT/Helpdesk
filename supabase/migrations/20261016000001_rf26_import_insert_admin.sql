-- RF-26/A5: la importación de histórico inserta tickets reales desde AdminImportScreen.
-- La policy tickets_insert_empleado excluye al administrador ("admin no gestiona tickets"),
-- así que el insert del admin era rechazado por RLS (fail-closed sin vía legítima).
-- Decisión handoff: insert directo + policy de mínimo privilegio solo para administrador
-- activo (la pantalla ya exige profile:manage vía RequirePermission). El trigger
-- trg_tickets_set_usuario rellena usuario_id = auth.uid() si el cliente lo omite.
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'tickets_insert_admin_import' and tablename = 'tickets') then
    create policy "tickets_insert_admin_import" on public.tickets
      for insert to authenticated
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.activo and p.rol = 'administrador'
        )
      );
  end if;
end $$;
