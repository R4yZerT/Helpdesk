# Jenkins CI/CD — Guía de puesta en marcha (HelpDesk)

Jenkins LTS local: `http://127.0.0.1:8080` (servicio brew `jenkins-lts`).
Pipeline definido en `/Jenkinsfile`. Decisión vigente: **Jenkins local + Docker local**,
móvil vía **EAS Build + EAS Update**. No tocar código de features desde CI.

## 1. Credenciales requeridas (Jenkins > Manage Jenkins > Credentials)

| ID (exacto)            | Tipo        | Valor                                      | Cuándo se usa                        |
|------------------------|-------------|--------------------------------------------|--------------------------------------|
| `supabase-url`         | Secret text | `EXPO_PUBLIC_SUPABASE_URL` (https://…)     | Siempre (Install, Docker web)        |
| `supabase-anon-key`    | Secret text | `EXPO_PUBLIC_SUPABASE_ANON_KEY`            | Siempre (Install, Docker web)        |
| `supabase-access-token`| Secret text | Personal Access Token de Supabase          | Solo si `PUSH_SUPABASE_DB=true`      |
| `expo-token`           | Secret text | Token de acceso Expo (`eas whoami` → token)| Solo si `EAS_BUILD != none`         |

Sin `supabase-url` / `supabase-anon-key` el build falla en el stage Install.

## 2. Crear el job (opción A — script)

```bash
export JENKINS_USER=admin JENKINS_TOKEN=<tu-api-token>
# El token se genera en Jenkins > usuario > Configure > API Token
./scripts/jenkins-create-job.sh HelpDesk
```

El script usa `jenkins/job-config.xml` (job Pipeline, Git origin,
rama `fix/pr-misSolicitudes-ia-adjuntos`, Script Path `Jenkinsfile`).

## 3. Crear el job (opción B — UI manual)

1. Jenkins > **New Item** → nombre `HelpDesk` → tipo **Pipeline** → OK.
2. **Pipeline** > Definition: `Pipeline script from SCM`.
   - SCM: **Git**; Repository URL: `https://github.com/R4yZerT/Helpdesk.git`
   - Branch: `*/fix/pr-misSolicitudes-ia-adjuntos`
   - Script Path: `Jenkinsfile`
3. **Build Triggers**: vacío (lanzamiento manual / parametrizado).
4. Save → **Build with Parameters**.

## 4. Parámetros del pipeline

| Parámetro        | Default | Efecto                                             |
|------------------|---------|----------------------------------------------------|
| `DEPLOY_WEB`     | true    | `docker compose build web` + `up -d web` (:3000)   |
| `PUSH_SUPABASE_DB`| false  | `supabase db push --linked` (opt-in, con token)    |
| `EAS_BUILD`      | none    | `preview` / `production` → EAS Build cloud         |

Stages: Checkout → Toolchain → Install → Build shared → Typecheck → Test →
Supabase DB push (opt-in) → Docker build+deploy web → EAS build (opt-in).

## 5. Móvil / EAS (pendiente de tokens del usuario)

- `apps/mobile/eas.json` ya existe (profiles `development`/`preview`/`production`).
- Falta **una vez**: `cd apps/mobile && eas login && eas init` (vincula
  `extra.eas.projectId` en `app.json`) y crear la credencial `expo-token` en Jenkins.
- EAS Update (OTA) se hace manual por ahora:
  `cd apps/mobile && eas update --branch production`.

## 6. Pendientes (requieren acción del usuario)

- [ ] Crear las 4 credenciales en la UI de Jenkins (§1).
- [ ] Crear el job (script §2 o UI §3).
- [ ] Generar API token de Jenkins para el script / lanzar primer build.
- [ ] `eas login && eas init` en `apps/mobile` + credencial `expo-token`.
- [ ] (Opcional) `PUSH_SUPABASE_DB=true` solo cuando se quiera aplicar migraciones.
