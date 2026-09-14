-- RF-27 — Mi Perfil: telefono + avatar_url en profiles + bucket avatares (Sleek v2 minimalista: foto+tel editable, resto lectura)
alter table public.profiles add column if not exists telefono text;
alter table public.profiles add column if not exists avatar_url text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='profiles_telefono_chk') then
    alter table public.profiles add constraint profiles_telefono_chk check (telefono is null or telefono ~ '^[0-9 +()\-]{7,20}$');
  end if;
end $$;

-- Bucket avatares público (lectura pública, escritura autenticada por usuario)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares','avatares', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true, file_size_limit=5242880;

-- Políticas Storage avatares (idempotentes: drop si existen)
drop policy if exists "avatares_insert_authenticated" on storage.objects;
drop policy if exists "avatares_select_public" on storage.objects;
drop policy if exists "avatares_update_owner" on storage.objects;
drop policy if exists "avatares_delete_owner" on storage.objects;

create policy "avatares_insert_authenticated" on storage.objects for insert to authenticated with check (bucket_id='avatares');
create policy "avatares_select_public" on storage.objects for select to public using (bucket_id='avatares');
create policy "avatares_update_owner" on storage.objects for update to authenticated using (bucket_id='avatares' and owner = auth.uid()) with check (bucket_id='avatares');
create policy "avatares_delete_owner" on storage.objects for delete to authenticated using (bucket_id='avatares' and owner = auth.uid());
