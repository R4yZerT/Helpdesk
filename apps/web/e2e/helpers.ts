// H16 — helpers E2E. Credenciales por rol vía env (skip sin ellas):
// E2E_TEST_USER/PASS (empleado), E2E_TECNICO_USER/PASS (técnico),
// E2E_JEFE_USER/PASS (jefe), E2E_ADMIN_USER/PASS (administrador).
import { expect, type Page } from '@playwright/test';

export function credenciales(prefijo: string): { user: string; pass: string } | null {
  const user = process.env[`${prefijo}_USER`] ?? '';
  const pass = process.env[`${prefijo}_PASS`] ?? '';
  return user && pass ? { user, pass } : null;
}

export async function loginComo(page: Page, user: string, pass: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Cédula o correo').fill(user);
  await page.getByLabel('Contraseña', { exact: true }).fill(pass);
  await page.getByLabel('Ingresar').click();
}

// Abre el primer ticket de la bandeja; retorna false si no hay ninguno.
export async function abrirPrimerTicket(page: Page): Promise<boolean> {
  await expect(page.getByText(/Sin tickets asignados|Bandeja asignada/)).toBeVisible({ timeout: 20_000 });
  if (await page.getByText('Sin tickets asignados').isVisible()) return false;
  await page.getByRole('button', { name: /^Ticket #/ }).first().click();
  await expect(page.getByText('Acciones de campo')).toBeVisible({ timeout: 20_000 });
  return true;
}
