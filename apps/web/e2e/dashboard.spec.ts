// H16 — dashboard jefe: KPIs + export CSV (solo lectura).
import { test, expect } from '@playwright/test';
import { credenciales, loginComo } from './helpers';

const C = credenciales('E2E_JEFE');
test.skip(!C, 'Requiere E2E_JEFE_USER / E2E_JEFE_PASS');

test('KPIs visibles y export CSV avisa', async ({ page }) => {
  await loginComo(page, C!.user, C!.pass);
  await expect(page.getByText('Tickets abiertos')).toBeVisible({ timeout: 20_000 });
  await page.getByText('Exportar CSV').click();
  await expect(page.getByText(/CSV listo|CSV generado/)).toBeVisible({ timeout: 20_000 });
});
