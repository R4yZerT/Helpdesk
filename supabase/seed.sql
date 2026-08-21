-- Seed de desarrollo — HelpDesk Mesa de Servicio
-- Uso: `supabase db reset` lo aplica automáticamente tras las migraciones.
-- Idempotente: ON CONFLICT evita duplicados si ya existen por migración.

-- 1. Mesas de servicio (RF-29)
insert into public.mesas (nombre) values
  ('TIC'),
  ('Comunicaciones'),
  ('Infraestructura'),
  ('EAPSA')
on conflict (nombre) do nothing;

-- 2. Categorías normalizadas (19 filas, 4 dominios)
--    Duplica migración 20260820150246 con ON CONFLICT para que `db reset` no falle
insert into public.ticket_categories (dominio, subcategoria, orden) values
  -- TIC (10)
  ('tic', 'Gestión de usuarios', 10),
  ('tic', 'Permisos y accesos', 20),
  ('tic', 'Contraseñas y seguridad', 30),
  ('tic', 'Correo electrónico', 40),
  ('tic', 'Conectividad y redes', 50),
  ('tic', 'Equipos y hardware', 60),
  ('tic', 'Impresoras y escáneres', 70),
  ('tic', 'Software y aplicaciones', 80),
  ('tic', 'Datos y respaldos', 90),
  ('tic', 'Soporte y aplicaciones institucionales', 100),
  -- Comunicaciones (4)
  ('comunicaciones', 'Piezas gráficas y diseño', 10),
  ('comunicaciones', 'Audiovisual', 20),
  ('comunicaciones', 'Web y publicaciones', 30),
  ('comunicaciones', 'Eventos y branding', 40),
  -- Infraestructura (4)
  ('infraestructura', 'Eléctrica', 10),
  ('infraestructura', 'Hidrosanitaria', 20),
  ('infraestructura', 'Carpintería y mobiliario', 30),
  ('infraestructura', 'Obra civil y mantenimiento locativo', 40),
  -- General (1)
  ('general', 'Sin clasificar / Otros', 10)
on conflict (dominio, subcategoria) do nothing;
