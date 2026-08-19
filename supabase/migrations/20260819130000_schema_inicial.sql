-- Esquema inicial de la mesa de ayuda con IA
-- Validado con ARID: concurrencia (E7/E9), permisos (E10-E12),
-- datos sucios (E13/E14), IA (E16-E19), recuperabilidad (E20/E21), índices (E24)

-- =============================================================
-- 1. Tipos
-- =============================================================
create type public.rol_usuario as enum ('empleado', 'tecnico', 'jefe', 'administrador');
create type public.estado_ticket as enum ('abierto', 'en_proceso', 'solucionado', 'cerrado', 'devuelto', 'programado');
create type public.prioridad_ticket as enum ('baja', 'media', 'alta', 'critica');
create type public.tipo_evento_ticket as enum ('estado', 'asignacion');
create type public.tipo_alerta_ia as enum ('pico_inusual', 'ticket_estancado');
create type public.tipo_prediccion_ia as enum ('carga_por_hora', 'carga_por_dia', 'carga_por_mes', 'demanda_categoria');

-- =============================================================
-- 2. Tablas
-- =============================================================

-- Mesas de servicio (RF-29): TIC, Comunicaciones, Infraestructura, EAPSA
create table if not exists public.mesas (
  id        serial primary key,
  nombre    text not null unique,
  activa    boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Perfil extendido del usuario auth
-- El rol se lee de esta tabla (no del JWT) para autorización
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text not null,
  rol            public.rol_usuario not null default 'empleado',
  mesa_id        int references public.mesas (id) on delete set null,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Secuencia de numeración de tickets (antes de la tabla que la usa)
create sequence if not exists public.tickets_numero_seq;

-- Tickets (RF-06..11)
-- PK uuid generado por el cliente -> idempotencia ante reintentos (E20)
create table if not exists public.tickets (
  id                  uuid primary key default gen_random_uuid(),
  numero              int not null default nextval('public.tickets_numero_seq'),
  usuario_id          uuid not null references public.profiles (id),
  mesa_id             int references public.mesas (id),
  categoria_id        int not null references public.ticket_categories (id),
  asunto              text not null check (length(asunto) between 5 and 200),
  descripcion         text not null check (length(descripcion) between 10 and 5000),
  prioridad           public.prioridad_ticket not null default 'media',
  estado              public.estado_ticket not null default 'abierto',
  tecnico_asignado_id uuid references public.profiles (id) on delete set null,
  fecha_resolucion    timestamptz,
  solucion_aplicada   text,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  unique (numero)
);

-- Historial de estados y asignaciones (append-only, E9/E21)
create table if not exists public.ticket_estados (
  id              bigserial primary key,
  ticket_id       uuid not null references public.tickets (id) on delete cascade,
  tipo_evento     public.tipo_evento_ticket not null default 'estado',
  estado_anterior public.estado_ticket,
  estado_nuevo    public.estado_ticket,
  tecnico_de      uuid references public.profiles (id) on delete set null,
  tecnico_para    uuid references public.profiles (id) on delete set null,
  usuario_id      uuid not null references public.profiles (id),
  comentario      text,
  creado_en       timestamptz not null default now()
);

-- Comentarios del hilo de avances (RF-15)
create table if not exists public.ticket_comentarios (
  id         bigserial primary key,
  ticket_id  uuid not null references public.tickets (id) on delete cascade,
  usuario_id uuid not null references public.profiles (id),
  comentario text not null check (length(comentario) between 1 and 2000),
  interno    boolean not null default false,
  creado_en  timestamptz not null default now()
);

-- Adjuntos (RF-07) — el binario vive en Storage, aquí el puntero
create table if not exists public.ticket_adjuntos (
  id              bigserial primary key,
  ticket_id       uuid not null references public.tickets (id) on delete cascade,
  storage_path    text not null,
  nombre_original text not null,
  mime            text not null,
  tamano_bytes    bigint not null check (tamano_bytes >= 0),
  subido_por      uuid not null references public.profiles (id),
  creado_en       timestamptz not null default now()
);

-- Predicciones IA: el dashboard lee de aquí, nunca del modelo (E19)
create table if not exists public.predicciones_ia (
  id              bigserial primary key,
  tipo            public.tipo_prediccion_ia not null,
  mesa_id         int references public.mesas (id) on delete cascade,
  categoria_id    int references public.ticket_categories (id) on delete cascade,
  periodo         timestamptz not null,
  valor           numeric not null,
  rango_confianza numeric not null default 0,
  confiable       boolean not null default false,  -- E16: no presentar predicciones dudosas como seguras
  modelo_version  text not null,
  creado_en       timestamptz not null default now()
);

-- Alertas IA (RF-21): picos inusuales y tickets estancados
create table if not exists public.alertas_ia (
  id         bigserial primary key,
  tipo       public.tipo_alerta_ia not null,
  ticket_id  uuid references public.tickets (id) on delete cascade,
  mesa_id    int references public.mesas (id) on delete cascade,
  mensaje    text not null,
  severidad  text not null default 'media' check (severidad in ('baja', 'media', 'alta', 'critica')),
  estado     text not null default 'nueva' check (estado in ('nueva', 'vista', 'resuelta')),
  creado_en  timestamptz not null default now()
);

-- Notificaciones push (RF-23)
create table if not exists public.notificaciones (
  id         bigserial primary key,
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  tipo       text not null,
  titulo     text not null,
  cuerpo     text,
  leida      boolean not null default false,
  ticket_id  uuid references public.tickets (id) on delete cascade,
  creado_en  timestamptz not null default now()
);

-- Registro de importaciones CSV (E14: deduplicación por huella del archivo)
create table if not exists public.batch_imports (
  id                bigserial primary key,
  nombre_archivo    text not null,
  huella            text not null unique,
  total_filas       int not null,
  filas_ok          int not null default 0,
  filas_cuarentena  int not null default 0,
  creado_en         timestamptz not null default now()
);

-- Filas rechazadas en la importación (E13: nunca asignar categoría incorrecta en silencio)
create table if not exists public.import_cuarentena (
  id            bigserial primary key,
  batch_id      bigint not null references public.batch_imports (id) on delete cascade,
  fila_original jsonb not null,
  motivo        text not null,
  creado_en     timestamptz not null default now()
);

-- =============================================================
-- 3. RLS — habilitar en todas las tablas expuestas
-- =============================================================
alter table public.mesas              enable row level security;
alter table public.profiles           enable row level security;
alter table public.tickets            enable row level security;
alter table public.ticket_estados     enable row level security;
alter table public.ticket_comentarios enable row level security;
alter table public.ticket_adjuntos    enable row level security;
alter table public.predicciones_ia    enable row level security;
alter table public.alertas_ia         enable row level security;
alter table public.notificaciones     enable row level security;
alter table public.batch_imports      enable row level security;
alter table public.import_cuarentena  enable row level security;

-- Helper de visibilidad de ticket, reutilizado por las políticas
create or replace function public.puede_ver_ticket(ticket_id uuid)
returns boolean
language sql stable
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = ticket_id
      and (
        t.usuario_id = auth.uid()
        or t.tecnico_asignado_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.activo and p.rol in ('jefe', 'administrador')
        )
      )
  );
