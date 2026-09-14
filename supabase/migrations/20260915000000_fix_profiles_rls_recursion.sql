-- Fix infinite recursion in profiles RLS (jefe1@helpdesk.local login "Usuario desactivado")
-- Original policies used EXISTS (select from profiles) inside profiles policy -> recursion
-- Use SECURITY DEFINER helpers to bypass RLS
create or replace function public.is_admin()
returns boolean language sql security definer set search_path=public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and rol = 'administrador'::rol_usuario and activo);
$$;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid() OR public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_write_admin on public.profiles;
create policy profiles_write_admin on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
