// H16 — validación client-side de crear solicitud (empleado).
import { test, expect } from '@playwright/test';
import { credenciales, loginComo } from './helpers';

const C = credenciales('E2E_TEST');
test.skip(!C, 'Requiere E2E_TEST_USER / E2E_TEST_PASS');

test('asunto corto muestra error sin enviar', async ({ page }) => {
  await loginComo(page, C!.user, C!.pass);
  await expect(page.getByLabel('Crear nueva solicitud')).toBeVisible({ timeout: 20_000 });
  await page.getByLabel('Crear nueva solicitud').click();
  await page.getByPlaceholder('Ej: No enciende el equipo del aula 301').fill('abc');
  await page.getByPlaceholder(/Describe el problema con detalle/).fill('Descripción suficientemente larga para pasar la validación mínima');
  await page.getByLabel('Crear solicitud').click();
  await expect(page.getByText('Asunto mínimo 5 caracteres')).toBeVisible();
});
