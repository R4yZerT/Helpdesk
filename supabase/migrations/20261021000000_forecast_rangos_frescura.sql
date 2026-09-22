-- Forecast B+C+A: rangos q10–q90, frescura (generado_en) y recall de alerta.
-- 1) Columnas de rango + frescura en pronosticos_picos (upload las puebla).
alter table public.pronosticos_picos
  add column if not exists lo numeric,
  add column if not exists hi numeric,
  add column if not exists generado_en timestamptz;

-- 2) Alerta con recall: dispara en es_pico (alta|pico), no solo en nivel='pico'.
--    Severidad: pico mantiene critica/alta (notifica por push); alta -> media
--    (visible en dashboard sin spam de push). El mensaje incluye el rango.
create or replace function public.generar_alertas_pronostico()
returns table (insertados bigint)
language plpgsql security definer set search_path = public as $$
declare v_n bigint := 0;
begin
  with proximos as (
    select p.fecha, p.serie, p.forecast, p.lo, p.hi, p.nivel, p.modelo_version
    from public.pronosticos_picos p
    where p.fecha between current_date and current_date + 2
      and p.es_pico
      and not exists (
        select 1 from public.alertas_ia a
        where a.tipo = 'pico_esperado'::public.tipo_alerta_ia
          and a.estado = 'nueva'
          and a.mensaje like '%' || p.fecha::text || '%'
          and a.creado_en > now() - interval '24 hours'
      )
  )
  insert into public.alertas_ia (tipo, mensaje, severidad, estado)
  select
    'pico_esperado'::public.tipo_alerta_ia,
    format('Pico esperado %s (%s): ~%s tickets [rango %s–%s, modelo %s]',
      pr.fecha::text, pr.serie, round(pr.forecast)::int,
      round(coalesce(pr.lo, pr.forecast))::int, round(coalesce(pr.hi, pr.forecast))::int,
      pr.modelo_version),
    case
      when pr.nivel = 'pico' and pr.forecast >= 100 then 'critica'
      when pr.nivel = 'pico' then 'alta'
      else 'media'
    end,
    'nueva'
  from proximos pr;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  return query select v_n;
end; $$;
