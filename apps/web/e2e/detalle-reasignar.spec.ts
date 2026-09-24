// H16 — reasignar vacío muestra validación (sin mutar datos).
import { test, expect } from '@playwright/test';
import { abrirPrimerTicket, credenciales, loginComo } from './helpers';

const C = credenciales('E2E_TECNICO');
test.skip(!C, 'Requiere E2E_TECNICO_USER / E2E_TECNICO_PASS');

test('reasignar sin destino exige técnico o mesa', async ({ page }) => {
  await loginComo(page, C!.user, C!.pass);
  if (!(await abrirPrimerTicket(page))) return;
  await page.getByText('Reasignar').click();
  await page.getByText('Confirmar reasignación').click();
  await expect(page.getByText('Ingresa técnico UUID o mesa ID')).toBeVisible();
});
