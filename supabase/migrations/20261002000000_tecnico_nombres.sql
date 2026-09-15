-- Expone solo full_name de técnicos asignados a tickets visibles por el llamante.
-- Bloqueador RLS: profiles solo legible por propio usuario o admin, así que el
-- cliente no puede hacer select directo del técnico asignado.
-- SECURITY DEFINER + filtro puede_ver_ticket: solo devuelve nombres de técnicos
-- asignados a tickets que el caller ya puede ver. Sin exponer email/teléfono/rol.
create or replace function public.resolve_tecnico_nombres(p_ids uuid[])
returns table (id uuid, full_name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name
  from public.profiles p
  where p.id = any(coalesce(p_ids, '{}'))
    and (
      p.id = auth.uid()
      or exists (
        select 1 from public.tickets t
        where t.tecnico_asignado_id = p.id
          and public.puede_ver_ticket(t.id)
      )
    );
$$;

revoke all on function public.resolve_tecnico_nombres(uuid[]) from public, anon;
grant execute on function public.resolve_tecnico_nombres(uuid[]) to authenticated;
