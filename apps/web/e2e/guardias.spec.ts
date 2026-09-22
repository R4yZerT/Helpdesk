// H16 — Guardias fail-closed: sin sesión siempre cae al login (solo lectura).
import { test, expect } from '@playwright/test';

test('sin sesión la raíz muestra el login', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Inicia sesión')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Mis solicitudes')).not.toBeVisible();
});
