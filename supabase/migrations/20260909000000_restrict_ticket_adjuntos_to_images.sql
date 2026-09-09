-- RF-07 — Restringir adjuntos a solo imágenes (10MB, max 5 por ticket ya en RLS/app)
-- Actualiza bucket existente para solo image/* y añade check en ticket_adjuntos si existe columna mime
update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']
where id = 'ticket-adjuntos';

-- Asegurar que ticket_adjuntos tenga restricción de mime si tiene columna mime_type/tipo (best-effort, ignora si hay datos previos no-image)
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='ticket_adjuntos' and column_name='mime_type') then
    if not exists (select 1 from pg_constraint where conname='ticket_adjuntos_mime_image_chk') then
      begin
        alter table public.ticket_adjuntos add constraint ticket_adjuntos_mime_image_chk check (mime_type in ('image/jpeg','image/png','image/webp','image/gif'));
      exception when check_violation then null;
      end;
    end if;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='ticket_adjuntos' and column_name='mime') then
    if not exists (select 1 from pg_constraint where conname='ticket_adjuntos_mime2_image_chk') then
      begin
        alter table public.ticket_adjuntos add constraint ticket_adjuntos_mime2_image_chk check (mime in ('image/jpeg','image/png','image/webp','image/gif'));
      exception when check_violation then null;
      end;
    end if;
  end if;
end $$;
