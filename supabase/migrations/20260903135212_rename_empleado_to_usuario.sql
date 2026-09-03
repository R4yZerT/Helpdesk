-- Rename rol empleado -> usuario (ya aplicado en remote via apply_migration)
-- Este archivo sincroniza el repo local con el historial remoto.
-- Si el valor ya es usuario, no hace nada (idempotente).

do $$
begin
  -- Renombrar valor del enum si aún existe como 'empleado'
  if exists (select 1 from pg_enum where enumlabel = 'empleado' and enumtypid = 'public.rol_usuario'::regtype) then
    alter type public.rol_usuario rename value 'empleado' to 'usuario';
  end if;
exception when others then
  -- Si ya fue renombrado, ignorar
  null;
end $$;

-- Asegurar default de profiles.rol
alter table public.profiles alter column rol set default 'usuario'::public.rol_usuario;

-- Recreate handle_new_user con default usuario (idempotente)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.profiles (id, full_name, rol, activo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'rol')::rol_usuario, 'usuario'::rol_usuario),
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$fn$;
