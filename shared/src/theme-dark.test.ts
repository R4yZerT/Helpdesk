// H13 — Paridad de forma entre paleta clara y oscura.
import { describe, expect, it } from 'vitest';
import { darkTheme, theme, THEME_STORAGE_KEY } from './ui/theme.js';

describe('darkTheme', () => {
  it('mismos keys de color que theme', () => {
    expect(Object.keys(darkTheme.colors).sort()).toEqual(Object.keys(theme.colors).sort());
  });
  it('superficies oscuras y texto claro', () => {
    expect(darkTheme.colors.bg).not.toBe(theme.colors.bg);
    expect(darkTheme.colors.surface).not.toBe(theme.colors.surface);
    expect(darkTheme.colors.text).not.toBe(theme.colors.text);
  });
  it('brand intacto', () => {
    expect(darkTheme.colors.accent).toBe(theme.colors.accent);
  });
  it('clave de persistencia versionada', () => {
    expect(THEME_STORAGE_KEY).toBe('theme.scheme.v1');
  });
});
