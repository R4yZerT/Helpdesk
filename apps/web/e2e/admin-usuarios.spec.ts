// H16 — admin usuarios: lista + export (solo lectura).
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { credenciales, loginComo } from './helpers';

const C = credenciales('E2E_ADMIN');
test.skip(!C, 'Requiere E2E_ADMIN_USER / E2E_ADMIN_PASS');

test('admin lista usuarios y descarga CSV de tickets de su dependencia', async ({ page }) => {
  await loginComo(page, C!.user, C!.pass);
  await page.getByText('USUARIOS').click();
  await expect(page.getByText('Usuarios').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('Exportar CSV usuarios')).toBeVisible();

  await page.getByText('MESAS', { exact: true }).click();
  await expect(page.getByText('Mesas', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  const busqueda = page.getByPlaceholder('Buscar por ticket (#, asunto)');
  await expect(busqueda).toBeVisible();
  const dimensionesBusqueda = await busqueda.boundingBox();
  expect(dimensionesBusqueda?.height).toBeLessThan(80);
  const exportarCsv = page.locator('[aria-label="Exportar CSV tickets de mi dependencia"]:visible');
  await expect(exportarCsv).toBeVisible();
  const descarga = page.waitForEvent('download', { timeout: 10_000 }).catch(() => null);
  await exportarCsv.click();
  await expect(page.getByText(/CSV listo|CSV generado|Error al exportar CSV/)).toBeVisible({ timeout: 20_000 });
  const errorExportacion = page.getByText('Error al exportar CSV', { exact: true });
  if (await errorExportacion.isVisible()) {
    const mensaje = await errorExportacion.locator('xpath=../..').innerText();
    throw new Error(`Falló la exportación: ${mensaje}`);
  }
  const archivo = await descarga;
  if (!archivo) throw new Error('El botón no inició la descarga del CSV.');
  expect(archivo.suggestedFilename()).toMatch(/^admin-mesa-tickets-\d{4}-\d{2}-\d{2}\.csv$/);
  const ruta = await archivo.path();
  expect(ruta).not.toBeNull();
  const contenido = await readFile(ruta!, 'utf8');
  const encabezado = contenido.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0];
  expect(encabezado).toBe('"numero","asunto","estado","prioridad","tecnico"');
});
