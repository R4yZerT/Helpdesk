// H16 — filtros de bandeja técnico (búsqueda + limpiar).
import { test, expect } from '@playwright/test';
import { credenciales, loginComo } from './helpers';

const C = credenciales('E2E_TECNICO');
test.skip(!C, 'Requiere E2E_TECNICO_USER / E2E_TECNICO_PASS');

test('búsqueda sin resultados vacía la lista y limpiar restaura', async ({ page }) => {
  await loginComo(page, C!.user, C!.pass);
  await expect(page.getByText('Bandeja asignada')).toBeVisible({ timeout: 20_000 });
  await page.getByLabel('Buscar bandeja técnico').fill('zzz-inexistente-123');
  await expect(page.getByText('Sin tickets asignados')).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('Limpiar búsqueda').click();
  await expect(page.getByText('resultados')).toBeVisible({ timeout: 15_000 });
});
