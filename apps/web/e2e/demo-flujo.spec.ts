// Recorrido demostrativo entre solicitante, técnico y jefatura.
import { expect, test, type Page } from '@playwright/test';
import { credenciales, loginComo } from './helpers';

test.use({ video: 'on', actionTimeout: 20_000 });
test.setTimeout(300_000);

const solicitante = credenciales('E2E_TEST');
const tecnico = credenciales('E2E_TECNICO');
const jefatura = credenciales('E2E_JEFE');
const tecnicoNombre = process.env.E2E_TECNICO_NOMBRE?.trim() ?? '';
const demoMesa = process.env.E2E_DEMO_MESA?.trim() ?? '';
const demoCategoria = process.env.E2E_DEMO_CATEGORIA?.trim() ?? '';
const variablesFaltantes = [
  ...(!solicitante ? ['E2E_TEST_USER/PASS'] : []),
  ...(!tecnico ? ['E2E_TECNICO_USER/PASS'] : []),
  ...(!jefatura ? ['E2E_JEFE_USER/PASS'] : []),
  ...(!tecnicoNombre ? ['E2E_TECNICO_NOMBRE'] : []),
  ...(!demoMesa ? ['E2E_DEMO_MESA'] : []),
  ...(!demoCategoria ? ['E2E_DEMO_CATEGORIA'] : []),
];

test.skip(
  variablesFaltantes.length > 0,
  `Configura las variables necesarias para la demo: ${variablesFaltantes.join(', ')}`,
);

async function cerrarSesion(page: Page): Promise<void> {
  await page.getByLabel('Cerrar sesión').click();
  await expect(page.getByLabel('Ingresar')).toBeVisible({ timeout: 20_000 });
}

