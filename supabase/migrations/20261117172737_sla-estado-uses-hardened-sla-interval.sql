-- Evita leer directamente la tabla privada de configuracion SLA.
CREATE OR REPLACE FUNCTION public.sla_estado(
  p_creado_en timestamptz,
  p_prioridad public.prioridad_ticket,
  p_estado public.estado_ticket,
  p_sla_vence_en timestamptz,
  p_fecha_resolucion timestamptz
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_estado IN ('cerrado', 'solucionado') THEN
      CASE
        WHEN COALESCE(p_fecha_resolucion, pg_catalog.now()) <= COALESCE(
          p_sla_vence_en,
          p_creado_en + public.sla_interval(p_prioridad)
        ) THEN 'cumplido'
        ELSE 'vencido_tarde'
      END
    WHEN pg_catalog.now() > COALESCE(
      p_sla_vence_en,
      p_creado_en + public.sla_interval(p_prioridad)
    ) THEN 'vencido'
    WHEN pg_catalog.now() >= COALESCE(
      p_sla_vence_en,
      p_creado_en + public.sla_interval(p_prioridad)
    ) - pg_catalog.make_interval(
      mins => LEAST(
        60,
        EXTRACT(EPOCH FROM public.sla_interval(p_prioridad))::integer / 240
      )
    ) THEN 'por_vencer'
    ELSE 'vigente'
  END;
$$;

REVOKE ALL ON FUNCTION public.sla_estado(
  timestamptz,
  public.prioridad_ticket,
  public.estado_ticket,
  timestamptz,
  timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sla_estado(
  timestamptz,
  public.prioridad_ticket,
  public.estado_ticket,
  timestamptz,
  timestamptz
) TO authenticated, service_role;
