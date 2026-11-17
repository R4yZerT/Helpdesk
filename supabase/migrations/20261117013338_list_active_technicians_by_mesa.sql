CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, service_role;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.list_active_technicians_by_mesa_impl(p_mesa_id integer)
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT technician.id, COALESCE(technician.full_name, 'Técnico')
  FROM public.profiles AS technician
  JOIN public.mesas AS mesa ON mesa.id = technician.mesa_id
  WHERE p_mesa_id IS NOT NULL
    AND mesa.id = p_mesa_id
    AND mesa.activa IS TRUE
    AND technician.rol = 'tecnico'
    AND technician.activo IS TRUE
    AND (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS requester
      WHERE requester.id = (SELECT auth.uid())
        AND requester.activo IS TRUE
    )
  ORDER BY technician.full_name NULLS LAST, technician.id;
$$;

REVOKE ALL ON FUNCTION private.list_active_technicians_by_mesa_impl(integer)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.list_active_technicians_by_mesa_impl(integer)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.list_active_technicians_by_mesa(p_mesa_id integer)
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT technician.id, technician.full_name
  FROM private.list_active_technicians_by_mesa_impl(p_mesa_id) AS technician;
$$;

REVOKE ALL ON FUNCTION public.list_active_technicians_by_mesa(integer)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.list_active_technicians_by_mesa(integer)
  TO authenticated;

COMMENT ON FUNCTION public.list_active_technicians_by_mesa(integer) IS
  'Lista solo el id y nombre de técnicos activos de una mesa activa para usuarios autenticados y activos.';

NOTIFY pgrst, 'reload schema';
