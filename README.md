# HelpDesk — Mesa de Servicio (WIP)

Monorepo Expo + Supabase. 4 roles (usuario/técnico/jefe/admin). En desarrollo — faltan RF y Docker aún no funciona.

## Estructura
```
apps/mobile  # Expo RN
apps/web     # Expo Web (react-native-web) — Dockerfile en progreso
shared       # @helpdesk/shared (tipos, auth, tickets)
supabase     # migrations, config, functions
```

## Stack
Expo 52 / RN 0.76 / TS 5.5 / pnpm 9 — Supabase (Postgres, RLS, Auth, Realtime)

## Dev
```bash
pnpm install
pnpm typecheck && pnpm test
pnpm mobile   # Expo
pnpm web      # Expo web
```
Backend local: `supabase start` (requiere Docker + Supabase CLI).

Env: `cp .env.example .env` → `EXPO_PUBLIC_SUPABASE_URL` / `ANON_KEY`.

## Docker (WIP)
```bash
docker compose up --build  # web :3000 — actualmente falla el build (en corrección)
```
Ver `apps/web/Dockerfile` y `docker-compose.yml`.
