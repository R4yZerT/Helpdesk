BEGIN;

SELECT plan(18);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.hibp_cache'::regclass),
  'RLS está activado en hibp_cache'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.sla_config'::regclass),
  'RLS está activado en sla_config'
);

SELECT ok(NOT has_table_privilege('anon', 'public.hibp_cache', 'SELECT'), 'anon no puede leer hibp_cache');
SELECT ok(NOT has_table_privilege('authenticated', 'public.hibp_cache', 'SELECT'), 'authenticated no puede leer hibp_cache');
SELECT ok(NOT has_table_privilege('anon', 'public.hibp_cache', 'INSERT'), 'anon no puede insertar en hibp_cache');
SELECT ok(NOT has_table_privilege('authenticated', 'public.hibp_cache', 'INSERT'), 'authenticated no puede insertar en hibp_cache');
SELECT ok(NOT has_table_privilege('anon', 'public.sla_config', 'SELECT'), 'anon no puede leer sla_config');
SELECT ok(NOT has_table_privilege('authenticated', 'public.sla_config', 'SELECT'), 'authenticated no puede leer sla_config');
SELECT ok(NOT has_table_privilege('anon', 'public.sla_config', 'INSERT'), 'anon no puede insertar en sla_config');
SELECT ok(NOT has_table_privilege('authenticated', 'public.sla_config', 'INSERT'), 'authenticated no puede insertar en sla_config');

SELECT ok(has_table_privilege('service_role', 'public.hibp_cache', 'SELECT'), 'service_role conserva acceso a hibp_cache');
SELECT ok(has_table_privilege('service_role', 'public.sla_config', 'SELECT'), 'service_role conserva acceso a sla_config');

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.sla_estado(timestamptz,public.prioridad_ticket,public.estado_ticket,timestamptz,timestamptz)'::regprocedure,
    'EXECUTE'
  ),
  'anon no puede ejecutar sla_estado'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.sla_estado(timestamptz,public.prioridad_ticket,public.estado_ticket,timestamptz,timestamptz)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated puede ejecutar sla_estado'
);
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.sla_estado(timestamptz,public.prioridad_ticket,public.estado_ticket,timestamptz,timestamptz)'::regprocedure,
    'EXECUTE'
  ),
  'service_role puede ejecutar sla_estado'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.dashboard_snapshot_filtrado(timestamptz,timestamptz,integer[],integer,public.estado_ticket,public.prioridad_ticket,uuid)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated puede ejecutar dashboard_snapshot_filtrado'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.dashboard_snapshot_filtrado(timestamptz,timestamptz,integer[],integer,public.estado_ticket,public.prioridad_ticket,uuid)'::regprocedure,
    'EXECUTE'
  ),
  'anon no puede ejecutar dashboard_snapshot_filtrado'
);

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.sla_estado(
    now(),
    'media'::public.prioridad_ticket,
    'abierto'::public.estado_ticket,
    NULL,
    NULL
  );
END;
$$;
RESET ROLE;
SELECT pass('sla_estado funciona sin acceso directo a sla_config');

SELECT * FROM finish();
ROLLBACK;
