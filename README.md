# HelpDesk — Mesa de Servicio

Monorepo Expo + Supabase. 4 roles (usuario/técnico/jefe/admin) con clasificación IA (BETO + reglas), SLA, realtime y telemetría.

## Estructura
```
apps/mobile  # Expo RN
apps/web     # Expo Web (react-native-web) + Dockerfile prod/dev
shared       # @helpdesk/shared (tipos, auth, tickets)
supabase     # migrations, config, functions
```

## Stack
Expo 57 / RN 0.86 / React 19 / TS 6 / pnpm 9 — Supabase (Postgres, RLS, Auth, Realtime)

## Dev
```bash
pnpm install
pnpm typecheck && pnpm test
pnpm --filter @helpdesk/shared test:coverage  # coverage shared (~89% líneas)
pnpm mobile   # Expo
pnpm web      # Expo web
```
Backend: Supabase Cloud (proyecto linkeado via `supabase link`).

Env: `cp .env.example .env` → `EXPO_PUBLIC_SUPABASE_URL` / `ANON_KEY` (https://*.supabase.co).
Opcional: `EXPO_PUBLIC_SENTRY_DSN` (observabilidad; vacío = desactivado), `EXPO_PUBLIC_BETO_URL` (default http://localhost:8001).

### E2E web
```bash
pnpm test:e2e
```
Los flujos autenticados requieren cuentas de prueba dedicadas y omiten los casos cuyo par de credenciales no esté configurado:
`E2E_TEST_USER` / `E2E_TEST_PASSWORD` (solicitante), `E2E_TECNICO_USER` / `E2E_TECNICO_PASS`,
`E2E_JEFE_USER` / `E2E_JEFE_PASS` y `E2E_ADMIN_USER` / `E2E_ADMIN_PASS`.
Configura estas variables en el entorno local o en secretos de CI; no uses credenciales de producción. Los E2E pueden crear o modificar tickets de prueba.

## Docker
```bash
docker compose up --build  # web :3000 + beto :8001 (verificado 2026-09-22: build OK, ambos healthy)
```
Ver `apps/web/Dockerfile` y `docker-compose.yml`.
