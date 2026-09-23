# Auditoría Técnica Integral — Mesa de Ayuda HelpDesk

> **Fecha:** 2026-09-21
> **Metodología:** Tree of Thoughts (4 ramas paralelas)
> **Alcance:** Código fuente, arquitectura, documentación y flujos de HelpDesk (Expo + Supabase)

## Revisión 2026-09-22 (verificada contra `main`)

Hallazgos de la auditoría original re-verificados tras PRs #40–#44:

| ID | Estado | Evidencia actual |
|----|--------|------------------|
| H1 | ✅ Resuelto | 30 archivos de tests en `shared/src`, 263 tests passing (`validation.test.ts`, `ia.test.ts` recuperado, `ia-metricas-dashboard.test.ts`, FSM/bandeja/SLA cubiertos) |
| H2 | ✅ Resuelto | Dashboards web/mobile (194/199 líneas) son wrappers delgados sobre `shared/src/ui/dashboard/` (`KpiRow`, `ChartsSection`, `EstadoPrioridadRow`, `CargaAlertasSection`) |
| H3 | ✅ Resuelto | `CreateTicketScreen` 570 → 377 líneas (`TicketForm`, `AdjuntoPicker`, `IaSugerenciaPanel` extraídos) |
| H4 | ✅ Resuelto | `TicketDetailScreen` 546 → 366 líneas (`TicketHeader`, `FsmActions`, `TicketProgress`, `TicketTabs` extraídos) |
| H5 | ✅ Resuelto (2026-09-22) | Dashboards tipados (`Kpis`, `StatsEstado`, `EvolucionPunto`, `AlertaIA`, etc., rama `fix/low-effort-h5-h6-h11`) |
| H6 | ✅ Resuelto (2026-09-22) | `ErrorBoundary` compartido en `shared/src/ui/` + envoltorio en `RootNavigator` web/mobile |
| H7 | ⚠️ Vigente | Sin Sentry/LogRocket; `console.warn` sigue como manejo de errores |
| H11 | ✅ Resuelto (2026-09-22) | Tabs con `IconInbox`/`IconPlus`/`IconUser`/`IconGrid`/`IconSettings`/`IconMenu` de `shared/src/ui/icons.tsx`, sin emojis |
| H14 | ✅ Resuelto | `TecnicoNavigator` extraído de `RootNavigator`; stack duplicado eliminado |
| Nuevo | ✅ | Tarjeta `PrecisionIa` + `getMetricasIaFeedback` integradas vía `ChartsSection` (PR #40 + merge d249f03) |

## Revisión 2026-09-23 (verificada contra `main` + rama `feat/command-palette`)

Re-verificación técnica con conteos reales (no solo declaración):

| ID | Estado revisado | Evidencia actual |
|----|-----------------|------------------|
| H1 | ✅ Resuelto en cantidad, ⚠️ pendiente en integración | 38 `*.test.ts` en `shared/src` (unitarios + regresión SQL + mocks Supabase). Falta: integración contra DB real, carga, E2E mobile, Realtime. Ver §6 |
| H2 | ✅ Resuelto | `apps/web/.../DashboardScreen.tsx:194` y `apps/mobile/...:199` delegan a `shared/src/ui/dashboard/`. Sin lógica duplicada relevante |
| H3/H4 | ✅ Resuelto | `CreateTicketScreen.tsx:377`, `TicketDetailScreen.tsx:366`. Extracciones verificadas |
| H5 | ⚠️ Parcial | Persisten `as any` / `: any` en borde Supabase/Dashboard: `apps/web/.../DashboardScreen.tsx:47-48,77-78,91-94` y `shared/src/ui/dashboard/ChartsSection.tsx:13-16` (`picos: any[]`). Tipos base existen, falta aplicarlos en el borde |
| H6 | ⚠️ Parcial | `shared/src/ui/ErrorBoundary.tsx:17` + uso solo en `RootNavigator.tsx:101` (web/mobile). Falta boundary por navigator/feature. `ErrorBoundary` además hace `console.warn` si no hay reportero |
| H7 | ⚠️ Vigente | `apps/web/src/lib/sentry.ts` y `apps/mobile/src/lib/sentry.ts` existen pero son no-op sin `EXPO_PUBLIC_SENTRY_DSN`. 52 `console.warn/error` en `apps/` siguen. Sin telemetría real |
| H8 | ⚠️ Vigente | `mapAdjunto` en `shared/src/tickets.ts:288-292` mantiene `storage_path ?? ruta ?? nombre_original ?? nombre ?? filename`. Drift de schema no unificado |
| H9 | ⚠️ Parcial | Implementado `textSearch('search_vector', q, { type: 'websearch', config: 'spanish' })` con fallback a ILIKE en `shared/src/tickets.ts:377,626` + `fulltext-search.test.ts`. Pendiente: migración `search_vector` + índice GIN + backfill en producción |
| H10 | ⚠️ Vigente | Sin operaciones masivas (bulk reasignar/cerrar/cambiar prioridad) |
| H11 | ✅ Resuelto | Iconos vectoriales en `shared/src/ui/icons.tsx`, sin emojis |
| H12 | ⚠️ Vigente | `OnboardingCard`/`useOnboarding` existen pero sin flujo guiado por rol ni tooltips en creación |
| H13 | ⚠️ Vigente | `theme-dark.test.ts` es token-level; sin toggle dark mode productivo web/mobile |
| H14 | ✅ Resuelto (parcial residual) | `TecnicoNavigator` extraído; wrappers web/mobile aún divergen por diseño (stack vs tabs + linking), aceptado |
| H15 | ✅ Resuelto | Docker web + runtime verificados OK |
| H16 | ⚠️ Parcial | `Jenkinsfile:124` corre Playwright + `apps/web/e2e/` (`flujo-ticket, login, guardias`). Falta: 15 flujos, E2E mobile, carga |

> **Conclusión 2026-09-23:** H2–H4, H11, H14, H15 cerrados. H1 cerrado en unitarios, abierto en integración/carga. H5, H6, H9, H16 parciales. H7, H8, H10, H12, H13 vigentes. El §3 de este documento es el plan de cierre vinculante (6 sprints).

---

## 1. Exploración de Pensamientos (ToT)

### Rama 1: Requisitos, Casos de Uso y Pruebas

**Hipótesis evaluadas:**
- ✅ Gestión de tickets cubre ciclo de vida completo (creación → asignación → proceso → solución → cierre/devolución)
- ✅ 4 roles con fail-closed (rol desconocido → no accede a admin)
- ✅ IA clasifica por micro-API BETO + fallback de reglas locales
- ✅ SLA por prioridad, visible en banderas y detalle
- ✅ Realtime via Supabase channels

**Hallazgos (original 2026-09-21, estado 2026-09-23 entre corchetes):**
- **Cobertura de pruebas extremadamente baja [SUPERADO en unitarios 2026-09-23: 38 archivos en `shared/src`, ver §6]:** Solo existía 1 archivo de tests (`tickets-tecnico-policy.test.ts` — 45 líneas) que valida una policy RLS. No había tests unitarios para:
  - FSM de transiciones de estado
  - Validación de formularios (CreateTicketScreen tiene `validateCreateTicket` pero no tests)
  - Cálculo de SLA
  - Lógica de IA (classifyLocal, predecirCategoria)
  - Paginación server-side
- **Sin tests de integración ni E2E [PARCIAL 2026-09-23]:** Jenkins ejecutaba `pnpm test` pero solo el paquete shared tenía tests. No había Playwright/Cypress para flujos críticos (crear ticket, escalar, reasignar). [2026-09-23: `apps/web/e2e/` con `flujo-ticket, login, guardias` + etapa Playwright en `Jenkinsfile:124`. Falta mobile E2E y 15 flujos. Ver H16 y §6.]
- **Sin tests de carga [VIGENTE 2026-09-23]:** Picos concurrentes de tickets no están validados.

---

### Rama 2: Arquitectura y Calidad de Código

**Hipótesis evaluadas:**
- ✅ Monorepo con shared package (@helpdesk/shared) — buena separación
- ✅ RLS policies en DB (no en app) — seguridad defendida en capa correcta
- ✅ Auto-asignación por afinidades/mesas, no por IA directa
- ❌ **Duplicación crítica detectada:** `DashboardScreen.tsx` está duplicado casi 100% entre web (215 líneas) y mobile (217 líneas). Diferencias mínimas (web usa html2canvas/jspdf estáticos, mobile usa dynamic import + Platform.OS).
- ❌ **Componentes monolíticos:**
  - `CreateTicketScreen.tsx`: 570 líneas (debería ser ~200 + subcomponentes)
  - `TicketDetailScreen.tsx`: 546 líneas (maneja comentarios, edición, reasignación, FSM, adjuntos)
  - `MisSolicitudesScreen.tsx`: 303 líneas (grid + filtros + paginación + resolución de nombres)
- ❌ **Manejo de errores débil:** `console.warn` en producción para fallos de red/carga. Sin Sentry/LogRocket.
- ❌ **Tipos `any` en Dashboard:** `const [kpis, setKpis] = React.useState<any>(null)` — pierde type safety.
- ❌ **Fallbacks múltiples en mapeo:** `mapAdjunto` intenta `storage_path`, `ruta`, `nombre_original`, `nombre`, `mime_type`, `tamano_bytes` — sugiere schema inconsistente o migraciones incompletas.
- ❌ **Sin Error Boundaries:** Un fallo en un componente crashea toda la app.

---

### Rama 3: Consistencia Frontend Multiplataforma

**Hipótesis evaluadas:**
- ✅ Tema compartido via `@helpdesk/shared` (theme.colors)
- ✅ Componentes UI compartidos (Badge, Card, Divider, FilterDropdown, KpiCard, DonutEstado, etc.)
- ❌ **Duplicación de navegación:** RootNavigator difiere significativamente:
  - Web: `createNativeStackNavigator` simple
  - Mobile: `createBottomTabNavigator` + `createNativeStackNavigator` + `NavigationContainer` custom theme + linking profundo
  - Casi 50% de código duplicado con adaptaciones
- ❌ **Duplicación de pantallas completas:** 36 Screen components encontradas, muchas probablemente duplicadas web/mobile (CreateTicket, MisSolicitudes, BandejaTecnico, DetalleTecnico, Dashboard, AdminMesas, etc.)
- ⚠️ **Tablero (Dashboard):** Código casi idéntico — oportunidad perdida de mover a `shared` o crear un paquete aparte.
- ⚠️ **Iconografía móvil usa emoji** (☰, ＋, ◉) en vez de iconos vectoriales — inconsistente con estándar de iOS/Android.

---

### Rama 4: Experiencia de Usuario y Navegación

**Hipótesis evaluadas:**
- ✅ Crear ticket: flujo guiado (descripción → IA sugiere → confirma → envía)
- ✅ Detalle: tabs (comentarios/historial/archivos), SLA visible, reasignación inline
- ✅ Export multi-formato (CSV, PNG, PDF) en dashboard
- ✅ Alertas IA proactivas
- ❌ **Fricciones identificadas:**
  - Crear ticket requiere ~5-6 interacciones (asunto, descripción, esperar IA, confirmar dependencia, categoría, prioridad bloqueada pero visible, adjuntos opcionales) — **Zendesk lo resuelve en 3 clicks con autocompletado**
  - Sin búsqueda full-text avanzada (solo ILIKE en asunto)
  - Sin atajos de teclado para agentes de alto volumen
  - Sin onboarding guiado para nuevos usuarios
  - Sin modo oscuro
  - Sin operaciones masivas (cerrar múltiples tickets, reasignar lote)
  - La paginación es infinit scroll sin saltar a página N

---

## 2. Matriz de Hallazgos Críticos

| ID | Categoría | Hallazgo | Severidad | Evencia |
|----|-----------|----------|-----------|---------|
| H1 | Pruebas | 2026-09-21: 1 test file (~45 líneas). 2026-09-23: 38 files en `shared/src` (ver §6); pendiente integración DB real/carga/mobile | 🟡 Parcial | `shared/src/*.test.ts` (38 archivos) |
| H2 | Código | `DashboardScreen` duplicado ~100% web/mobile (215 vs 217 líneas) → 2026-09-23: wrappers 194/199 sobre `shared/src/ui/dashboard/` ✅ | 🟢 Cerrado | `apps/web/.../DashboardScreen.tsx` vs `apps/mobile/.../DashboardScreen.tsx` |
| H3 | Código | `CreateTicketScreen` 570 líneas — componente monolítico | 🟡 Media | `apps/mobile/src/features/tickets/CreateTicketScreen.tsx` |
| H4 | Código | `TicketDetailScreen` 546 líneas — responsabilidades múltiples | 🟡 Media | `apps/mobile/src/features/tickets/TicketDetailScreen.tsx` |
| H5 | Código | Tipos `any` en Dashboard → 2026-09-23: tipos base existen, persisten `as any` en borde Supabase (`DashboardScreen.tsx:47-48,77-94`, `ChartsSection.tsx:13-16`) | 🟡 Media | `DashboardScreen.tsx` + `shared/src/ui/dashboard/ChartsSection.tsx` |
| H6 | Arquitectura | Sin Error Boundaries → 2026-09-23: boundary solo en `RootNavigator` (`RootNavigator.tsx:101`); falta por navigator/feature | 🟡 Media | `RootNavigator.tsx` + `shared/src/ui/ErrorBoundary.tsx:17` |
| H7 | Arquitectura | Sin observabilidad real: `sentry.ts` web/mobile es no-op sin DSN; 52 `console.warn/error` en `apps/` | 🟡 Media | `apps/web|mobile/src/lib/sentry.ts` |
| H8 | Arquitectura | `mapAdjunto` con 3-4 fallbacks por campo (`storage_path ?? ruta`, `nombre_original ?? nombre ?? filename`) — drift schema vigente | 🟠 Baja | `shared/src/tickets.ts:288-292` |
| H9 | UX | ILIKE como fallback vigente; `textSearch spanish` implementado (`tickets.ts:377,626`) pero sin migración `search_vector`+GIN en prod | 🟡 Media | `shared/src/tickets.ts:366-377,622-626` |
| H10 | UX | Sin operaciones masivas (reasignar/cerrar lote) | 🟡 Media | AdminNavigator |
| H11 | UX | Iconografía con emoji en tabs móvil (☰, ＋, ◉) | 🟠 Baja | `TecnicoNavigator` |
| H12 | UX | Sin onboarding ni tooltips contextuales | 🟠 Baja | Global |
| H13 | UX | Sin modo oscuro | 🟠 Baja | theme compartido |
| H14 | Consistencia | RootNavigator web vs mobile — 50% código duplicado con divergencias | 🟡 Media | `RootNavigator.tsx` ambas plataformas |
| H15 | DevOps | Docker web build + runtime verificados OK (2026-09-22) | 🟢 Cerrado | `docker compose up --build` (web :3000, beto :8001) |
| H16 | DevOps | E2E parcial 2026-09-23: Playwright web (`flujo-ticket, login, guardias`) + `Jenkinsfile:124`; falta mobile/carga/15 flujos | 🟡 Media | Jenkinsfile etapa Test + `apps/web/e2e/` |

---

## 3. Plan de Cierre (vinculante 2026-09-23 — 6 sprints)

> Sustituye al plan abierto 2026-09-21. Cada sprint tiene alcance, archivos objetivo y criterio de cierre. Nada se marca ✅ sin evidencia.

### Sprint 1 — Observabilidad real + tipado (cierra H7, H5)

| Acción | Cierra | Evidencia exigida |
|--------|--------|-------------------|
| Sentry web/mobile con `EXPO_PUBLIC_SENTRY_DSN` en staging/prod, `tracesSampleRate: 0.1`, `reportError` en ambos `RootNavigator` | H7 | Evento forzado visible en dashboard Sentry web + mobile |
| Eliminar `console.warn/error` de ruta crítica (crear/asignar/resolver/cargar dashboard) o redirigir a `reportError` | H7 | `grep console.warn/error apps/` = 0 en esos flujos |
| Aplicar tipos `Kpis/StatsEstado/EvolucionPunto/AlertaIA` en `DashboardScreen.tsx:47-94` y `ChartsSection.tsx:13-16`; activar `noExplicitAny` en ese path | H5 | `grep ": any\|as any"` en dashboard = 0 + `typecheck` verde |

### Sprint 2 — Resiliencia + schema (cierra H6, H8)

| Acción | Cierra | Evidencia exigida |
|--------|--------|-------------------|
| `ErrorBoundary` por `TecnicoNavigator`/`AdminNavigator`/bandeja, fallback con reintentar + reporte Sentry | H6 | Test: romper un tab no tumba la app |
| Auditoría schema `adjuntos` en prod vs `mapAdjunto`; migración que unifica a `storage_path`/`nombre_original`; quitar `ruta`/`nombre`/`filename` legacy; test integración storage real | H8 | `mapAdjunto` 1 campo por prop, sin `??` legacy |

### Sprint 3 — Búsqueda + integración (cierra H9, endurece H1)

| Acción | Cierra | Evidencia exigida |
|--------|--------|-------------------|
| Migración `search_vector tsvector spanish` + índice GIN + backfill; `textSearch` por defecto, ILIKE solo fallback logueado | H9 | `EXPLAIN` usa GIN; p95 <300 ms con 50k tickets |
| Integración RLS con Supabase local (`tickets_update_tecnico`, `storage-adjuntos`, `rls-cancel`) + Realtime connect/disconnect + timeout BETO con fallback reglas | H1 | Tests integración verdes en CI, no solo regex SQL |
| Coverage shared ≥60% | H1 | `pnpm --filter @helpdesk/shared test:coverage` |

### Sprint 4 — Bulk + E2E completo (cierra H10, H16)

| Acción | Cierra | Evidencia exigida |
|--------|--------|-------------------|
| Selección múltiple en bandeja → reasignar/cerrar/cambiar prioridad en lote con confirmación + entrada en historial | H10 | Bulk 50 tickets <10 s con auditoría |
| Playwright 15 flujos (crear→asignar→resolver→cerrar, escalar, reasignar lote, SLA vencido) + smoke mobile mínimo | H16 | `Jenkinsfile` `typecheck+tests+e2e+docker` verde, junit publicado |

### Sprint 5 — UX agentes (cierra H12 + fricciones R4)

| Acción | Cierra | Evidencia exigida |
|--------|--------|-------------------|
| Onboarding por rol con `OnboardingCard`/`useOnboarding` + tooltips en creación; atajos teclado web (j/k/r/c); ⌘K (`CommandPalette` en `feat/command-palette`) conectada a acciones reales | H12 | Crear ticket 6→3 clics medido; <5% tickets mal categorizados con onboarding visto |
| Búsqueda avanzada (estado/prioridad/mesa + texto) sobre full-text | R4 | Filtros combinados con p95 <300 ms |

### Sprint 6 — Dark mode + clausura doc (cierra H13 + auditoría)

| Acción | Cierra | Evidencia exigida |
|--------|--------|-------------------|
| Tokens dark en `theme`, toggle web/mobile, snapshot + `theme-dark.test.ts` productivo | H13 | Toggle verificado en ambas plataformas |
| Actualizar este md: tabla Revisión con todo ✅/Aceptada, métricas finales, §7 Cierre firmado | Doc | Sin ⚠️ vigentes |

### Aparcado explícito (no bloquea cierre)

| Ítem | Motivo |
|------|--------|
| SLA avanzado (pausa en devolución, horario laboral, escalamiento auto) | Requiere diseño con negocio; issue aparte |
| IA conversacional sobre knowledge base | Alcance producto nuevo |
| Offline sync con sync queue móvil | Requiere arquitectura nueva |
| Webhook/SAP/AD sync, A/B testing, app nativa pura | Enterprise / futuro |

---

## 4. Métricas de Seguimiento

Para medir la mejora de calidad, tracemos estas métricas:

| Métrica | Estado 2026-09-21 | Estado 2026-09-23 | Objetivo cierre (Sprint 6) |
|---------|-------------------|-------------------|----------------------------|
| **Coverage de tests** | ~5% (shared) | 38 files shared (unit + mocks; sin % publicado) | ≥60% shared, ≥85% en `tickets/sla/ia` |
| **Tests E2E** | 0 | 3 flujos web (`flujo-ticket, login, guardias`) | 15 flujos web + smoke mobile |
| **Duplicación código** | ~50% Dashboard/Nav | Wrappers 194/199 sobre shared ✅ | <10% (residual aceptado por diseño stack vs tabs) |
| **Componentes >400 líneas** | 3 | 0 en auditados (377/366) | 0 |
| **Uso de `any` types** | Múltiple | Residual en borde dashboard (`DashboardScreen:47-94`, `ChartsSection:13-16`) | 0 en dashboard |
| **Error Boundaries** | 0 | Solo `RootNavigator` | Por navigator + bandeja |
| **Build web Docker** | ❌ Falla | ✅ Verde | ✅ Optimizado |
| **Observabilidad** | `console.warn` | `sentry.ts` no-op + 52 warns | Sentry con eventos reales |
| **Full-text** | Solo ILIKE | `textSearch` + fallback ILIKE | GIN español en prod |

---

## 5. Notas para Refactorización

### Prioridad Inmediata (2026-09-23)
1. **No tocar el FSM de tickets** (`canTransition` en `shared/src/tickets.ts:499`) sin tests de integración — riesgo alto de romper flujo de estados
2. **El fallback de `mapAdjunto`** (`shared/src/tickets.ts:288-292`) no debe limpiarse hasta confirmar schema final en producción (Sprint 2)
3. **BETO_URL** viene por env var — no hardcodear en refactors; cubrir timeout con fallback de reglas locales (Sprint 3)
4. **Las policies RLS** tienen pin de regresión estática (`tickets-tecnico-policy.test.ts`, `rls-cancel.test.ts`, `storage-adjuntos-policy.test.ts`) — subirlas a integración contra Supabase local en Sprint 3, no quedarse solo en regex SQL

### Deuda Técnica Aceptable (no bloquea cierre)
- Divergencia stack (web) vs tabs (mobile) en navegadores — aceptada por diseño de plataforma
- Offline sync (requiere arquitectura nueva) — aparcado
- Nativo puro (Expo cubre el caso de uso actual) — aparcado
- SLA avanzado / IA conversacional / SAP-AD sync — issues aparte, ver §3

---

## 6. Análisis de Pruebas (2026-09-23)

No, no todas son estáticas. 38 archivos en `shared/src`, 4 familias:

1. **Unitarias puras (mayoría, más valiosas):** `sla.test.ts` (`getSlaVencimiento/getSlaEstado/getSlaProgreso`), `validation.test.ts` (`validateCreateTicket`), `ia.test.ts` (`classifyLocal/predecirCategoria`), `autoasignar.test.ts`, `mesas.test.ts`, `categorias.test.ts`, `export.test.ts`, `permissions.test.ts`, `roles.test.ts`, `password.test.ts`, `dashboard.test.ts`, `historial.test.ts`, `notificaciones.test.ts`, `onboarding.test.ts`, `palette.test.ts`, `theme-dark.test.ts`. Regresión de lógica de negocio sin I/O.
2. **Regresión estática de SQL (sí estáticas):** `tickets-tecnico-policy.test.ts`, `rls-cancel.test.ts`, `storage-adjuntos-policy.test.ts` leen `supabase/migrations/*.sql` con `readFileSync` + regex (ej. pin `WITH CHECK` y columnas inmutables `usuario_id/numero/categoria_id/prioridad/asunto/descripcion/creado_en`). Útiles como pin, pero **no prueban RLS contra Postgres real** — falso senso de seguridad si la migración no se aplica. Sprint 3 las sube a integración.
3. **Unitarias con mock Supabase:** `fulltext-search.test.ts` (verifica `textSearch spanish` vs fallback ILIKE), `tickets.test.ts`, `tickets-coverage.test.ts`, `gaps-coverage.test.ts`, `ux-criticos.test.ts`, `qa-altos-fsm-bandeja.test.ts`. Verifican llamadas y mapeos, no latencia/RLS/índices.
4. **E2E Playwright web (3 specs):** `apps/web/e2e/flujo-ticket.spec.ts, login.spec.ts, guardias.spec.ts` + etapa `Jenkinsfile:124` con junit. Sin E2E mobile ni carga.

**Módulos más importantes por riesgo:** `shared/src/tickets.ts` (FSM + `validateCreateTicket` + `resolverMesaId` + paginación) + `sla.ts` + `ia.ts` + `autoasignar.ts`/`mesas.ts` + `permissions.ts`/`roles.ts` + policies RLS. Secundarios para dirección: `dashboard.ts`, `ia-feedback.ts`/`ia-metricas-dashboard`, `export.ts`, `notificaciones.ts`/`push-sender`, `adjuntos-limits`.

**Puntos débiles del software/architectura a hoy:**
- `shared` es god-package (UI + dominio + infra mezclados sin límites de importación).
- Borde Supabase sin contrato (`as any` justo donde más falla).
- `ErrorBoundary` grueso que solo loguea `console.warn` sin Sentry.
- Schema `adjuntos` y `search_vector` no garantizados por migración; código defensivo que oculta el problema.
- Sin bulk ops, sin ⌘K productivo, sin atajos, búsqueda sin ranking en prod, infinite scroll sin salto a página N.
- Realtime channels sin tests de desconexión; BETO sin circuit-breaker testeado.

---

## 7. Criterios de Cierre del Documento

La auditoría se declara **cerrada** cuando:

- [ ] H5: 0 `any` en dashboard + `typecheck` verde
- [ ] H6: boundaries por navigator con test de aislamiento
- [ ] H7: evento Sentry real web + mobile + 0 warns en ruta crítica
- [ ] H8: migración adjuntos aplicada + `mapAdjunto` sin fallbacks legacy
- [ ] H9: `search_vector` + GIN en prod + p95 <300 ms
- [ ] H10: bulk 50 tickets auditado
- [ ] H12/H13: onboarding por rol + dark mode toggle verificados
- [ ] H1/H16: coverage ≥60% + 15 E2E web + smoke mobile + integración RLS en CI
- [ ] Tabla Revisión sin ⚠️ vigentes

---

> **Próximo paso (actualizado 2026-09-23):** ejecutar Sprint 1 (Sentry real + cierre H5 `any`). Ver §3. Branch de trabajo sugerida: `docs/cierre-auditoria-h5-h7` o continuar en feature actual.
