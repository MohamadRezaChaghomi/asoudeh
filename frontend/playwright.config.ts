import { defineConfig, devices } from '@playwright/test';

const browserChannel = process.env.PLAYWRIGHT_CHANNEL === 'msedge' ? 'msedge' : undefined;
const isProductionPwaTest = process.env.PWA_TEST === 'true';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL,
    ...(browserChannel ? { channel: browserChannel } : {}),
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: isProductionPwaTest
      ? 'npm run start -- --hostname 127.0.0.1'
      : 'npm run dev -- --hostname 127.0.0.1',
    url: baseURL,
    reuseExistingServer: !process.env.CI && !isProductionPwaTest,
    timeout: 120_000,
  },
});
