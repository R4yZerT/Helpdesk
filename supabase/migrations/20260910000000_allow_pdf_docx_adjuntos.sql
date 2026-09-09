-- RF-07 — Ampliar adjuntos a PDF + DOC/DOCX además de imágenes
-- Actualiza bucket y constraints existentes

update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
where id = 'ticket-adjuntos';

do $$
begin
  -- drop old image-only checks if exists (para permitir nuevos mimes)
  if exists (select 1 from pg_constraint where conname='ticket_adjuntos_mime_image_chk') then
    alter table public.ticket_adjuntos drop constraint ticket_adjuntos_mime_image_chk;
  end if;
  if exists (select 1 from pg_constraint where conname='ticket_adjuntos_mime2_image_chk') then
    alter table public.ticket_adjuntos drop constraint ticket_adjuntos_mime2_image_chk;
  end if;

  -- añade checks ampliados (idempotente: solo si columnas existen)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='ticket_adjuntos' and column_name='mime_type') then
    if not exists (select 1 from pg_constraint where conname='ticket_adjuntos_mime_any_chk') then
      alter table public.ticket_adjuntos add constraint ticket_adjuntos_mime_any_chk
        check (mime_type in ('image/jpeg','image/png','image/webp','image/gif','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
    end if;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='ticket_adjuntos' and column_name='mime') then
    if not exists (select 1 from pg_constraint where conname='ticket_adjuntos_mime2_any_chk') then
      alter table public.ticket_adjuntos add constraint ticket_adjuntos_mime2_any_chk
        check (mime in ('image/jpeg','image/png','image/webp','image/gif','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
    end if;
  end if;
end $$;
