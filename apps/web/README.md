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

La mesa y categoría deben existir y estar activas. El formulario no permite
seleccionar un técnico: un trigger de la base asigna automáticamente uno activo
de esa mesa según carga de trabajo y riesgo de SLA. `E2E_TECNICO_NOMBRE` y sus
credenciales deben corresponder al técnico que el trigger asigne al ticket.
Para que la demo sea reproducible, usa un entorno controlado con carga estable
y sin otras altas/cierres simultáneos. El test crea un ticket real y lo deja
cerrado, no lo elimina. Playwright guarda el video en `apps/web/test-results/`
(junto con los artefactos de prueba).

El proyecto Supabase usado por la demo debe tener aplicada la migración `supabase/migrations/20261113153902_automatic_ticket_assignment_and_remove_affinities.sql`. Sin ella, el trigger que registra el feedback de IA puede fallar por RLS al crear el ticket.
