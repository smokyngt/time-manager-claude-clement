import { defineConfig, devices } from '@playwright/test'

import { ADMIN_EMAIL, ADMIN_PASSWORD, E2E_DATABASE_URL } from './e2e/env'

const reuse = !process.env.CI

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  retries: process.env.CI ? 2 : 0,
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'cd ../api && bun run db:migrate && bun run db:seed && bun src/server.ts',
      env: {
        AUTH_LOGIN_RATE_LIMIT_MAX: '1000',
        AUTH_RATE_LIMIT_MAX: '1000',
        CORS_ORIGIN: 'http://localhost:5173',
        DATABASE_URL: E2E_DATABASE_URL,
        JWT_ACCESS_SECRET: 'e2e-access-secret-at-least-32-characters',
        JWT_REFRESH_SECRET: 'e2e-refresh-secret-at-least-32-characters',
        LOG_LEVEL: 'warn',
        NODE_ENV: 'development',
        PORT: '8000',
        SEED_ADMIN_EMAIL: ADMIN_EMAIL,
        SEED_ADMIN_PASSWORD: ADMIN_PASSWORD,
        USER_RATE_LIMIT_MAX: '1000',
        WEB_URL: 'http://localhost:5173',
      },
      reuseExistingServer: reuse,
      timeout: 120_000,
      url: 'http://localhost:8000/health',
    },
    {
      command: 'bun run dev',
      reuseExistingServer: reuse,
      timeout: 120_000,
      url: 'http://localhost:5173',
    },
  ],
  workers: process.env.CI ? 2 : undefined,
})
