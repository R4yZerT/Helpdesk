-- RF-23 — Notificaciones push ante cambios de estado (usuario + técnico) + push_tokens para expo-notifications
-- 1) push_tokens (opcional para FCM/APNS vía expo-notifications)
create table if not exists public.push_tokens (
  id bigserial primary key,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  plataforma text not null check (plataforma in ('web','android','ios')),
  creado_en timestamptz not null default now(),
  unique (usuario_id, token)
);
alter table public.push_tokens enable row level security;
drop policy if exists push_tokens_own on public.push_tokens;
create policy push_tokens_own on public.push_tokens for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create index if not exists idx_push_tokens_usuario on public.push_tokens (usuario_id);

-- Realtime para notificaciones (supabase realtime)
-- Asegura que la tabla esté en la publicación supabase_realtime (si no, el cliente no recibe postgres_changes)
do $$ begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
exception when duplicate_object then null;
end $$;
alter publication supabase_realtime add table public.notificaciones;

-- 2) Función trigger que genera notificaciones en cambios de estado / asignación
create or replace function public.trg_notificar_cambio_ticket()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_titulo text;
  v_cuerpo text;
  v_tipo text := 'cambio_estado';
begin
  -- Solo en UPDATE y si cambió estado o técnico
  if TG_OP = 'UPDATE' then
    -- Cambio de estado -> notifica al dueño del ticket (usuario_id) y al técnico asignado (si existe y no es el actor)
    if NEW.estado is distinct from OLD.estado then
      v_titulo := format('Ticket #%s → %s', NEW.numero, NEW.estado);
      v_cuerpo := format('Tu solicitud "%s" cambió de %s a %s', left(NEW.asunto, 80), OLD.estado, NEW.estado);
      -- dueño
      if NEW.usuario_id is not null and NEW.usuario_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
        insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, ticket_id) values (NEW.usuario_id, v_tipo, v_titulo, v_cuerpo, NEW.id);
      end if;
      -- técnico asignado (si distinto del actor y del dueño)
      if NEW.tecnico_asignado_id is not null and NEW.tecnico_asignado_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) and NEW.tecnico_asignado_id <> NEW.usuario_id then
        insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, ticket_id) values (NEW.tecnico_asignado_id, v_tipo, v_titulo || ' (asignado)', v_cuerpo, NEW.id);
      end if;
    end if;

    -- Cambio de técnico (reasignación) -> notifica al nuevo técnico y al dueño si no es el actor
    if NEW.tecnico_asignado_id is distinct from OLD.tecnico_asignado_id and NEW.tecnico_asignado_id is not null then
      v_titulo := format('Ticket #%s reasignado', NEW.numero);
      v_cuerpo := format('Se te asignó el ticket "%s" (%s)', left(NEW.asunto, 80), NEW.estado);
      if NEW.tecnico_asignado_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
        insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, ticket_id) values (NEW.tecnico_asignado_id, 'asignacion', v_titulo, v_cuerpo, NEW.id);
      end if;
    end if;
  end if;

  -- Nuevo comentario (si es de otro usuario) -> notifica al dueño/técnico (lo maneja trigger de ticket_comentarios)
  return NEW;
end; $$;

drop trigger if exists trg_ticket_notificar on public.tickets;
create trigger trg_ticket_notificar after update on public.tickets for each row execute function public.trg_notificar_cambio_ticket();

-- Comentarios: notifica al dueño/técnico cuando alguien comenta (no al autor)
create or replace function public.trg_notificar_comentario()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_titulo text; v_cuerpo text; v_ticket record;
begin
  select usuario_id, tecnico_asignado_id, numero, asunto into v_ticket from public.tickets where id = NEW.ticket_id;
  v_titulo := format('Nuevo comentario en Ticket #%s', v_ticket.numero);
  v_cuerpo := left(NEW.comentario, 120);
  -- notifica al dueño si no es el autor
  if v_ticket.usuario_id <> NEW.usuario_id then
    insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, ticket_id) values (v_ticket.usuario_id, 'comentario', v_titulo, v_cuerpo, NEW.ticket_id);
  end if;
  -- notifica al técnico si existe, no es autor ni dueño
  if v_ticket.tecnico_asignado_id is not null and v_ticket.tecnico_asignado_id <> NEW.usuario_id and v_ticket.tecnico_asignado_id <> v_ticket.usuario_id then
    insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, ticket_id) values (v_ticket.tecnico_asignado_id, 'comentario', v_titulo, v_cuerpo, NEW.ticket_id);
  end if;
  return NEW;
end; $$;
drop trigger if exists trg_comentario_notificar on public.ticket_comentarios;
create trigger trg_comentario_notificar after insert on public.ticket_comentarios for each row execute function public.trg_notificar_comentario();

-- Índices ya existentes para notificaciones_usuario; asegurar leida
create index if not exists idx_notificaciones_no_leida on public.notificaciones (usuario_id, leida) where leida = false;
