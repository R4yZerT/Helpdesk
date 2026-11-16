// H16 — Flujo crítico crear → ver en lista → comprobar autoasignación/cola.
// Requiere un usuario de pruebas; puede dejar un ticket asignado que no se
// puede cancelar desde el portal.
import { test, expect } from '@playwright/test';

const USER = process.env.E2E_TEST_USER ?? '';
const PASS = process.env.E2E_TEST_PASSWORD ?? '';

test.skip(!USER || !PASS, 'Requiere E2E_TEST_USER / E2E_TEST_PASSWORD');

test('crear solicitud aparece y refleja técnico asignado o cola', async ({ page }) => {
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

  // Abre el detalle y verifica el resultado de la asignación automática.
  await page.getByText(asunto).click();
  const tecnicoLabel = page.getByText('Técnico', { exact: true });
  await expect(tecnicoLabel).toBeVisible({ timeout: 15_000 });
  const tecnicoValue = tecnicoLabel.locator('xpath=following-sibling::*[1]');
  const asignacion = (await tecnicoValue.innerText()).trim();
  expect(asignacion).not.toBe('');

  if (asignacion === 'Sin asignar') {
    await expect(page.getByText('Cancelar solicitud')).toBeVisible();
    await page.getByText('Cancelar solicitud').click();
    await page.getByText('Sí, cerrar').click();
    await expect(page.getByText(asunto)).not.toBeVisible({ timeout: 15_000 });
  } else {
    await expect(page.getByText('Cancelar solicitud')).toHaveCount(0);
  }
});
