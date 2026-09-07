#!/usr/bin/env bash
# Genera .env.local desde el stack Supabase local en ejecución
# Uso: pnpm supa:env  |  ./scripts/supa-env.sh
set -euo pipefail
if ! npx supabase status >/dev/null 2>&1; then
  echo "Supabase local no está corriendo. Levantándolo con 'npx supabase start'..."
  npx supabase start
fi
echo "Extrayendo claves de 'supabase status -o env'..."
ENV_OUT=$(npx supabase status -o env)
ANON=$(echo "$ENV_OUT" | grep -o 'ANON_KEY=[^ ]*' | cut -d= -f2 | tr -d '"')
SERVICE=$(echo "$ENV_OUT" | grep -o 'SERVICE_ROLE_KEY=[^ ]*' | cut -d= -f2 | tr -d '"')
URL="http://127.0.0.1:54321"
if [ -z "$ANON" ]; then
  echo "No se pudo extraer ANON_KEY. ¿supabase start terminó? Revisa 'npx supabase status'."
  exit 1
fi
cat > .env.local <<EOF
# Generado automáticamente por scripts/supa-env.sh — no commitear
EXPO_PUBLIC_SUPABASE_URL=$URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SERVICE
EOF
echo "✅ .env.local escrito (para uso fuera de Docker / Studio):"
cat .env.local | sed 's/eyJ[^ ]*/***JWT***/'
# .env es el que consume docker-compose.dev.yml; dentro del contenedor 127.0.0.1 no resuelve,
# por eso se usa host.docker.internal (resuelto vía extra_hosts + /etc/hosts de Docker Desktop)
URL_DOCKER="http://host.docker.internal:54321"
cat > .env <<EOF
# Generado por scripts/supa-env.sh — apunta a Supabase local vía host.docker.internal
EXPO_PUBLIC_SUPABASE_URL=$URL_DOCKER
EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SERVICE
EOF
echo "✅ .env escrito (para docker-compose.dev.yml, usa host.docker.internal):"
cat .env | sed 's/eyJ[^ ]*/***JWT***/'
echo ""
echo "Ahora: pnpm dev:local  |  pnpm docker:dev"
