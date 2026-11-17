-- Prepara el valor requerido por la migración RF-19 siguiente.
-- En una migración separada, PostgreSQL confirma el nuevo valor antes de usarlo.
alter type public.tipo_alerta_ia add value if not exists 'pico_esperado';
