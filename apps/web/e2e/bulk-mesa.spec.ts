// H16 + H10 — cambiar mesa en lote (técnico).
import { test, expect } from '@playwright/test';
import { credenciales, loginComo } from './helpers';

const C = credenciales('E2E_TECNICO');
test.skip(!C, 'Requiere E2E_TECNICO_USER / E2E_TECNICO_PASS');

test('selección en lote cambia de mesa con confirmación', async ({ page }) => {
  await loginComo(page, C!.user, C!.pass);
  await expect(page.getByText(/Sin tickets asignados|Bandeja asignada/)).toBeVisible({ timeout: 20_000 });
  if (await page.getByText('Sin tickets asignados').isVisible()) {
    await expect(page.getByText('Sin tickets asignados')).toBeVisible();
    return;
  }
  await page.getByLabel('Selección en lote').click();
  await page.getByRole('checkbox').first().click();
  await page.getByLabel('Cambiar mesa en lote').click();
  await page.getByLabel(/Mesa destino/).first().click();
  await page.getByLabel('Confirmar lote').click();
  await expect(page.getByLabel('Resultado del lote')).toBeVisible({ timeout: 30_000 });
});
