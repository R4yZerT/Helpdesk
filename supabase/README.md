# supabase/

Configuracion y backend de Supabase. Este directorio es lo que se importa
al crear el proyecto en el dashboard de Supabase.

## Estructura

- `config.toml` — configuracion del proyecto (CLI / GitHub import).
- `migrations/` — esquema de la base de datos, versionado en orden.
  - `*_ticket_categories.sql` — tabla maestra de categorias + inserts.
  - `*_schema_inicial.sql` — enums, tablas, RLS, triggers e indices.
- `functions/classify/` — Edge Function de clasificacion IA (RF-22), stub.
- `seed.sql` — datos de desarrollo (opcional).

## Flujo de trabajo

1. Crear el proyecto en Supabase (dashboard) e importar este repositorio.
2. `supabase link --project-ref <ref>` para conectar el CLI local.
3. `supabase db push` para aplicar las migraciones al proyecto remoto.
4. La IA predictiva (RF-19/20/21) corre como batch via `pg_cron`
   (se agrega en una migracion posterior); el dashboard lee tablas, no el modelo.