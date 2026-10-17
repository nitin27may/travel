import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], locale: 'en-CA', viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' },
  outputDir: 'test-results',
});
