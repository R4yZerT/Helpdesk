// H16 — comentar en detalle técnico.
import { test, expect } from '@playwright/test';
import { abrirPrimerTicket, credenciales, loginComo } from './helpers';

const C = credenciales('E2E_TECNICO');
test.skip(!C, 'Requiere E2E_TECNICO_USER / E2E_TECNICO_PASS');

test('enviar avance publica el comentario', async ({ page }) => {
  await loginComo(page, C!.user, C!.pass);
  if (!(await abrirPrimerTicket(page))) return;
  const texto = `Avance E2E ${Date.now()}`;
  await page.getByLabel('Mensaje del comentario').fill(texto);
  await page.getByLabel('Enviar comentario').click();
  await expect(page.getByText(texto)).toBeVisible({ timeout: 20_000 });
});
