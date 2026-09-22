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

Pendiente de corto plazo: H5 (tipos `KpiData`/`AlertaIA`), H6 (boundaries por navigator), H7 (Sentry).

---

## 1. Exploración de Pensamientos (ToT)

### Rama 1: Requisitos, Casos de Uso y Pruebas

**Hipótesis evaluadas:**
- ✅ Gestión de tickets cubre ciclo de vida completo (creación → asignación → proceso → solución → cierre/devolución)
- ✅ 4 roles con fail-closed (rol desconocido → no accede a admin)
- ✅ IA clasifica por micro-API BETO + fallback de reglas locales
- ✅ SLA por prioridad, visible en banderas y detalle
- ✅ Realtime via Supabase channels

**Hallazgos:**
- **Cobertura de pruebas extremadamente baja:** Solo existe 1 archivo de tests (`tickets-tecnico-policy.test.ts` — 45 líneas) que valida una policy RLS. No hay tests unitarios para:
  - FSM de transiciones de estado
  - Validación de formularios (CreateTicketScreen tiene `validateCreateTicket` pero no tests)
  - Cálculo de SLA
  - Lógica de IA (classifyLocal, predecirCategoria)
  - Paginación server-side
- **Sin tests de integración ni E2E:** Jenkins ejecuta `pnpm test` pero solo el paquete shared tiene tests. No hay Playwright/Cypress para flujos críticos (crear ticket, escalar, reasignar).
- **Sin tests de carga:** Picos concurrentes de tickets no están validados.

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
| H1 | Pruebas | Solo 1 test file para todo el proyecto (~45 líneas) | 🔴 Alta | `tickets-tecnico-policy.test.ts` |
| H2 | Código | `DashboardScreen` duplicado ~100% web/mobile (215 vs 217 líneas) | 🔴 Alta | `apps/web/.../DashboardScreen.tsx` vs `apps/mobile/.../DashboardScreen.tsx` |
| H3 | Código | `CreateTicketScreen` 570 líneas — componente monolítico | 🟡 Media | `apps/mobile/src/features/tickets/CreateTicketScreen.tsx` |
| H4 | Código | `TicketDetailScreen` 546 líneas — responsabilidades múltiples | 🟡 Media | `apps/mobile/src/features/tickets/TicketDetailScreen.tsx` |
| H5 | Código | Tipos `any` en Dashboard (`useState<any>`) | 🟡 Media | `DashboardScreen.tsx` líneas 27-37 |
| H6 | Arquitectura | Sin Error Boundaries — fallo en un componente crashea toda la app | 🟡 Media | `RootNavigator.tsx` |
| H7 | Arquitectura | Sin observabilidad (Sentry/LogRocket) — `console.warn` en producción | 🟡 Media | Múltiples screens |
| H8 | Arquitectura | `mapAdjunto` con 3-4 fallbacks por campo — sugiere migraciones incompletas | 🟠 Baja | `shared/src/tickets.ts:274-284` |
| H9 | UX | Sin búsqueda full-text (solo ILIKE en asunto) | 🟡 Media | `shared/src/tickets.ts:352-361` |
| H10 | UX | Sin operaciones masivas (reasignar/cerrar lote) | 🟡 Media | AdminNavigator |
| H11 | UX | Iconografía con emoji en tabs móvil (☰, ＋, ◉) | 🟠 Baja | `TecnicoNavigator` |
| H12 | UX | Sin onboarding ni tooltips contextuales | 🟠 Baja | Global |
| H13 | UX | Sin modo oscuro | 🟠 Baja | theme compartido |
| H14 | Consistencia | RootNavigator web vs mobile — 50% código duplicado con divergencias | 🟡 Media | `RootNavigator.tsx` ambas plataformas |
| H15 | DevOps | Docker web falla en build (según README) | 🔴 Alta | README línea 29 |
| H16 | DevOps | Sin tests E2E en pipeline Jenkins | 🟡 Media | Jenkinsfile etapa Test |

---

## 3. Plan de Mejora y Futuras Implementaciones

### 🟢 Corto Plazo (1-2 sprints)

