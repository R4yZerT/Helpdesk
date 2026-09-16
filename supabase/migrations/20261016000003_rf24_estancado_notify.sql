-- RF-24/B5 — Los tickets estancados de prioridad alta/crítica deben avisar al jefe.
-- Brecha: trg_notificar_alerta_ia (20261015000000) solo notificaba picos; las alertas
-- ticket_estancado con severidad alta/crítica se creaban pero nadie las recibía.
-- Fix: se reemplaza la función para incluir ticket_estancado alta/crítica.
-- Todo idempotente (CREATE OR REPLACE / DROP IF EXISTS).

create or replace function public.trg_notificar_alerta_ia()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.tipo in (
        'pico_inusual'::public.tipo_alerta_ia,
        'pico_esperado'::public.tipo_alerta_ia,
        'ticket_estancado'::public.tipo_alerta_ia
     )
     and NEW.severidad in ('alta', 'critica') then
    insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo)
    select p.id,
           'alerta_pico',
           case NEW.tipo
             when 'pico_esperado'::public.tipo_alerta_ia then 'Pico de tickets esperado'
             when 'ticket_estancado'::public.tipo_alerta_ia then 'Ticket estancado'
             else 'Pico inusual de tickets'
           end,
           NEW.mensaje
    from public.profiles p
    where p.activo and p.rol in ('jefe', 'administrador');
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_alerta_ia_notificar on public.alertas_ia;
create trigger trg_alerta_ia_notificar
  after insert on public.alertas_ia
  for each row execute function public.trg_notificar_alerta_ia();
