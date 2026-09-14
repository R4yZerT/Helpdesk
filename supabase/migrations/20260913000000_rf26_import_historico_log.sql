-- RF-26: log de importaciones de histórico (latin-1→UTF-8 NFD) para auditoría de datos de entrenamiento
create table if not exists public.import_historico_log (
  id uuid primary key default gen_random_uuid(),
  archivo text not null,
  filas_raw int not null,
  filas_clean int not null,
  filas_cuarentena int not null,
  clases int not null,
  iniciado_por uuid references auth.users(id),
  creado_en timestamptz not null default now()
);
alter table public.import_historico_log enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname='import_log_select_admin' and tablename='import_historico_log') then
    create policy import_log_select_admin on public.import_historico_log for select using (public.is_jefe_admin());
  end if;
  if not exists (select 1 from pg_policies where policyname='import_log_insert_admin' and tablename='import_historico_log') then
    create policy import_log_insert_admin on public.import_historico_log for insert with check (public.is_jefe_admin());
  end if;
end $$;
