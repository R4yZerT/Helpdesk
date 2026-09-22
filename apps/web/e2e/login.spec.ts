// H16 — Login: render, validación local y credenciales inválidas (solo lectura).
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('muestra el formulario de acceso', async ({ page }) => {
  await expect(page.getByText('Inicia sesión')).toBeVisible();
  await expect(page.getByLabel('Cédula o correo')).toBeVisible();
  await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Ingresar')).toBeVisible();
});

test('envío vacío muestra validación local', async ({ page }) => {
  await page.getByLabel('Ingresar').click();
  await expect(page.getByText('Cédula/correo y contraseña requeridos')).toBeVisible();
});

test('credenciales inválidas muestran alerta', async ({ page }) => {
  await page.getByLabel('Cédula o correo').fill('nadie@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-incorrecta-123');
  await page.getByLabel('Ingresar').click();
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
});
