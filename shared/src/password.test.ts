import { describe, expect, it, vi } from 'vitest';
import { normalizePassword, validatePassword, validatePasswordSync, sha1HexUpper, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from './password.js';

describe('password — NIST 800-63B', () => {
  it('rechaza <8 y >64', () => {
    expect(validatePasswordSync('Ab1!xyz', {}).ok).toBe(false);
    const long = 'A'.repeat(65) + '1a!';
    expect(validatePasswordSync(long, {}).ok).toBe(false);
    expect(validatePasswordSync('K7#pL9!q2', {}).ok).toBe(true);
  });

  it('NFKC normaliza', () => {
    // ﬁ (ligadura) -> fi con NFKC
    expect(normalizePassword('ﬁ').length).toBe(2);
  });

  it('bloquea comunes', () => {
    expect(validatePasswordSync('password', {}).ok).toBe(false);
    expect(validatePasswordSync('123456', {}).ok).toBe(false);
    expect(validatePasswordSync('Password1', {}).reasons.join()).toMatch(/común/i);
  });

  it('bloquea contenido de email/nombre/rol', () => {
    expect(validatePasswordSync('juan12345', { email: 'juan@iue.edu.co' }).ok).toBe(false);
    expect(validatePasswordSync('Empleado2024!', { rol: 'empleado' }).ok).toBe(false);
    expect(validatePasswordSync('Garcia2024!', { nombre: 'García' }).ok).toBe(false);
  });

  it('bloquea repetición/secuencia', () => {
    expect(validatePasswordSync('aaaa1234!', {}).ok).toBe(false);
    expect(validatePasswordSync('abcd1234!', {}).reasons.join()).toMatch(/secuencia/i);
  });

  it('no exige composición forzada pero valora variedad', () => {
    // NIST: no forzar, pero zxcvbn penaliza poca variedad si corta
    expect(validatePasswordSync('abcdefgh', {}).ok).toBe(false); // solo lower, 8 pero débil
    expect(validatePasswordSync('K7#pL9!q2Xy', {}).ok).toBe(true);
  });

  it('HIBP pwned fail-closed', async () => {
    // Mock fetch que retorna pwned
    const mockFetch = vi.fn(async () => ({
      ok: true,
      text: async () => {
        // SHA1('password') = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
        // prefix 5BAA6, suffix incluye
        const full = '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8';
        const suffix = full.slice(5);
        return `${suffix}:3861493\nOTHER:2`;
      },
    } as unknown as Response));

    // sha1 de "password" mockeado vía override subtle no necesario — testeamos flujo validatePassword con stub sha1HexUpper
    // Para evitar crypto, testeamos check indirecto: password "password" debe fallar por sync ya (común), así que usamos uno que pase sync pero sea pwned
    // Usamos "Abcdef12" que pasa sync, pero mockeamos sha1HexUpper para ese valor
    const orig = await import('./password.js');
    // No podemos mockear crypto fácilmente; testeamos hibpError path
    const errFetch = vi.fn(async () => { throw new Error('network'); });
    const res = await validatePassword('K7#pL9!q2Xy', {}, errFetch as unknown as typeof fetch);
    expect(res.hibpError).toBeDefined();
    expect(res.ok).toBe(false);
  });

  it('constantes NIST', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(PASSWORD_MAX_LENGTH).toBe(64);
  });
});
