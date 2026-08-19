# HelpDesk — Mesa de Servicio con IA

Prototipo de estructura del proyecto (monorepo). Sistema de mesa de ayuda
municipal con 4 roles (Empleado, Técnico, Jefe, Administrador), dashboards
en tiempo real e IA predictiva. Curso Programación Móvil, Institución
Universitaria de Envigado, 2026.

## Estructura

```
HelpDesk/
├── apps/
│   ├── mobile/              # App movil: Expo / React Native (TypeScript)
│   └── web/                 # Version web via react-native-web
├── shared/                  # Tipos y contratos compartidos entre apps
├── supabase/                # Backend: config, migraciones, Edge Functions
│   ├── config.toml          #   Configuracion del proyecto
│   ├── migrations/          #   Esquema SQL versionado (tables, RLS, triggers)
│   ├── functions/classify/  #   Edge Function IA de clasificacion (stub)
│   └── seed.sql
├── .mcp.json                # MCP server de Supabase (para el agente)
└── documento-requisitos.md  # Etapa 1 SLC: requisitos del sistema
```

## Backend (Supabase)

- **Postgres** — integridad ACID, RLS a nivel de fila, Realtime para el dashboard.
- **Auth** — JWT + RBAC (NIST SP 800-63B).
- **Storage** — adjuntos de tickets (RF-07).
- **Edge Function `classify`** — clasificación IA opcional, fuera del path crítico.
- **IA predictiva** (RF-19/20/21) — batch `pg_cron` que escribe tablas de
  predicción; el dashboard lee tablas, nunca el modelo.

## Stack

| Capa | Elección |
|------|----------|
| Móvil + Web | Expo / React Native + TypeScript (`react-native-web`) |
| Backend | Supabase (configuración > código) |
| Contratos | `shared/` (tipos TypeScript) |
| Paquetes | pnpm (monorepo) |

## Dev

```bash
pnpm install          # instala dependencias
pnpm mobile           # app movil (Expo)
pnpm web              # version web
```

Para el backend local: `supabase start` (requiere CLI de Supabase).