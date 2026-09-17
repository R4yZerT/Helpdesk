-- RF-22 telemetría: vista de métricas del feedback loop IA + invoker seguro.
-- security_invoker=true: la vista respeta el RLS del consultante sobre
-- ticket_ia_feedback (jefe/admin ven todo; técnico solo sus tickets).
-- Requiere Postgres 15+ (Supabase Cloud OK).

create or replace view public.metricas_ia_feedback as
select
  f.fuente,
  count(*)::int as total,
  count(*) filter (where f.estado = 'pendiente')::int as pendientes,
  count(*) filter (where f.estado = 'confirmada')::int as confirmadas,
  count(*) filter (where f.estado = 'corregida')::int as corregidas,
  case
    when count(*) filter (where f.estado in ('confirmada', 'corregida')) = 0 then null
    else round(
      (count(*) filter (where f.estado = 'confirmada'))::numeric
      / (count(*) filter (where f.estado in ('confirmada', 'corregida'))), 4)
  end as precision_validada,
  round(avg(f.confianza), 4) as confianza_promedio,
  max(f.validado_en) as ultima_validacion
from public.ticket_ia_feedback f
group by f.fuente;

comment on view public.metricas_ia_feedback is
  'Telemetría del loop IA (RF-22): volumen y precisión por fuente (beto/reglas/manual). precision_validada = confirmadas / validadas.';

alter view public.metricas_ia_feedback set (security_invoker = true);

-- La vista dataset hereda el mismo criterio: invoker del consultante, no owner.
alter view public.dataset_entrenamiento_ia set (security_invoker = true);

grant select on public.metricas_ia_feedback to authenticated;
grant select on public.dataset_entrenamiento_ia to authenticated;
