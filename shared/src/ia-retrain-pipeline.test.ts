// RF-22 pipeline de reentrenamiento — regresión: dataset + gate + publicación.
// Verifica la forma del pipeline: si alguien rompe el gate promoted,
// el bucket privado o el workflow mensual, este test falla.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function repo(rel: string): string {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
}

describe('retrain: dataset validado', () => {
  it('build_retrain_dataset.py une histórico + validado con esquema train_beto', () => {
    const s = repo('ml/src/build_retrain_dataset.py');
    expect(s).toContain('--clean');
    expect(s).toContain('--validated');
    expect(s).toContain('--out');
    expect(s).toContain('categoria_label');
    expect(s).toContain('drop_duplicates');
    expect(s).toContain('to_parquet');
  });

  it('export_dataset_validado.py solo exporta confirmada/corregida con esquema puenteable', () => {
    const s = repo('ml/src/export_dataset_validado.py');
    expect(s).toMatch(/confirmada.*corregida|corregida.*confirmada/);
    expect(s).toContain('asunto');
    expect(s).toContain('categoria_nombre');
  });
});

describe('retrain: entrenamiento con gate', () => {
  it('train_beto.py acepta --input y --baseline-metrics con gate promoted', () => {
    const s = repo('ml/src/train_beto.py');
    expect(s).toContain('"--input"');
    expect(s).toContain('"--baseline-metrics"');
    expect(s).toContain('promoted');
    expect(s).toContain('baseline_macro_f1');
  });

  it('ml/baseline_beto.json trae test_macro_f1 de referencia (>= 0.7)', () => {
    const b = JSON.parse(repo('ml/baseline_beto.json')) as { test_macro_f1?: number };
    expect(typeof b.test_macro_f1).toBe('number');
    expect(b.test_macro_f1 as number).toBeGreaterThanOrEqual(0.7);
  });
});

describe('retrain: publicación y workflow', () => {
  it('publish_model.py respeta promoted y sube a modelos-ia con service_role', () => {
    const s = repo('ml/src/publish_model.py');
    expect(s).toContain('promoted');
    expect(s).toContain('--force');
    expect(s).toContain('modelos-ia');
    expect(s).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('migración crea el bucket privado modelos-ia (solo service_role)', () => {
    const m = repo('supabase/migrations/20261020000000_modelos_ia_bucket.sql');
    expect(m).toContain('modelos-ia');
    expect(m).toMatch(/public[\s\S]*false/i);
  });

  it('workflow retrain-beto.yml: mensual + manual, publica solo si promoted', () => {
    const w = repo('.github/workflows/retrain-beto.yml');
    expect(w).toContain('retrain-beto');
    expect(w).toMatch(/cron:\s*'0 5 1 \* \*'/);
    expect(w).toContain('workflow_dispatch');
    expect(w).toContain('build_retrain_dataset.py');
    expect(w).toContain('--baseline-metrics');
    expect(w).toContain('publish_model.py');
  });

  it('docs describen el pipeline de reentrenamiento', () => {
    const d = repo('documentation/modelos-ia.md');
    expect(d).toContain('retrain-beto.yml');
    expect(d).toContain('build_retrain_dataset.py');
    expect(d).toContain('baseline_beto.json');
  });
});
