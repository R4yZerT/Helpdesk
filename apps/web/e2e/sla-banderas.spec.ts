// H16 — SLA visible en detalle (solo lectura).
import { test, expect } from '@playwright/test';
import { abrirPrimerTicket, credenciales, loginComo } from './helpers';

const C = credenciales('E2E_TECNICO');
test.skip(!C, 'Requiere E2E_TECNICO_USER / E2E_TECNICO_PASS');

test('detalle muestra estado SLA', async ({ page }) => {
  await loginComo(page, C!.user, C!.pass);
  if (!(await abrirPrimerTicket(page))) return;
  await expect(page.getByText(/restantes|Cumplido/)).toBeVisible({ timeout: 15_000 });
});
