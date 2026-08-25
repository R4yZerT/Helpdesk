-- RF-06 endurecimiento — Calidad: Consistencia/Datos + Seguridad + Confiabilidad
-- Decision arquitectura: mesa_id NOT NULL + trigger usuario_id = auth.uid() (fail-closed)
-- Escenarios: empleado sin mesa seleccionada debe fallar 100% (no ticket huérfano para IA/métricas)

-- 1. Hacer mesa_id NOT NULL (antes nullable). Si hay datos huérfanos, asigna TIC (id=1) como fallback seguro
do $$
declare
  tic_id int;
begin
  select id into tic_id from public.mesas where nombre = 'TIC' limit 1;
  if tic_id is not null then
    update public.tickets set mesa_id = tic_id where mesa_id is null;
  end if;
end $$;

alter table public.tickets alter column mesa_id set not null;

-- 2. Trigger before insert: inyecta usuario_id = auth.uid() si cliente no lo envía
-- Garantiza RLS tickets_insert_empleado (usuario_id = auth.uid()) sin depender de que el cliente lo envíe
create or replace function public.tickets_set_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.usuario_id is null then
    new.usuario_id := auth.uid();
  end if;
  if new.usuario_id is null then
    raise exception 'usuario_id requerido (sesión no válida)';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tickets_set_usuario on public.tickets;
create trigger trg_tickets_set_usuario
  before insert on public.tickets
  for each row execute function public.tickets_set_usuario();
