import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  outputDir: './e2e/test-results',
  reporter: [['list']],
  fullyParallel: true,
  retries: 0,
  workers: 3,
  timeout: 30 * 1000,
  expect: { timeout: 8000 },
  use: {
    baseURL: 'http://localhost:3003',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  // Reuse existing server — we already started it on 3003
  webServer: {
    command: 'pnpm dev -- --port 3003',
    url: 'http://localhost:3003',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  globalTeardown: require.resolve('./e2e/global-teardown.ts'),
  projects: [
    { name: 'auth setup', testMatch: 'auth.setup.ts', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['auth setup'],
    },
  ],
});
