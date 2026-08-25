# HelpDesk — Mesa de Servicio con IA

Prototipo de sistema de mesa de ayuda municipal con 4 roles (Empleado, Técnico, Jefe, Administrador), dashboards en tiempo real e IA predictiva. Curso Programación Móvil, Institución Universitaria de Envigado, 2026.

Stack: **Expo / React Native + TypeScript + react-native-web** (monorepo `pnpm`), **Supabase** (Postgres + Auth + Storage + Realtime). No se usa Flutter — ver `apps/mobile` y `apps/web` con `shared/` TypeScript.

## Estructura

```
HelpDesk/
├── apps/
│   ├── mobile/              # Expo / React Native (TypeScript) — app nativa
│   │   ├── src/context/     # AuthContext + sesión persistente (SecureStore)
│   │   ├── src/hooks/       # useIdleTimeout (30m)
│   │   ├── src/lib/         # supabase.ts (adaptador SecureStore), secure-storage.ts
│   │   ├── src/navigation/  # RootNavigator, guards por rol
│   │   └── src/features/    # auth/*, tickets/*
│   └── web/                 # Expo Web via react-native-web
│       ├── Dockerfile       # Multi-stage: pnpm → expo export → nginx
│       ├── nginx.conf       # SPA fallback + cache estáticos
│       ├── metro.config.js  # watchFolders workspace + resolver shared/dist
│       └── App.tsx          # Entry web (main: App.tsx, no expo/AppEntry)
├── shared/                  # Contratos TypeScript compartidos (workspace @helpdesk/shared)
│   ├── src/auth.ts, roles.ts, permissions.ts, tickets.ts, password.ts, supabase.ts
│   ├── src/ui/components.tsx
│   ├── tsconfig.build.json  # Build standalone para Docker (skipLibCheck, jsx)
│   └── dist/                # Generado por tsc (main: dist/index.js)
├── supabase/
│   ├── config.toml          # Auth (NIST 8 chars, confirmations, secure_password_change, captcha, sessions 12h/30m, MFA TOTP)
│   ├── migrations/          # Schema, RLS, triggers, índices (pg_trgm), storage
│   ├── functions/           # auth-validate (NIST/HIBP fail-closed), classify (stub)
│   ├── templates/           # Email templates (password_changed_notification)
│   └── seed.sql
├── docker-compose.yml       # Web :3000 + healthcheck
├── .dockerignore
├── .env.example
└── documentation/documento-requisitos.md  # 32 RF documentados
```

## Stack

| Capa | Elección |
|------|----------|
| Móvil + Web | Expo ~52.0 / React Native 0.76 / react-native-web 0.19 / TypeScript 5.5 |
| Backend | Supabase 2.115 (Postgres + RLS + Realtime + Storage + Edge Functions) |
| Contratos | `shared/` (`@helpdesk/shared` workspace, `pnpm@9.0.0`) |
| Auth | NIST SP 800-63B (password.ts, HIBP k-anonimity, hook DB, Edge auth-validate) |

## Funcionalidades implementadas (RF-01 a RF-15)

- **RF-01/03**: Validación robusta contraseña (8-64, NFKC, comunes, atributos usuario, secuencias, zxcvbn, HIBP), `supabase/config.toml` endurecido, hook `validate_password_hook` + `hibp_cache`, Edge `auth-validate`.
- **RF-04/05**: Sesión persistente con `expo-secure-store` cifrado, idle 30m (AppState + banner + signOut global), RBAC híbrido (RLS + `RequirePermission`/`useRole`).
- **RF-06**: Crear solicitud con validación, `mesa_id NOT NULL` + trigger `tickets_set_usuario`, `createTicket` inyecta `usuario_id`.
- **RF-08/09**: Listado paginado servidor + búsqueda `pg_trgm` (GIN asunto) + Realtime + pull-to-refresh; detalle paralelo 3 queries (ticket + estados + comentarios).
- **RF-13/15**: Comentarios internos (RLS solo técnico/jefe ven/marcan `interno`), input inline + Realtime.

## Requisitos

- Node 20, pnpm 9 (`corepack enable && corepack prepare pnpm@9.0.0 --activate`)
- Supabase CLI 2.115+ (solo para backend local / migraciones)

## Dev local

```bash
pnpm install
pnpm typecheck            # tsc --noEmit en todos los workspaces
pnpm test                 # vitest (shared)
pnpm mobile               # pnpm --filter mobile start (Expo)
pnpm web                  # pnpm --filter web start (Expo web, http://localhost:19006)
pnpm --filter @helpdesk/shared build   # Compila shared/src → shared/dist (requerido para web)
```

Backend local (opcional, requiere Docker):
```bash
supabase start            # DB, Auth, Storage, Realtime, Studio http://127.0.0.1:54323
supabase db reset         # Aplica migrations + seed
```

Variables env: copia `.env.example` a `.env` y ajusta:
```
EXPO_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
```

## Docker — despliegue revisable (web)

Web empaquetada con `expo export --platform web` + `nginx:1.27-alpine`. Mobile se revisa con Expo Go.

```bash
# 1. Configura env
cp .env.example .env  # edita EXPO_PUBLIC_SUPABASE_URL y ANON_KEY

# 2. Solo web contra Supabase Cloud (recomendado para revisión)
docker compose up --build -d
open http://localhost:3000

# 3. Contra Supabase local
supabase start
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon> docker compose up --build -d

# Logs / stop
docker compose logs -f web
docker compose down
```

Detalles:
- `apps/web/Dockerfile` multi-stage: `node:20-alpine` → `pnpm install --frozen-lockfile` → `pnpm --filter @helpdesk/shared build` → `expo export --platform web --clear` → `nginx` con `try_files $uri /index.html`.
- `docker-compose.yml` expone `web:3000`, healthcheck `wget http://localhost/`.
- `EXPO_PUBLIC_*` se inyectan como `ARG` en build (Expo las embebe en el bundle). Cambiar `.env` requiere rebuild.

### Troubleshooting Docker

| Error | Causa | Fix |
|-------|-------|-----|
| `missing @expo/metro-runtime` | Falta dep web | Ya incluido en `apps/web/package.json` (`~4.0.1`); no borrar de `pnpm-lock.yaml` |
| `Cannot resolve @babel/runtime` | pnpm aislado | Ya incluido en `apps/web` deps |
| `Unable to resolve module ./roles.js from shared/src/index.ts` | Metro intentaba resolver fuente TS con import `.js` | `shared` ahora compila a `dist/` y `apps/web/metro.config.js` bloquea `shared/src` y usa `main: dist/index.js` |
| `TS5083 Cannot read /app/tsconfig.json` | `shared/tsconfig.build.json` extendía `../tsconfig.json` no copiado | `shared/tsconfig.build.json` es standalone + `Dockerfile` hace `COPY tsconfig.json ./` |
| `CACHED [builder 7/9] pnpm install` 290s | Cache Docker retenido | `docker builder prune -f` o `docker compose build --no-cache web` |

## Tests y calidad

```bash
pnpm --filter @helpdesk/shared test   # vitest (roles, password, tickets)
pnpm typecheck
pnpm lint
```

## Notas

- Flutter no se usa. La decisión Expo/RN permite compartir `shared/` TypeScript entre web y móvil y usar `@supabase/supabase-js` unificado.
- `apps/mobile` y `apps/web` comparten `CreateTicketScreen`, `MisSolicitudesScreen`, `TicketDetailScreen` (react-native-web).
- `pnpm-workspace.yaml` + `tsconfig.json` paths `@helpdesk/shared` → `shared/src/index.ts` en dev, `shared/dist/index.js` en build/Docker.
