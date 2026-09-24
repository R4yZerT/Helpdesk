// H16 — E2E Playwright contra build estático web (puerto 3100, sin chocar con :3000 de Docker).
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['junit', { outputFile: 'junit-e2e.xml' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
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
    command: 'pnpm --filter web build && npx -y serve dist -l 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
