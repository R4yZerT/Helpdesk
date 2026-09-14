-- RF-31 — Mesas de respaldo: una mesa puede apoyarse en otras mesas
-- Relación N:M dirigida: mesa_id -> respaldo_mesa_id
create table if not exists public.mesa_respaldos (
  mesa_id           int not null references public.mesas (id) on delete cascade,
  respaldo_mesa_id  int not null references public.mesas (id) on delete cascade,
  creado_en         timestamptz not null default now(),
  primary key (mesa_id, respaldo_mesa_id),
  check (mesa_id <> respaldo_mesa_id)
);

alter table public.mesa_respaldos enable row level security;

-- Lectura: cualquier usuario autenticado (para enrutamiento y vistas)
drop policy if exists mesa_respaldos_read on public.mesa_respaldos;
create policy mesa_respaldos_read on public.mesa_respaldos
  for select to authenticated using (true);

-- Escritura: solo administradores (rol leído de profiles sin recursión)
drop policy if exists mesa_respaldos_write on public.mesa_respaldos;
create policy mesa_respaldos_write on public.mesa_respaldos
  for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'administrador')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'administrador')
  );

create index if not exists idx_mesa_respaldos_mesa on public.mesa_respaldos (mesa_id);
create index if not exists idx_mesa_respaldos_respaldo on public.mesa_respaldos (respaldo_mesa_id);