$$;

-- Mesas: catálogo visible para todos los autenticados, escritura solo admin
create policy "mesas_select_authenticated" on public.mesas
  for select to authenticated using (true);

create policy "mesas_write_admin" on public.mesas
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'administrador' and p.activo))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'administrador' and p.activo));

-- Categorías: lectura para todos, escritura solo admin (RF-32)
create policy "ticket_categories_select_authenticated" on public.ticket_categories
  for select to authenticated using (true);

create policy "ticket_categories_write_admin" on public.ticket_categories
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'administrador' and p.activo))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'administrador' and p.activo));

-- Profiles: cada uno se ve a sí mismo; el admin gestiona a todos (RF-27)
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'administrador' and p.activo));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and rol = (select rol from public.profiles where id = auth.uid()));

create policy "profiles_write_admin" on public.profiles
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'administrador' and p.activo))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'administrador' and p.activo));

-- Tickets
-- SELECT: propio / asignado / jefe / admin (E3: empleado SOLO ve los suyos)
create policy "tickets_select_own" on public.tickets
  for select to authenticated
  using (usuario_id = auth.uid());

create policy "tickets_select_asignado" on public.tickets
  for select to authenticated
  using (tecnico_asignado_id = auth.uid());

create policy "tickets_select_jefe_admin" on public.tickets
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.activo and p.rol in ('jefe', 'administrador')));

-- INSERT: el empleado crea su propio ticket (admin no gestiona tickets)
create policy "tickets_insert_empleado" on public.tickets
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.activo and p.rol <> 'administrador')
  );

-- UPDATE: el empleado edita su ticket solo si está abierto y sin asignar (RF-10)
create policy "tickets_update_empleado" on public.tickets
  for update to authenticated
  using (usuario_id = auth.uid() and estado = 'abierto' and tecnico_asignado_id is null)
  with check (usuario_id = auth.uid() and estado = 'abierto' and tecnico_asignado_id is null);

-- UPDATE: el técnico asignado transiciona estados y reasigna (E7/E9: guarda por tecnico_asignado_id = uid())
create policy "tickets_update_tecnico" on public.tickets
  for update to authenticated
  using (
    tecnico_asignado_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.activo and p.rol = 'tecnico')
  )
  with check (true);

