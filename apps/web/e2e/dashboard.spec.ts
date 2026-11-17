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

test('jefe vuelve al dashboard desde solicitud y alertas IA', async ({ page }) => {
  test.setTimeout(90_000);
  await loginComo(page, C!.user, C!.pass);
  const dashboardKpi = page.getByText('Tickets abiertos', { exact: true });
  const errorNavegacion = page.getByText('La navegación no pudo cargarse', { exact: true });

  await expect(dashboardKpi).toBeVisible({ timeout: 20_000 });
  await page.getByLabel('Nueva solicitud').click();
  await expect(page.getByLabel('Crear solicitud')).toBeVisible({ timeout: 20_000 });
  await page.getByLabel('Dashboard').click();
  await expect(dashboardKpi).toBeVisible({ timeout: 20_000 });
  await expect(errorNavegacion).toHaveCount(0);

  await page.getByLabel('Alertas IA').click();
  await expect(page.getByRole('button', { name: 'Generar alertas' })).toBeVisible({ timeout: 20_000 });
  await page.getByLabel('Dashboard').click();
  await expect(dashboardKpi).toBeVisible({ timeout: 20_000 });
  await expect(errorNavegacion).toHaveCount(0);
});
