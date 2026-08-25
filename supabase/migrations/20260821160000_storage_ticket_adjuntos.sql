-- RF-07 — Bucket Storage para adjuntos de tickets
-- Binario en Storage, metadato en public.ticket_adjuntos (FK ticket_id)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-adjuntos',
  'ticket-adjuntos',
  false,
  10485760,
  array[
    'image/jpeg','image/png','image/webp','image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do nothing;

-- Políticas Storage.objects — acceso sólo a usuarios autenticados con acceso al ticket
-- Simplificación: autenticado puede subir/leer/borrar en este bucket; la autorización fina queda en RLS de ticket_adjuntos (puede_ver_ticket)
create policy "ticket_adjuntos_insert_authenticated"
on storage.objects for insert to authenticated
with check (bucket_id = 'ticket-adjuntos');

create policy "ticket_adjuntos_select_authenticated"
on storage.objects for select to authenticated
using (bucket_id = 'ticket-adjuntos');

create policy "ticket_adjuntos_update_authenticated"
on storage.objects for update to authenticated
using (bucket_id = 'ticket-adjuntos');

create policy "ticket_adjuntos_delete_authenticated"
on storage.objects for delete to authenticated
using (bucket_id = 'ticket-adjuntos');
