-- RF-27 enriquece profiles con cedula (login alternativo) y email espejo
alter table public.profiles add column if not exists cedula text;
alter table public.profiles add column if not exists email text;

-- Cedula: solo digitos 5-15, unica cuando se informa (Colombia 6-10 tipica + margen)
-- Email espejo: lower, unico cuando se informa (para resolver login por cedula y mostrar en admin)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_cedula_chk') then
    alter table public.profiles add constraint profiles_cedula_chk check (cedula is null or cedula ~ '^[0-9]{5,15}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_email_chk') then
    alter table public.profiles add constraint profiles_email_chk check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
  end if;
end $$;

create unique index if not exists profiles_cedula_key on public.profiles (cedula) where cedula is not null;
create unique index if not exists profiles_email_key on public.profiles (email) where email is not null;
create index if not exists profiles_cedula_idx on public.profiles (cedula);
create index if not exists profiles_email_idx on public.profiles (email);

-- Actualiza trigger handle_new_user para poblar email/cedula desde raw_user_meta_data
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, rol, activo, email, cedula)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'rol')::rol_usuario, 'usuario'::rol_usuario),
    true,
    lower(new.email),
    nullif(new.raw_user_meta_data->>'cedula', '')
  )
  on conflict (id) do update set
    email = excluded.email,
    cedula = coalesce(excluded.cedula, public.profiles.cedula),
    full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill email desde auth.users donde falte (one-off)
do $$ declare r record; begin
  for r in select u.id, lower(u.email) as em from auth.users u join public.profiles p on p.id=u.id where p.email is null and u.email is not null loop
    update public.profiles set email = r.em where id = r.id;
  end loop;
end $$;
