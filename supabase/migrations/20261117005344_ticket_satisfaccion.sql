create table public.ticket_satisfacciones (
  ticket_id uuid primary key references public.tickets (id) on delete cascade,
  usuario_id uuid not null references public.profiles (id) default auth.uid(),
  calificacion smallint not null check (calificacion between 1 and 5),
  comentario text check (comentario is null or length(btrim(comentario)) between 1 and 1000),
  creado_en timestamptz not null default now()
);

alter table public.ticket_satisfacciones enable row level security;

revoke all on table public.ticket_satisfacciones from public, anon, authenticated;
grant select, insert on table public.ticket_satisfacciones to authenticated;

create policy "ticket_satisfacciones_select_own"
  on public.ticket_satisfacciones
  for select
  to authenticated
  using (
    usuario_id = (select auth.uid())
    and exists (
      select 1
      from public.tickets t
      where t.id = ticket_satisfacciones.ticket_id
        and t.usuario_id = (select auth.uid())
    )
  );

create policy "ticket_satisfacciones_insert_closed_owner"
  on public.ticket_satisfacciones
  for insert
  to authenticated
  with check (
    usuario_id = (select auth.uid())
    and exists (
      select 1
      from public.tickets t
      where t.id = ticket_satisfacciones.ticket_id
        and t.usuario_id = (select auth.uid())
        and t.estado = 'cerrado'
    )
  );
