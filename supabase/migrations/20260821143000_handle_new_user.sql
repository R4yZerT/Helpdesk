-- RF-04 + RF-27 — Autocreacion de profile al registrar usuario
-- Crea public.profiles a partir de auth.users; rol por defecto empleado (se exige RLS y anon key expone).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nombre, rol, activo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'rol')::rol_usuario, 'empleado'::rol_usuario),
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
