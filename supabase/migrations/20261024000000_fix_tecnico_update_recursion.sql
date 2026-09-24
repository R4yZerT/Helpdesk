-- Fix recursión infinita en tickets_update_tecnico (Sprint 3).
-- El WITH CHECK comparaba NEW contra subconsultas a la misma tabla tickets;
-- evaluar RLS de tickets dentro de RLS de tickets aborta con
-- "infinite recursion detected in policy" y ningún técnico puede actualizar.
-- Patrón ya usado en el repo (is_admin): helper SECURITY DEFINER que lee la
-- fila previa saltándose RLS; el CHECK solo compara booleanos.
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
set search_path = public
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

revoke execute on function public.ticket_inmutables_ok(uuid, uuid, int, int, public.prioridad_ticket, text, text, timestamptz)
  from anon, public;

drop policy if exists "tickets_update_tecnico" on public.tickets;

create policy "tickets_update_tecnico" on public.tickets
  for update to authenticated
  using (
    tecnico_asignado_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.activo and p.rol = 'tecnico')
  )
  with check (
    public.ticket_inmutables_ok(
      tickets.id, usuario_id, numero, categoria_id, prioridad, asunto, descripcion, creado_en
    )
  );
