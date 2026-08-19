-- Tabla maestra de categorías normalizadas de tickets de mesa de ayuda
-- Dominios: tic, comunicaciones, infraestructura, general

create table if not exists public.ticket_categories (
  id            serial primary key,
  dominio       text not null check (dominio in ('tic', 'comunicaciones', 'infraestructura', 'general')),
  subcategoria  text not null,
  orden         int  not null default 0,
  activa        boolean not null default true,
  creado_en     timestamptz not null default now(),
  unique (dominio, subcategoria)
);

-- Dominio 1: TIC
insert into public.ticket_categories (dominio, subcategoria, orden) values
  ('tic', 'Gestión de usuarios', 10),
  ('tic', 'Permisos y accesos', 20),
  ('tic', 'Contraseñas y seguridad', 30),
  ('tic', 'Correo electrónico', 40),
  ('tic', 'Conectividad y redes', 50),
  ('tic', 'Equipos y hardware', 60),
  ('tic', 'Impresoras y escáneres', 70),
  ('tic', 'Software y aplicaciones', 80),
  ('tic', 'Datos y respaldos', 90),
  ('tic', 'Soporte y aplicaciones institucionales', 100);

-- Dominio 2: Comunicaciones
insert into public.ticket_categories (dominio, subcategoria, orden) values
  ('comunicaciones', 'Piezas gráficas y diseño', 10),
  ('comunicaciones', 'Audiovisual', 20),
  ('comunicaciones', 'Web y publicaciones', 30),
  ('comunicaciones', 'Eventos y branding', 40);

-- Dominio 3: Infraestructura
insert into public.ticket_categories (dominio, subcategoria, orden) values
  ('infraestructura', 'Eléctrica', 10),
  ('infraestructura', 'Hidrosanitaria', 20),
  ('infraestructura', 'Carpintería y mobiliario', 30),
  ('infraestructura', 'Obra civil y mantenimiento locativo', 40);

-- Dominio 4: General
insert into public.ticket_categories (dominio, subcategoria, orden) values
  ('general', 'Sin clasificar / Otros', 10);
