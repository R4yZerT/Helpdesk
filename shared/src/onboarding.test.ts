// H12 — Lógica pura del onboarding + hook con storage inyectable.
import { describe, expect, it, vi } from 'vitest';
import {
  claveOnboarding,
  debeMostrarOnboarding,
  marcarOnboardingVisto,
  obtenerEstadoOnboarding,
  pasosOnboarding,
  type AlmacenOnboarding,
} from './onboarding.js';

function memoria(valor: string | null = null, falla = false): AlmacenOnboarding & { llamadas: string[] } {
  const llamadas: string[] = [];
  return {
    llamadas,
    getItem: vi.fn(async (k: string) => { llamadas.push(`get:${k}`); if (falla) throw new Error('off'); return valor; }),
    setItem: vi.fn(async (k: string, v: string) => { llamadas.push(`set:${k}=${v}`); if (falla) throw new Error('off'); }),
  };
}

describe('claveOnboarding / debeMostrarOnboarding', () => {
  it('clave versionada', () => {
    expect(claveOnboarding()).toBe('onboarding.v1.visto');
    expect(claveOnboarding(2)).toBe('onboarding.v2.visto');
  });
  it('muestra si ausente o distinto', () => {
    expect(debeMostrarOnboarding(null)).toBe(true);
    expect(debeMostrarOnboarding('0')).toBe(true);
    expect(debeMostrarOnboarding('1')).toBe(false);
  });
});

describe('pasosOnboarding', () => {
  it('base + pasos por rol', () => {
    expect(pasosOnboarding('usuario')).toHaveLength(4);
    expect(pasosOnboarding('tecnico')).toHaveLength(3);
    expect(pasosOnboarding('jefe')).toHaveLength(3);
    expect(pasosOnboarding('administrador')).toHaveLength(3);
  });
  it('ids únicos por rol', () => {
    for (const rol of ['usuario', 'tecnico', 'jefe', 'administrador'] as const) {
      const ids = pasosOnboarding(rol).map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('persistencia', () => {
  it('obtenerEstado refleja lo guardado', async () => {
    expect(await obtenerEstadoOnboarding(memoria(null))).toBe(true);
    expect(await obtenerEstadoOnboarding(memoria('1'))).toBe(false);
  });
  it('storage roto no muestra ni rompe', async () => {
    expect(await obtenerEstadoOnboarding(memoria(null, true))).toBe(false);
    await expect(marcarOnboardingVisto(memoria(null, true))).resolves.toBeUndefined();
  });
  it('marcar guarda versión', async () => {
    const m = memoria(null);
    await marcarOnboardingVisto(m);
    expect(m.llamadas).toContain('set:onboarding.v1.visto=1');
  });
});
