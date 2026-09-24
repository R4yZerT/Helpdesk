// H16 — validación del login sin backend (corre en chromium + mobile).
import { test, expect } from '@playwright/test';

test('enviar vacío exige credenciales', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Ingresar').click();
  await expect(page.getByText('Cédula/correo y contraseña requeridos')).toBeVisible();
});

test('solo contraseña también exige credenciales', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Contraseña', { exact: true }).fill('secreta');
  await page.getByLabel('Ingresar').click();
  await expect(page.getByText('Cédula/correo y contraseña requeridos')).toBeVisible();
});

test('enlace de recuperación visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('¿Olvidaste tu contraseña?')).toBeVisible();
});
