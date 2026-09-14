-- Auto-asignación con confirmación humana + afinidades de técnico
-- 1) Elimina el modelo de mesas de respaldo (RF-31 revertido)
-- 2) Crea public.tecnico_afinidades: peso 1-3 por par (técnico, categoría)

drop table if exists public.mesa_respaldos;

create table if not exists public.tecnico_afinidades (
  tecnico_id    uuid not null references public.profiles (id) on delete cascade,
  categoria_id  int  not null references public.ticket_categories (id) on delete cascade,
  peso          smallint not null default 1,
  creado_en     timestamptz not null default now(),
  primary key (tecnico_id, categoria_id),
  check (peso between 1 and 3)
);

alter table public.tecnico_afinidades enable row level security;

-- Lectura: cualquier usuario autenticado (para sugerencia de asignación en creación)
drop policy if exists tecnico_afinidades_read on public.tecnico_afinidades;
create policy tecnico_afinidades_read on public.tecnico_afinidades
  for select to authenticated using (true);

-- Escritura: solo administradores (rol leído de profiles sin recursión)
drop policy if exists tecnico_afinidades_write on public.tecnico_afinidades;
create policy tecnico_afinidades_write on public.tecnico_afinidades
  for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'administrador')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'administrador')
  );

create index if not exists idx_tecnico_afinidades_tecnico on public.tecnico_afinidades (tecnico_id);
create index if not exists idx_tecnico_afinidades_categoria on public.tecnico_afinidades (categoria_id);
