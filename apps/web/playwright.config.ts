// H16 — E2E Playwright contra build estático web (puerto 3100, sin chocar con :3000 de Docker).
import { defineConfig, devices } from '@playwright/test';

// Permite usar un Chrome instalado cuando la descarga de Chromium no está
// disponible (red restringida). En CI se mantiene el Chromium de Playwright.
const channel = process.env.PLAYWRIGHT_CHANNEL as 'chrome' | 'msedge' | undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['junit', { outputFile: 'junit-e2e.xml' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    ...(channel ? { channel } : {}),
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // H16 — smoke mobile mínimo: mismos flujos sin backend en viewport móvil
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: ['e2e/auth-validacion.spec.ts', 'e2e/guardias.spec.ts'],
    },
  ],
  webServer: {
    // --clear evita que Metro reutilice un bundle transformado con otras
    // EXPO_PUBLIC_* (por ejemplo, un build sin Supabase y otro con placeholders).
    command: 'pnpm --filter web exec expo export --platform web --clear && npx -y serve dist -l 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    // Los flujos sin sesión solo necesitan que el login renderice. Si no hay
    // Supabase real configurado, el build usa un destino inerte en vez de
    // mostrar la pantalla de configuración faltante y romper los E2E de UI.
    env: {
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    },
  },
});
