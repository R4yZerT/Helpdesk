// RF-22 despliegue BETO — regresión: empaquetado prod + telemetría.
// Verifica la forma de los artefactos: si alguien elimina el servicio beto,
// la vista de métricas o el cableado EXPO_PUBLIC_BETO_URL, este test falla.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function repo(rel: string): string {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
}

describe('BETO prod: imagen y compose', () => {
  it('ml/Dockerfile sirve serve.py en CPU como non-root con healthcheck', () => {
    const d = repo('ml/Dockerfile');
    expect(d).toContain('serve.py');
    expect(d).toMatch(/download\.pytorch\.org\/whl\/cpu/);
    expect(d).toContain('USER beto');
    expect(d).toContain('HEALTHCHECK');
    expect(d).toContain('8001');
  });

  it('ml/requirements-serve.txt pinea inferencia (sin torch de PyPI)', () => {
    const r = repo('ml/requirements-serve.txt');
    expect(r).toContain('transformers==');
    expect(r).toContain('fastapi==');
    expect(r).toContain('uvicorn');
    expect(r).not.toMatch(/^torch==/m);
  });

  it('compose levanta beto con modelo read-only y web lo espera', () => {
    const c = repo('docker-compose.yml');
    expect(c).toMatch(/beto:/);
    expect(c).toContain('ml/Dockerfile');
    expect(c).toContain('/model:ro');
    expect(c).toContain('service_healthy');
    expect(c).toContain('EXPO_PUBLIC_BETO_URL');
  });
});

describe('BETO prod: cableado web y env', () => {
  it('apps/web/Dockerfile hornea EXPO_PUBLIC_BETO_URL', () => {
    const d = repo('apps/web/Dockerfile');
    expect(d).toContain('ARG EXPO_PUBLIC_BETO_URL');
    expect(d).toContain('ENV EXPO_PUBLIC_BETO_URL=');
  });

  it('.env.example documenta EXPO_PUBLIC_BETO_URL', () => {
    expect(repo('.env.example')).toContain('EXPO_PUBLIC_BETO_URL=');
  });
});

describe('RF-22 telemetría: vista metricas_ia_feedback', () => {
  it('agrega por fuente con precisión validada', () => {
    const sql = repo('supabase/migrations/20261019000000_metricas_ia_feedback.sql');
    expect(sql).toContain('metricas_ia_feedback');
    expect(sql).toContain('precision_validada');
    expect(sql).toContain('confianza_promedio');
    expect(sql).toMatch(/group by f\.fuente/);
  });

  it('usa security_invoker (RLS del consultante, no del owner)', () => {
    const sql = repo('supabase/migrations/20261019000000_metricas_ia_feedback.sql');
    expect(sql).toContain('security_invoker = true');
    expect(sql).toContain('dataset_entrenamiento_ia set (security_invoker = true)');
  });
});
