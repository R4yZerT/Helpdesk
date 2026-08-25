-- RF-15 — Comentarios internos: solo tecnico/jefe/admin ven y crean interno=true
-- A+A: empleado solo ve publicos; tecnico/jefe/admin ven todos

-- Reemplaza politica select laxa por dos capas
drop policy if exists "ticket_comentarios_select" on public.ticket_comentarios;

-- Publicos: cualquier actor con acceso al ticket ve interno=false
create policy "ticket_comentarios_select_public" on public.ticket_comentarios
  for select to authenticated
  using (interno = false and public.puede_ver_ticket(ticket_id));

-- Internos: solo tecnico/jefe/administrador con acceso al ticket
create policy "ticket_comentarios_select_interno" on public.ticket_comentarios
  for select to authenticated
  using (
    interno = true
    and public.puede_ver_ticket(ticket_id)
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.activo and p.rol in ('tecnico','jefe','administrador')
    )
  );

-- Insert: restringe interno=true a roles privilegiados
drop policy if exists "ticket_comentarios_insert" on public.ticket_comentarios;

create policy "ticket_comentarios_insert" on public.ticket_comentarios
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and public.puede_ver_ticket(ticket_id)
    and (
      interno = false
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.activo and p.rol in ('tecnico','jefe','administrador')
      )
    )
  );
