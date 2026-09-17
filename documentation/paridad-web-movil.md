# Paridad web / móvil — decisión Fase 3

Ambas apps comparten pantallas vía `@helpdesk/shared` y difieren solo donde
la plataforma lo exige. Nada pendiente de portar: las diferencias listadas
son decisiones, no brechas.

| Capacidad | Web | Móvil | Decisión |
|---|---|---|---|
| `ReportesScreen` (jefe) | Sí (wrapper sobre `DashboardScreen` con filtros + export) | No (Dashboard jefe con filtros) | Mantener: el móvil accede al mismo dashboard con filtros; no duplicar wrapper |
| `AdminImportScreen` (import histórico CSV) | Sí | No | Mantener web-only por diseño: tarea operativa de escritorio (archivo latin-1 → UTF-8) |
| `TecnicoNavigator` | Sí (archivo propio) | No (tabs cableadas en `RootNavigator`) | Paridad OK: `Bandeja` + `Detalle` existen en ambas; solo difiere el cableado de navegación |
| Campana notificaciones | `NotificationBell` (shared, in-app) | `HeaderBell` (in-app + badge push) | Paridad OK: mismo origen (`subscribeNotificaciones`); distinto contenedor por plataforma |
| Push remoto | No (in-app por diseño, RF-23) | Sí (Expo, device físico) | Mantener por diseño |
| Export dashboard CSV | Sí (descarga) | Sí (`shareCsvNativo`, fallback `downloadCsv`) | Paridad OK |
| Export PNG/PDF | Sí (DOM/canvas) | No | Mantener web-only: sin equivalente nativo simple; CSV cubre el caso móvil |

Regla a futuro: portar una capacidad solo si un rol la necesita en campo
(técnico/jefe en terreno); el trabajo de escritorio (imports, reportes
impresos) queda en web.
