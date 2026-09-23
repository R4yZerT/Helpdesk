-- H8 — ticket_adjuntos: columnas canónicas (schema_inicial).
-- mapAdjunto ya no tiene fallbacks legacy; esta migración elimina por si acaso
-- columnas heredadas si existieran en alguna base (idempotente, best-effort).
do $$
declare col text;
begin
  for col in select unnest(array['ruta', 'nombre', 'filename', 'mime_type', 'size', 'bytes']) loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'ticket_adjuntos' and column_name = col
    ) then
      execute format('alter table public.ticket_adjuntos drop column %I', col);
    end if;
  end loop;
end $$;
