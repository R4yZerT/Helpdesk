// H16 — transición exige solución (validación determinista, sin mutar datos).
import { test, expect } from '@playwright/test';
import { abrirPrimerTicket, credenciales, loginComo } from './helpers';

const C = credenciales('E2E_TECNICO');
test.skip(!C, 'Requiere E2E_TECNICO_USER / E2E_TECNICO_PASS');

test('panel de transición pide la solución', async ({ page }) => {
  await loginComo(page, C!.user, C!.pass);
  if (!(await abrirPrimerTicket(page))) return;
  await page.getByText('Solucionar incidente').click();
  await expect(page.getByText('Ocultar transición')).toBeVisible();
  await expect(page.getByPlaceholder('Describe la solución (requerida para solucionado)')).toBeVisible();
});