| Acción | Impacto | Esfuerzo |
|--------|---------|----------|
| **Tests unitarios críticos:** `validateCreateTicket`, FSM transitions, `classifyLocal`, `getSlaEstado`, `resolverMesaId` | Alta | Medio |
| **Subir coverage mínimo al 60% en shared** (actual ~5%) | Alta | Medio |
| **Error Boundaries** por screen/navigator | Media | Bajo |
| **Reemplazar `any` en Dashboard** por tipos concretos (`KpiData`, `AlertaIA`, etc.) | Media | Bajo |
| **Iconos vectoriores en tabs** (expo-vector-icons o @expo/vector-icons) | Bajo | Bajo |
| **Docker web build fix** — Dockerfile + docker-compose | Alta | Medio |

### 🟡 Mediano Plazo (3-5 sprints)

| Acción | Impacto | Esfuerzo |
|--------|---------|----------|
| **Extraer Dashboard a paquete compartido** (`@helpdesk/dashboard`) — single source of truth web/mobile | Alta | Alto |
| **Refactor CreateTicketScreen:** separar en `TicketForm`, `AdjuntoPicker`, `IaSugerenciaPanel` | Media | Alto |
| **Refactor TicketDetailScreen:** extraer `FsmActions`, `CommentSection`, `ReassignModal` | Media | Alto |
| **Tests E2E con Playwright** (flujo crítico: crear → asignar → resolver → cerrar) | Alta | Alto |
| **Observabilidad:** Sentry SDK en web + mobile | Media | Medio |
| **Onboarding contextual** (driver.js web / custom overlay móvil) | Medio | Medio |
| **Búsqueda full-text** con `tsvector` + GIN index en PostgreSQL (reemplazar ILIKE) | Alta | Medio |
| **Dark mode** en theme compartido | Bajo | Medio |

### 🔵 Largo Plazo (6+ sprints)

| Acción | Impacto | Esfuerzo |
|--------|---------|----------|
| **Operaciones masivas:** seleccionar N tickets → reasignar/cerrar/cambiar prioridad | Alta | Alto |
| **Command palette (⌘K)** para agentes — estilo Zendesk/Linear | Media | Alto |
| **Motor de SLA avanzado:** pause en devolución, horario laboral, escalamiento automático por vencimiento | Alta | Alto |
| **Asistente IA conversacional:** chat sobre el ticket que sugiera soluciones de knowledge base | Alta | Alto |
| **Modo offline** con sync queue (móvil) para técnicos en campo | Alta | Muy Alto |
| **Webhook/SAP/ActiveDirectory sync** para escalar a enterprise | Media | Alto |
| **A/B testing framework** para flujos de creación de tickets | Medio | Medio |
| **App nativa iOS/Android** con SwiftUI/Jetpack Compose para crítico (si Expo queda corto) | Alto | Muy Alto |

---

## 4. Métricas de Seguimiento

Para medir la mejora de calidad, tracemos estas métricas:

| Métrica | Estado Actual | Objetivo Corto | Objetivo Largo |
|---------|---------------|----------------|----------------|
| **Coverage de tests** | ~5% (shared) | 60% | 85% |
| **Tests E2E** | 0 | 5 flujos críticos | 15+ flujos |
| **Duplicación código** | ~50% Dashboard/Nav | <10% | <5% |
| **Componentes >400 líneas** | 3 | 1 | 0 |
| **Uso de `any` types** | Múltiple | 0 en shared | 0 global |
| **Error Boundaries** | 0 | Por navigator | Por feature |
| **Build web Docker** | ❌ Falla | ✅ Verde | ✅ Optimizado |

---

## 5. Notas para Refactorización

### Prioridad Inmediata
1. **No tocar el FSM de tickets** sin tests — riesgo alto de romper flujo de estados
2. **El fallback de `mapAdjunto`** no debe limpiarse hasta confirmar schema final en producción
3. **BETO_URL** viene por env var — no hardcodear en refactors
4. **Las policies RLS** están probadas con `tickets-tecnico-policy.test.ts` — mantener ese patrón

### Deuda Técnica Aceptable (por ahora)
- Modo oscuro (baja prioridad para usuarios internos)
- Offline sync (requiere arquitectura nueva)
- Nativo puro (Expo cubre el caso de uso actual)

---

> **Próximo paso recomendado (actualizado 2026-09-22):** H1–H6, H11, H14 cerrados. Siguiente: Sentry (H7), coverage 60% en shared y E2E Playwright.
