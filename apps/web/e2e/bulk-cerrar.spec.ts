// H16 + H10 — cerrar en lote con confirmación (técnico).
// Usa tickets reales del técnico de pruebas; si no tiene, pasa por rama vacía.
import { test, expect } from '@playwright/test';
import { credenciales, loginComo } from './helpers';

const C = credenciales('E2E_TECNICO');
test.skip(!C, 'Requiere E2E_TECNICO_USER / E2E_TECNICO_PASS');

test('selección en lote cierra con solución y muestra resultado', async ({ page }) => {
  await loginComo(page, C!.user, C!.pass);
  await expect(page.getByText(/Sin tickets asignados|Bandeja asignada/)).toBeVisible({ timeout: 20_000 });
  if (await page.getByText('Sin tickets asignados').isVisible()) {
    await expect(page.getByText('Sin tickets asignados')).toBeVisible();
    return;
  }
  await page.getByLabel('Selección en lote').click();
  await page.getByRole('checkbox').first().click();
  await expect(page.getByText(/seleccionados/)).toBeVisible();
  await page.getByLabel('Cerrar en lote').click();
  await page.getByLabel('Solución del lote').fill('Solución aplicada en lote E2E');
  await page.getByLabel('Confirmar lote').click();
  await expect(page.getByLabel('Resultado del lote')).toBeVisible({ timeout: 30_000 });
});