-- UPDATE: el admin asigna tickets y administra (E7: asignación inicial)
create policy "tickets_update_admin" on public.tickets
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.activo and p.rol = 'administrador'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.activo and p.rol = 'administrador'));

-- Sin política DELETE: cancelar es un estado, nunca un borrado

-- Historial (append-only): lectura según acceso al ticket, solo INSERT (vía trigger)
create policy "ticket_estados_select" on public.ticket_estados
  for select to authenticated
  using (puede_ver_ticket(ticket_id));

create policy "ticket_estados_insert" on public.ticket_estados
  for insert to authenticated
  with check (puede_ver_ticket(ticket_id));

-- Comentarios: lectura con acceso al ticket; escritura de participantes
create policy "ticket_comentarios_select" on public.ticket_comentarios
  for select to authenticated
  using (puede_ver_ticket(ticket_id));

create policy "ticket_comentarios_insert" on public.ticket_comentarios
  for insert to authenticated
  with check (usuario_id = auth.uid() and puede_ver_ticket(ticket_id));

-- Adjuntos
create policy "ticket_adjuntos_select" on public.ticket_adjuntos
  for select to authenticated
  using (puede_ver_ticket(ticket_id));

create policy "ticket_adjuntos_insert" on public.ticket_adjuntos
  for insert to authenticated
  with check (subido_por = auth.uid() and puede_ver_ticket(ticket_id));

-- Predicciones y alertas IA: solo jefe/admin (RF-18/21)
create policy "predicciones_ia_select_jefe_admin" on public.predicciones_ia
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.activo and p.rol in ('jefe', 'administrador')));

create policy "alertas_ia_select_jefe_admin" on public.alertas_ia
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.activo and p.rol in ('jefe', 'administrador')));

-- Notificaciones: cada usuario ve y marca las suyas
create policy "notificaciones_select_own" on public.notificaciones
  for select to authenticated
  using (usuario_id = auth.uid());

create policy "notificaciones_update_own" on public.notificaciones
  for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- Importaciones: solo admin (E13/E14)
create policy "batch_imports_admin" on public.batch_imports
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'administrador' and p.activo))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'administrador' and p.activo));

create policy "import_cuarentena_admin" on public.import_cuarentena
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'administrador' and p.activo))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'administrador' and p.activo));

-- =============================================================
-- 4. Trigger de trazabilidad: registra cambios de estado y asignación
-- =============================================================
create or replace function public.ticket_cambio_trigger()
returns trigger
language plpgsql
as $$
begin
  -- Cambio de estado -> historial con estado_anterior/nuevo
  if new.estado is distinct from old.estado then
    insert into public.ticket_estados (ticket_id, tipo_evento, estado_anterior, estado_nuevo, usuario_id, comentario)
    values (new.id, 'estado', old.estado, new.estado, auth.uid(), null);
  end if;

  -- Cambio de responsable -> historial con tecnico_de/para (E9)
  if new.tecnico_asignado_id is distinct from old.tecnico_asignado_id then
    insert into public.ticket_estados (ticket_id, tipo_evento, tecnico_de, tecnico_para, usuario_id, comentario)
    values (new.id, 'asignacion', old.tecnico_asignado_id, new.tecnico_asignado_id, auth.uid(), null);
  end if;

  -- Capturar fecha de resolución al pasar a solucionado/cerrado (RF-11)
  if new.estado in ('solucionado', 'cerrado') and new.fecha_resolucion is null then
    new.fecha_resolucion := now();
  end if;

  new.actualizado_en := now();
  return new;
end;
$$;

create trigger trg_tickets_cambio
  before update on public.tickets
  for each row execute function public.ticket_cambio_trigger();

-- =============================================================
-- 5. Índices (E24: mantener consultas ágiles cuando crezca el histórico)
-- =============================================================
create index if not exists idx_tickets_usuario_estado   on public.tickets (usuario_id, estado);
create index if not exists idx_tickets_tecnico_estado   on public.tickets (tecnico_asignado_id, estado)
  where tecnico_asignado_id is not null;
create index if not exists idx_tickets_creado_en        on public.tickets (creado_en);
create index if not exists idx_tickets_mesa_creado      on public.tickets (mesa_id, creado_en);
create index if not exists idx_ticket_estados_ticket    on public.ticket_estados (ticket_id, creado_en);
create index if not exists idx_predicciones_periodo     on public.predicciones_ia (periodo, mesa_id);
create index if not exists idx_alertas_estado_creado    on public.alertas_ia (estado, creado_en);
create index if not exists idx_notificaciones_usuario   on public.notificaciones (usuario_id, leida);