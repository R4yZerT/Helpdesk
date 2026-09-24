// H16 — adjunto inválido muestra validación client-side (empleado, sin subir).
import { test, expect } from '@playwright/test';
import { credenciales, loginComo } from './helpers';

const C = credenciales('E2E_TEST');
test.skip(!C, 'Requiere E2E_TEST_USER / E2E_TEST_PASS');

test('archivo .txt es rechazado antes de subir', async ({ page }) => {
  await loginComo(page, C!.user, C!.pass);
  await expect(page.getByLabel('Crear nueva solicitud')).toBeVisible({ timeout: 20_000 });
  await page.getByLabel('Crear nueva solicitud').click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'nota.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('no permitido'),
  });
  await expect(page.getByText(/Solo imágenes/)).toBeVisible();
});
