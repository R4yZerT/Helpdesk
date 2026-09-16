-- RF-07/B6 — Topes de adjuntos server-side (antes solo validación cliente).
-- (1) Máximo 5 archivos por ticket: trigger BEFORE INSERT que cuenta filas.
-- (2) Tamaño máximo 10 MB por archivo en el metadato (espeja file_size_limit del
--     bucket `ticket-adjuntos` y shared/src/tickets.ts ADJUNTO_MAX_MB/COUNT).
-- Todo idempotente (DROP IF EXISTS).

-- (2) Cota de tamaño declarativa
alter table public.ticket_adjuntos drop constraint if exists ticket_adjuntos_tamano_max;
alter table public.ticket_adjuntos
  add constraint ticket_adjuntos_tamano_max check (tamano_bytes <= 10485760);

-- (1) Tope de conteo por ticket
create or replace function public.ticket_adjuntos_check()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_n bigint;
begin
  select count(*) into v_n from public.ticket_adjuntos where ticket_id = NEW.ticket_id;
  if v_n >= 5 then
    raise exception 'Máximo 5 archivos adjuntos por ticket (RF-07)' using errcode = 'P0001';
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_ticket_adjuntos_check on public.ticket_adjuntos;
create trigger trg_ticket_adjuntos_check
  before insert on public.ticket_adjuntos
  for each row execute function public.ticket_adjuntos_check();
