-- RF IA: trazabilidad de clasificación y validación técnica (loop de validación)
-- Tabla 1-1 ticket_ia_feedback + trigger auto + vista dataset solo validados.

-- 1) Tabla de feedback
create table if not exists public.ticket_ia_feedback (
  ticket_id uuid primary key references public.tickets(id) on delete cascade,
  sugerido_mesa_id int references public.mesas(id) on delete set null,
  sugerido_categoria_id int references public.ticket_categories(id) on delete set null,
  confianza numeric(5,4),
  fuente text not null default 'desconocida'
    check (fuente in ('beto','reglas','manual','desconocida')),
  estado text not null default 'pendiente'
    check (estado in ('pendiente','confirmada','corregida')),
  final_mesa_id int references public.mesas(id) on delete set null,
  final_categoria_id int references public.ticket_categories(id) on delete set null,
  validado_por uuid references public.profiles(id) on delete set null,
  validado_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (confianza is null or (confianza >= 0 and confianza <= 1)),
  check (
    (estado = 'pendiente')
    or (estado = 'confirmada' and validado_por is not null and validado_en is not null)
    or (estado = 'corregida' and validado_por is not null and validado_en is not null
        and final_mesa_id is not null and final_categoria_id is not null)
  )
);

comment on table public.ticket_ia_feedback is
  'Trazabilidad IA por ticket: sugerencia (mesa/categoria, confianza, fuente) y validación del técnico. Solo confirmada/corregida alimenta el dataset de reentrenamiento.';

-- updated_at automático
create or replace function public.touch_ticket_ia_feedback_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ticket_ia_feedback_touch on public.ticket_ia_feedback;
create trigger trg_ticket_ia_feedback_touch
  before update on public.ticket_ia_feedback
  for each row execute function public.touch_ticket_ia_feedback_updated_at();

-- 2) Trigger: crear fila pendiente al insertar ticket
create or replace function public.crear_ticket_ia_feedback_pendiente()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.ticket_ia_feedback (ticket_id)
  values (new.id)
  on conflict (ticket_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_tickets_crear_ia_feedback on public.tickets;
create trigger trg_tickets_crear_ia_feedback
  after insert on public.tickets
  for each row execute function public.crear_ticket_ia_feedback_pendiente();

-- Backfill para tickets existentes sin fila
insert into public.ticket_ia_feedback (ticket_id)
select t.id from public.tickets t
left join public.ticket_ia_feedback f on f.ticket_id = t.id
where f.ticket_id is null;

-- 3) Helper SECURITY DEFINER: ¿puede validar este usuario este ticket?
-- Técnico asignado, jefe o admin.
create or replace function public.puede_validar_ia(p_ticket_id uuid, p_uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.tickets t
    left join public.profiles p on p.id = p_uid
    where t.id = p_ticket_id
      and (
        t.tecnico_asignado_id = p_uid
        or coalesce(p.rol::text, '') in ('jefe', 'administrador')
      )
  );
$$;

-- 4) RLS
alter table public.ticket_ia_feedback enable row level security;

drop policy if exists "ia_feedback_select_validador" on public.ticket_ia_feedback;
create policy "ia_feedback_select_validador"
  on public.ticket_ia_feedback for select
  to authenticated
  using (public.puede_validar_ia(ticket_id, auth.uid()));

-- Update solo vía validador; el estado final lo impone el CHECK.
-- El upsert de la sugerencia inicial lo hace el creador del ticket:
-- se permite update de sugerencia solo si la fila sigue pendiente y sin validar.
drop policy if exists "ia_feedback_update_validador" on public.ticket_ia_feedback;
create policy "ia_feedback_update_validador"
  on public.ticket_ia_feedback for update
  to authenticated
  using (public.puede_validar_ia(ticket_id, auth.uid()))
  with check (public.puede_validar_ia(ticket_id, auth.uid()));

drop policy if exists "ia_feedback_insert_creador" on public.ticket_ia_feedback;
create policy "ia_feedback_insert_creador"
  on public.ticket_ia_feedback for insert
  to authenticated
  with check (
    exists (select 1 from public.tickets t
            where t.id = ticket_id and t.usuario_id = auth.uid())
  );

-- 5) Vista dataset: solo registros validados (confirmada/corregida)
create or replace view public.dataset_entrenamiento_ia as
select
  f.ticket_id,
  t.asunto,
  t.descripcion,
  coalesce(f.final_mesa_id, t.mesa_id) as mesa_id,
  coalesce(f.final_categoria_id, t.categoria_id) as categoria_id,
  m.nombre as mesa_nombre,
  (c.dominio || ' · ' || c.subcategoria) as categoria_nombre,
  f.fuente,
  f.confianza,
  f.estado,
  (f.estado = 'corregida') as fue_corregida,
  f.validado_en
from public.ticket_ia_feedback f
join public.tickets t on t.id = f.ticket_id
left join public.mesas m on m.id = coalesce(f.final_mesa_id, t.mesa_id)
left join public.ticket_categories c on c.id = coalesce(f.final_categoria_id, t.categoria_id)
where f.estado in ('confirmada', 'corregida')
  and t.mesa_id is not null
  and t.categoria_id is not null;

comment on view public.dataset_entrenamiento_ia is
  'Dataset para reentrenamiento: solo tickets con validación técnica (confirmada/corregida). Sin respuesta del técnico el registro NO aparece.';
