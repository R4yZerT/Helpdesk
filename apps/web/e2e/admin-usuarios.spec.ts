// H16 — admin usuarios: lista + export (solo lectura).
import { test, expect } from '@playwright/test';
import { credenciales, loginComo } from './helpers';

const C = credenciales('E2E_ADMIN');
test.skip(!C, 'Requiere E2E_ADMIN_USER / E2E_ADMIN_PASS');

test('lista de usuarios y export CSV', async ({ page }) => {
  await loginComo(page, C!.user, C!.pass);
  await page.getByText('USUARIOS').click();
  await expect(page.getByText('Usuarios').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('Exportar CSV usuarios')).toBeVisible();
});