async function aceptarMensaje(page: Page, titulo: string): Promise<void> {
  await expect(page.getByText(titulo, { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Entendido' }).click();
}

async function valorKpi(page: Page, etiqueta: string): Promise<number> {
  const tarjeta = page.getByText(etiqueta, { exact: true }).locator('..');
  const textoValor = await tarjeta.getByText(/^\d+$/).innerText();
  return Number(textoValor);
}

async function totalDashboard(page: Page): Promise<number> {
  const tarjeta = page.getByText('Ingresados hoy', { exact: true }).locator('..');
  const delta = await tarjeta.getByText(/^\d+ total$/).innerText();
  return Number(delta.match(/^(\d+) total$/)?.[1]);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('demo end-to-end: ticket, cambios de estado y dashboard por rol', async ({ page }) => {
  const asunto = `Demo E2E HelpDesk ${Date.now()}`;
  const solucion = 'Se reinició el servicio y se verificó la conexión con el usuario.';

  // Capturar la referencia de jefatura antes de crear el ticket.
  await loginComo(page, jefatura!.user, jefatura!.pass);
  await expect(page.getByText('Tickets abiertos', { exact: true })).toBeVisible({ timeout: 30_000 });
  const abiertosIniciales = await valorKpi(page, 'Tickets abiertos');
  const totalInicial = await totalDashboard(page);
  await cerrarSesion(page);

  // El solicitante crea la solicitud y la asigna al técnico configurado.
  await loginComo(page, solicitante!.user, solicitante!.pass);
  await page.getByLabel('Crear nueva solicitud').click();
  await page.getByPlaceholder('Ej: No enciende el equipo del aula 301').fill(asunto);
  await page
    .getByPlaceholder(/Describe el problema con detalle/)
    .fill('El equipo de la sala de reuniones no conecta a la red desde esta mañana.');

  await page.getByRole('button', { name: /^Dependencia \*/ }).click();
  await page.getByRole('button', { name: demoMesa, exact: true }).click();
  await page.getByRole('button', { name: /^Categoría \*/ }).click();
  await page.getByRole('button', { name: new RegExp(`^${escapeRegExp(demoCategoria)} · `) }).click();
  await page.getByRole('button', { name: /^Técnico \(opcional\):/ }).click();
  await page.getByRole('button', { name: tecnicoNombre, exact: true }).click();

  await page.getByLabel('Crear solicitud').click();
  await aceptarMensaje(page, 'Solicitud creada');
  await expect(page.getByText(asunto, { exact: true })).toBeVisible({ timeout: 20_000 });
  await cerrarSesion(page);

  // Mostrar en el tablero de jefatura el ticket que acaba de ingresar.
  await loginComo(page, jefatura!.user, jefatura!.pass);
  await expect.poll(() => valorKpi(page, 'Tickets abiertos'), { timeout: 30_000 }).toBe(abiertosIniciales + 1);
  await expect.poll(() => totalDashboard(page), { timeout: 30_000 }).toBe(totalInicial + 1);
  await cerrarSesion(page);

  // El técnico procesa el ticket desde su bandeja.
  await loginComo(page, tecnico!.user, tecnico!.pass);
  await expect(page.getByLabel('Buscar bandeja técnico')).toBeVisible({ timeout: 20_000 });
  await page.getByLabel('Buscar bandeja técnico').fill(asunto);
  const ticketEnBandeja = page.getByRole('button', {
    name: new RegExp(`^Ticket #.*${escapeRegExp(asunto)}$`),
  });
  await expect(ticketEnBandeja).toBeVisible({ timeout: 30_000 });
  await ticketEnBandeja.click();

  await page.getByRole('button', { name: 'Solucionar Incidente' }).click();
  await page.getByPlaceholder('Describe la solución').fill(solucion);
  await page.getByRole('button', { name: 'En proceso', exact: true }).click();
  await aceptarMensaje(page, 'Estado actualizado');
  await expect(page.getByText('En proceso', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Solucionar Incidente' }).click();
  await page.getByPlaceholder('Describe la solución').fill(solucion);
  await page.getByRole('button', { name: 'Solucionado', exact: true }).click();
  await aceptarMensaje(page, 'Estado actualizado');
  await expect(page.getByText('Solucionado', { exact: true })).toBeVisible();
  await cerrarSesion(page);

  // El solicitante revisa la solución y devuelve el ticket para demostrar la reapertura.
  await loginComo(page, solicitante!.user, solicitante!.pass);
  await expect(page.getByText(asunto, { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByText(asunto, { exact: true }).click();
  await expect(page.getByText('Solucionado', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(solucion, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Devolver al técnico' }).click();
  await aceptarMensaje(page, 'Estado actualizado');
  await expect(page.getByText('Devuelto', { exact: true })).toBeVisible();
  await cerrarSesion(page);

  // El técnico retoma el ticket devuelto, completa el trabajo y propone solución otra vez.
  await loginComo(page, tecnico!.user, tecnico!.pass);
  await page.getByLabel('Buscar bandeja técnico').fill(asunto);
  await expect(ticketEnBandeja).toBeVisible({ timeout: 30_000 });
  await ticketEnBandeja.click();
  await expect(page.getByText('Devuelto', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Solucionar Incidente' }).click();
  await page.getByPlaceholder('Describe la solución').fill(`${solucion} Se repitió la prueba tras la devolución.`);
  await page.getByRole('button', { name: 'En proceso', exact: true }).click();
  await aceptarMensaje(page, 'Estado actualizado');
  await expect(page.getByText('En proceso', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Solucionar Incidente' }).click();
  await page.getByPlaceholder('Describe la solución').fill(`${solucion} Se repitió la prueba tras la devolución.`);
  await page.getByRole('button', { name: 'Solucionado', exact: true }).click();
  await aceptarMensaje(page, 'Estado actualizado');
  await expect(page.getByText('Solucionado', { exact: true })).toBeVisible();
  await cerrarSesion(page);

  // Tras aceptar la segunda solución, el solicitante confirma el cierre.
  await loginComo(page, solicitante!.user, solicitante!.pass);
  await expect(page.getByText(asunto, { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByText(asunto, { exact: true }).click();
  await expect(page.getByText('Solucionado', { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Confirmar cierre' }).click();
  await aceptarMensaje(page, 'Estado actualizado');
  await expect(page.getByText('Cerrado', { exact: true })).toBeVisible();
  await cerrarSesion(page);

  // El total conserva el ticket y la métrica de abiertos vuelve a su valor inicial.
  await loginComo(page, jefatura!.user, jefatura!.pass);
  await expect.poll(() => totalDashboard(page), { timeout: 30_000 }).toBe(totalInicial + 1);
  await expect.poll(() => valorKpi(page, 'Tickets abiertos'), { timeout: 30_000 }).toBe(abiertosIniciales);
});
