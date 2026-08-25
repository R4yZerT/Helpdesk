# Web HelpDesk — Expo Web via nginx (revisión)
# Build: docker build -t helpdesk-web apps/web  |  Run: docker run -p 3000:80 --env-file .env helpdesk-web
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
# Copia workspace raíz para resolver @helpdesk/shared
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.json ./
COPY shared ./shared
COPY apps/web ./apps/web
# Instala deps del workspace (respeta pnpm-lock.yaml que ya incluye @expo/metro-runtime y @babel/runtime)
RUN pnpm install --frozen-lockfile
# Compila shared a dist/ para que Metro resuelva @helpdesk/shared via "main" (dist/index.js)
RUN pnpm --filter @helpdesk/shared build
# Variables en build time para Expo (EXPO_PUBLIC_*)
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ENV EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL
ENV EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY
WORKDIR /app/apps/web
RUN npx expo export --platform web --clear

FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
