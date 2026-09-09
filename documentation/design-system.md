# Design System — HelpDesk (Stitch: #0E87E2 / #FD7C06)

> Fuente: `shared/src/ui/theme.ts` + `shared/src/ui/components.tsx` — tokens 1:1 con `projects/8538278466542593758 HelpDesk Design System` (Inter + JetBrains Mono, space 4pt).

## Tokens

### Colores
| Token | Valor | Uso |
|---|---|---|
| `primary` | `#0E87E2` | Nav, CTA primario, focus, `en_proceso` |
| `primaryDark` | `#0A5CB8` | hover/pressed |
| `primarySoft` | `#EAF3FF` | bg chip activo, info badge |
| `accent` | `#FD7C06` | Solo urgencia: `critica`, SLA, pico heatmap, FAB |
| `accentStrong` | `#C65A00` | texto sobre accentMuted |
| `accentMuted` | `#FFF3E6` | bg accent badge |
| `blue50` | `#EFF6FF` | tablas stripes, AI card |
| `orange50` | `#FFF7ED` | timeline alert urgent bg |
| `success` | `#0F9D58` | solucionado, baja |
| `warning` | `#F59E0B` | media |
| `danger` | `#DC2626` | alta, SLA riesgo |
| `bg` | `#F6F8FB` | canvas |
| `surface` | `#FFFFFF` | cards |
| `surfaceAlt` | `#EEF2F7` | inputs, chips inactivos |
| `border` | `#E2E8F0` | card border |
| `borderStrong` | `#CBD5E1` | inputs `h-44` |
| `muted` | `#64748B` | subtle 12 |
| `mutedSoft` | `#94A3B8` | kicker 10 |
| `text` | `#0F172A` | h1 22 extrabold |
| `textSoft` | `#334155` | labels |

### Radius / Space / Shadow / Tipografía
- `radius: sm10 md14 lg20 xl28 full999` — Cards `lg` 20, inputs `md` 12, chips `full`, pills `999`.
- `spacing(n)=n*4`, `space 1:4 2:8 3:12 4:16 5:20 6:24 8:32 10:40 12:48 16:64`.
- `shadow: soft 0 1 3 rgba(15,23,42,0.05) / medium 0 4 12 rgba(15,23,42,0.08) / overlay 0 12 28 rgba(15,23,42,0.12)` — Cards `soft`, FAB `medium`.
- `font: display/body Inter fallback System, mono JetBrains Mono` — `typography: displayLg 40/48 700 -0.8 / headlineLg 32/40 600 / headlineMd 24/32 600 / headlineSm 20/28 600 / titleMd 16/24 600 / bodyLg 16/24 400 / bodyMd 14/20 400 / bodySm 12/16 400 / labelMd 12/16 500 0.12 / codeMd 13/18 500`.

## Primitivos (`shared/src/ui/components.tsx`)

- `Card` — `surface #FFFFFF, lg 20, p20, border 1 #E2E8F0, shadow.soft`. Uso: KPIs, Donut, filtros, expediente.
- `Badge` tones: `muted #EEF2F7/#334155 / info #EAF3FF/#0A5CB8 / accent #FFF3E6/#C65A00 / danger #FEF2F2/#991B1B / success #ECFDF5/#065F46 / warning #FFFBEB/#92400E / ink #0F172A/#FFFFFF`.
- `Button` — `height 44` (touch 44), `radius 10`, `primary #0E87E2 / accent #FD7C06 solo crítica / ghost #FFFFFF border #E2E8F0`.
- `SectionHeader` — `eyebrow 10/700/1.2 uppercase primaryDark + title 20/800 -0.4 + subtitle 13 muted`.
- `Divider` — `h1 #E2E8F0`.

## Layout (`shared/src/ui/layout/`)

- `AppShell` — `aside w-64 fixed left-0 h-screen flex-col p16 border-r #E2E8F0 bg surfaceAlt` + `ml-64 min-h-screen` + `max-w 1280 mx-auto`. Mobile `<1024` drawer overlay.
- `TopBar` — `h-64 flex between px-24 bg surface border-b`: left `HelpDesk 14/800 -0.3 + badge V4.8-PROD #EAF3FF + search w240 h36 bg #F6F8FB border #E2E8F0 radius12 + ⌘K`, center `nav 12/600 muted: En Vivo/Mesas/SLA/Técnicos/IA Intel`, right `actions`.
- `FilterBar` — `sticky top-64 z30 bg white/95 backdrop-blur px-8 py-3`: segmented `Hoy/7d/30d` + `Mesas: TIC blue / Comunicaciones orange / Infra green / EAPSA grey` pills + `Categoría select + Estado Todos (6)` + acciones `Filtros Globales + Exportar PDF/CSV CTA azul`.
- `Sidebar` — logo `dot 32 bg #0E87E2 + HelpDesk 13/800 + Mesa de Ayuda 10/600 muted`, nav items `12/600 muted -> active #0A5CB8 bg #EAF3FF border #BFDBFE`, userCard `avatar 32 #0F172A`.

## Charts (`shared/src/ui/charts/`)

