-- QA-C1 — Storage ticket-adjuntos: policies ligadas al ticket visible.
-- Antes: cualquier authenticated podía leer/borrar adjuntos ajenos conociendo el path
-- (solo se chequeaba bucket_id). Ahora el primer segmento del path es el ticket_id
-- ({ticket_id}/{ts}-{nombre}) y se exige public.puede_ver_ticket() en las 4 operaciones.
-- Fail-closed: paths que no empiezan por UUID válido se deniegan.

create or replace function public.storage_ticket_id(path text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  return split_part(path, '/', 1)::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

drop policy if exists "ticket_adjuntos_insert_authenticated" on storage.objects;
drop policy if exists "ticket_adjuntos_select_authenticated" on storage.objects;
drop policy if exists "ticket_adjuntos_update_authenticated" on storage.objects;
drop policy if exists "ticket_adjuntos_delete_authenticated" on storage.objects;

create policy "ticket_adjuntos_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ticket-adjuntos'
    and public.puede_ver_ticket(public.storage_ticket_id(name))
  );

create policy "ticket_adjuntos_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ticket-adjuntos'
    and public.puede_ver_ticket(public.storage_ticket_id(name))
  );

create policy "ticket_adjuntos_storage_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'ticket-adjuntos'
    and public.puede_ver_ticket(public.storage_ticket_id(name))
  );

create policy "ticket_adjuntos_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ticket-adjuntos'
    and public.puede_ver_ticket(public.storage_ticket_id(name))
  );
