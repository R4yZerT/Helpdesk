// H16 — Flujo crítico crear → ver en lista → cancelar.
// Requiere usuario de pruebas (escribe datos reales): solo corre con
// E2E_TEST_USER y E2E_TEST_PASSWORD. El ticket se cancela al final (limpieza).
import { test, expect } from '@playwright/test';

const USER = process.env.E2E_TEST_USER ?? '';
const PASS = process.env.E2E_TEST_PASSWORD ?? '';

test.skip(!USER || !PASS, 'Requiere E2E_TEST_USER / E2E_TEST_PASSWORD');

test('crear solicitud aparece en Mis solicitudes y se cancela', async ({ page }) => {
  const asunto = `E2E wifi aula ${Date.now()}`;

  await page.goto('/');
  await page.getByLabel('Cédula o correo').fill(USER);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASS);
  await page.getByLabel('Ingresar').click();
  await expect(page.getByLabel('Crear nueva solicitud')).toBeVisible({ timeout: 20_000 });

  await page.getByLabel('Crear nueva solicitud').click();
  await page.getByPlaceholder('Ej: No enciende el equipo del aula 301').fill(asunto);
  await page.getByPlaceholder(/Describe el problema con detalle/).fill('El wifi se cae cada 10 minutos desde ayer, probado en varios equipos del aula');
  await page.getByLabel('Crear solicitud').click();

  // Vuelve a la lista y el ticket aparece
  await expect(page.getByText(asunto)).toBeVisible({ timeout: 20_000 });

  // Abre el detalle y cancela (limpieza)
  await page.getByText(asunto).click();
  await expect(page.getByText('Cancelar solicitud')).toBeVisible({ timeout: 15_000 });
  await page.getByText('Cancelar solicitud').click();
  await page.getByText('Sí, cerrar').click();
  await expect(page.getByText(asunto)).not.toBeVisible({ timeout: 15_000 });
});