- `KpiCard` — `bg white rounded-xl border #E2E8F0 p5 shadow 0_1_3`: label 11 muted + value 20-24 extrabold + delta 11 + sparkline SVG azul `M2 18 L18 14…` fill 0.12.
- `DonutEstado` — `w48 h48 viewBox 0 0 160 160 r60 circ377 dasharray`: `En proceso 56 #0E87E2 / Solucionado 34 #0F9D58 / Abierto 28 #CBD5E1 / Cerrado 16 #0F172A / Devuelto 5 #FD7C06 / Programado 3 #94A3B8` + center 142 + legend 2cols + `table.sr-only`.
- `BarsPrioridad` — `h-2.5 rounded-full bg #E2E8F0 + fill width%`: Crítica 6% #FD7C06 / Alta 17% #FB923C / Media 55% #0E87E2 / Baja 22% #CBD5E1.
- `AreaEvolucion` — `viewBox 0 0 1000 240 h64`: 4 series TIC solid #0E87E2 w2.5 + Comunicaciones #FD7C06 w2 + Infra #0F9D58 + EAPSA dashed #94A3B8 + grad 0.25→0 + tooltip `24 Ene 48 tickets`.
- `HeatmapCarga` — table `min-w 580px 5 filas Lun-Vie ×15 cols 07-21`: cells `w2.5 h2.5 rounded-xs` escala `Baja #EEF2F7 / Media #A0CAFF / Alta #0E87E2 / Pico #FD7C06`, picos `08-10h`.
- `TimelineAlertas` — card `border-l-3 #FD7C06 bg #FFF7ED` + badge pulse + `Confianza 94.2%`.

## Páginas

- **Dashboard** `apps/*/features/dashboard/DashboardScreen.tsx` — `AppShell + FilterBar Hoy/7d/30d + mesas + 4 KPIs + Donut/Bars + Area 30d + Heatmap/Timeline`. Datos `shared/src/dashboard.ts` (`getKPIs/getStatsPorEstado/getStatsPorPrioridad/getEvolucionPorMesa/getCargaHoraria/listAlertasIA`) con filtros `DashboardFilters`. Export via `shared/src/export.ts`.
- **MisSolicitudes** — header `BANDEJA 10 uppercase #94A3B8 + h1 22 extrabold + counters activos/total`, Filter Card `bg white rounded-xl border #E2E8F0 p16`: search `h44 pl12 border #CBD5E1 + clear 32`, pills `Estado/Prioridad h32 px14 rounded-full 11/600`, footer `23 resultados + Limpiar`, grid `md:grid-cols-2 gap12`, card `bg white rounded-xl border p16 hover #CBD5E1`: top `#0042 JetBrains Mono 12/800 muted + badges`, h2 `14 extrabold`, p `12 #64748B line-clamp-2`, divider, meta `Mesa · hace Xh (relativeTime) · Técnico asignado`, banner `¿No encuentras? + Limpiar filtros`, FAB `fixed bottom-6 right-6 h48 px18 bg #FD7C06 rounded-full shadow-medium border #FED7AA`.
- **Crear** — breadcrumb + `NUEVA INCIDENCIA 10 uppercase + h1 22 extrabold Crear Solicitud de Soporte`, form `max-w 680 Card p20 gap12`: AI card `EFF6FF #DBEAFE 82% + Aplicar sugerencia #0E87E2`, Mesa 4 cards `minW140 border12 active border-2 #0E87E2 bg #EFF6FF`, Categoría chips agrupados por dominio, Asunto `minH44 border12 + 200`, Descripción `minH120 + 5000`, Prioridad segmented `4 × 11/700 capitalize active #EAF3FF/danger naranja`, adjuntos dashed `#CBD5E1 #F8FAFC p18`, acciones `ghost Cancelar + submit #FD7C06 h48`.
- **Detalle** — header `kicker dot + #0042 Mono pill + prioridad/estado badges + SLA Activo pulse danger + h1 20 extrabold + meta Mesa · Cat · Reportado`, split `lg:grid-cols-12 gap6 8+4`: left `Descripción Card + terminal #0F172A mono #A7F3D0 + solución Box + tabs Comentarios/Historial/Archivos + comentarios (interno naranja #FFF7ED) + composer h44 + Switch Interno #FD7C06`, right `FSM Card Solucionar #FD7C06 + ghost Requerir Info/Reasignar + Transición chips + Reasignar UUID/mesa + Progreso 5 nodos dot+line + SLA 35m 75% bar danger + atributos` (Escalar N3 retirado 2026-09).

## A11y

- `accessibilityRole="button"`, `accessibilityLabel` en todos los Pressable (Buscar, Filtro, Crear, Enviar, Reintentar), `accessibilityState={{selected/disabled}}`, `table.sr-only` en Donut/Heatmap, `accessible="alert"` en vacíos, touch `44` en inputs/buttons, `TextInput accessibilityLabel` en búsqueda/composer.

## Uso

```ts
import { theme, Card, Badge, Button } from '@helpdesk/shared';
import { AppShell, TopBar, FilterBar, Sidebar } from '@helpdesk/shared';
import { KpiCard, DonutEstado, BarsPrioridad, AreaEvolucion, HeatmapCarga, TimelineAlertas } from '@helpdesk/shared';
import { getKPIs, getStatsPorEstado } from '@helpdesk/shared'; // DashboardFilters
import { ticketsToRows, toCsv, downloadCsv } from '@helpdesk/shared';
```
