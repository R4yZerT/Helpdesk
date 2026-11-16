# apps/web

Version web de la misma app (react-native-web sobre el codigo de mobile).
Prototipo: estructura vacia, se implementa en la siguiente etapa.

## Demo E2E por perfiles

El recorrido `e2e/demo-flujo.spec.ts` automatiza en un solo video la creación de
un ticket por el solicitante, el seguimiento de sus cambios por el técnico, la
devolución/retrabajo, la confirmación del cierre y la variación de los KPI de
jefatura.

Configura estas variables en la terminal antes de ejecutar la demo:

```sh
export E2E_TEST_USER="correo-o-cedula-solicitante"
export E2E_TEST_PASS="contraseña-solicitante"
export E2E_TECNICO_USER="correo-o-cedula-tecnico"
export E2E_TECNICO_PASS="contraseña-tecnico"
export E2E_TECNICO_NOMBRE="Nombre visible del técnico en la app"
export E2E_JEFE_USER="correo-o-cedula-jefatura"
export E2E_JEFE_PASS="contraseña-jefatura"
export E2E_DEMO_MESA="Nombre exacto de la dependencia"
export E2E_DEMO_CATEGORIA="Nombre exacto de la categoría"
pnpm --filter web test:e2e:demo
```

La mesa, categoría y técnico deben existir y estar activos; el técnico debe
pertenecer a esa mesa y coincidir con las credenciales configuradas. El test
crea un ticket real y lo deja cerrado, no lo elimina. Ejecútalo en un entorno
de demostración sin otras altas/cierres simultáneos para que las diferencias de
los KPI sean atribuibles a este recorrido. Playwright guarda el video en
`apps/web/test-results/` (junto con los artefactos de prueba).
