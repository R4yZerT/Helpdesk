-- RF-13 / RF-11 — FSM de estados impuesta en BD (espejo de shared/src/tickets.ts ESTADOS_TRANSICION + §9 documento-requisitos)
-- Antes: la matriz solo existía en cliente (fail-fast en transitionTicket); escritura directa (SQL/service_role/Edge)
-- podía saltar pasos (abierto→cerrado sin control) o cerrar sin solución → dato IA corrupto.
-- Esta migración añade trigger BEFORE UPDATE que rechaza transiciones fuera de la matriz y exige
-- solucion_aplicada (trim 5–5000) para solucionado y cerrado.
-- Excepción RF-10: abierto→cerrado sin técnico asignado (cancelación del solicitante, cubierta por RLS en B1)
-- no exige solución — cancelar no es resolver.

create or replace function public.ticket_fsm_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  permitido boolean := false;
  sol text;
  es_cancelacion boolean := false;
begin
  -- Sin cambio de estado: nada que validar (el check de solución solo aplica al transicionar)
  if new.estado is not distinct from old.estado then
    return new;
  end if;

  -- Matriz §9 (cerrado es terminal: sin salidas)
  case old.estado::text
    when 'abierto' then
      permitido := new.estado::text in ('en_proceso', 'programado', 'cerrado');
    when 'en_proceso' then
      permitido := new.estado::text in ('programado', 'solucionado', 'devuelto', 'cerrado');
    when 'programado' then
      permitido := new.estado::text in ('en_proceso', 'solucionado', 'cerrado');
    when 'solucionado' then
      permitido := new.estado::text in ('cerrado', 'devuelto');
    when 'devuelto' then
      permitido := new.estado::text in ('en_proceso', 'programado', 'cerrado');
    when 'cerrado' then
      permitido := false;
    else
      permitido := false;
  end case;

  if not permitido then
    raise exception 'Transición no permitida: % → %', old.estado, new.estado using errcode = '23514';
  end if;

  -- Cancelación propia (RF-10): abierto→cerrado sin técnico asignado → exenta de solución
  es_cancelacion := (old.estado::text = 'abierto' and new.estado::text = 'cerrado'
    and old.tecnico_asignado_id is null and new.tecnico_asignado_id is null);

  -- Solución obligatoria para solucionado / cerrado (RF-11, dato clave IA)
  if new.estado::text in ('solucionado', 'cerrado') and not es_cancelacion then
    sol := coalesce(nullif(btrim(new.solucion_aplicada, ' ' || chr(9) || chr(10) || chr(13)), ''), '');
    if sol = '' then
      raise exception 'Solución aplicada requerida para % (mín. 5 caracteres)', new.estado using errcode = '23514';
    end if;
    if char_length(sol) < 5 then
      raise exception 'Solución mínimo 5 caracteres' using errcode = '23514';
    end if;
    if char_length(sol) > 5000 then
      raise exception 'Solución máximo 5000 caracteres' using errcode = '23514';
    end if;
    new.solucion_aplicada := sol;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tickets_fsm on public.tickets;
create trigger trg_tickets_fsm
  before update of estado on public.tickets
  for each row execute function public.ticket_fsm_check();

comment on function public.ticket_fsm_check() is 'RF-13/RF-11: impone matriz FSM §9 + solucion_aplicada obligatoria (excepto cancelacion RF-10 abierto→cerrado sin asignar)';
