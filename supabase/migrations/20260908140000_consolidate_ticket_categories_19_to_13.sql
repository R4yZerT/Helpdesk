-- Consolidación 19 → 13 categorías (fix/pr-misSolicitudes-ia-adjuntos)
-- Alinea DB con ml/src/category_mapping.py CONSOLIDATED_MAP + auditoría 2026-09-07
-- Nuevas macro-categorías: tic:Gestión de Accesos y Seguridad, tic:Software y Sistemas, tic:Equipos e Infraestructura
-- + parche Greca: todos los tickets de Greca -> infra:Obra civil (ya existe)
-- + desactivación del comodín general:Sin clasificar

-- 1. Insertar 3 macro-categorías consolidadas si no existen
insert into public.ticket_categories (dominio, subcategoria, orden, activa) values
  ('tic', 'Gestión de Accesos y Seguridad', 15, true),
  ('tic', 'Software y Sistemas', 85, true),
  ('tic', 'Equipos e Infraestructura', 65, true)
on conflict (dominio, subcategoria) do update set activa = true, orden = excluded.orden;

-- 2. Reapuntar tickets de las 8 categorías legacy a las 3 consolidadas

-- TIC: Gestión usuarios (1) + Permisos y accesos (2) + Contraseñas (3) -> GAS (nueva)
-- Usamos lookup dinámico por (dominio,subcategoria) para ser idempotente

-- Helper: migrar por nombre (no por id fijo, robusto a reorders)
do $$
declare
  gas_id int; sys_id int; equi_id int;
begin
  select id into gas_id  from public.ticket_categories where dominio='tic' and subcategoria='Gestión de Accesos y Seguridad';
  select id into sys_id  from public.ticket_categories where dominio='tic' and subcategoria='Software y Sistemas';
  select id into equi_id from public.ticket_categories where dominio='tic' and subcategoria='Equipos e Infraestructura';

  -- GAS: 3 fuentes -> 1 destino
  update public.tickets set categoria_id = gas_id
  where categoria_id in (
    select id from public.ticket_categories where (dominio,subcategoria) in (
      ('tic','Gestión de usuarios'), ('tic','Permisos y accesos'), ('tic','Contraseñas y seguridad')
    )
  );

  -- SyS: 2 fuentes -> 1 destino
  update public.tickets set categoria_id = sys_id
  where categoria_id in (
    select id from public.ticket_categories where (dominio,subcategoria) in (
      ('tic','Software y aplicaciones'), ('tic','Soporte y aplicaciones institucionales')
    )
  );

  -- EI: 3 fuentes -> 1 destino
  update public.tickets set categoria_id = equi_id
  where categoria_id in (
    select id from public.ticket_categories where (dominio,subcategoria) in (
      ('tic','Equipos y hardware'), ('tic','Impresoras y escáneres'), ('tic','Datos y respaldos')
    )
  );

  -- Eliminar comodín general si aún tiene tickets (fuerza reapunte por texto ya limpio en dataset)
  -- Los tickets restantes en general deben ser 0 post-limpieza; si existen, los movemos a SyS como fallback
  if sys_id is not null then
    update public.tickets set categoria_id = sys_id
    where categoria_id in (select id from public.ticket_categories where dominio='general' and subcategoria='Sin clasificar / Otros');
  end if;
end $$;

-- 3. Desactivar categorías legacy (no borrar por FK histórico, solo activa=false)
update public.ticket_categories set activa = false where (dominio, subcategoria) in (
  ('tic','Gestión de usuarios'),
  ('tic','Permisos y accesos'),
  ('tic','Contraseñas y seguridad'),
  ('tic','Software y aplicaciones'),
  ('tic','Soporte y aplicaciones institucionales'),
  ('tic','Equipos y hardware'),
  ('tic','Impresoras y escáneres'),
  ('tic','Datos y respaldos'),
  ('general','Sin clasificar / Otros')
);

-- 4. Validación: tras migración deben quedar exactamente 13 activas
do $$
declare cnt int;
begin
  select count(*) into cnt from public.ticket_categories where activa = true;
  if cnt <> 13 then
    raise warning 'Consolidación: se esperaban 13 categorías activas, hay % — revisar', cnt;
  end if;
end $$;
