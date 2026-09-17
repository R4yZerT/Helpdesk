-- Pipeline reentrenamiento BETO: registry de modelos versionados.
-- Bucket privado `modelos-ia`: tarballs beto-tickets-<version>.tar.gz + latest.json.
-- Sin policies públicas: solo service_role (bypassa RLS) escribe/lee.
-- El deploy descarga con service key o URL firmada; rollback = re-apuntar latest.json.
insert into storage.buckets (id, name, public)
values ('modelos-ia', 'modelos-ia', false)
on conflict (id) do nothing;
