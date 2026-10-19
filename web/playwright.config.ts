import { defineConfig, devices } from '@playwright/test';

const base = { locale: 'en-CA', trace: 'retain-on-failure' as const };

// Chromium runs every spec. WebKit (iPhone 14 and desktop Safari) and Firefox run the smoke set only
// (cross-browser.spec.ts), and smart-search.spec.ts, whose keyboard and layout depend on the engine: the rest assert on engine-independent behaviour already covered there.
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: { ...base },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], ...base, viewport: { width: 1280, height: 900 } } },
    { name: 'webkit-iphone', testMatch: /(cross-browser|smart-search)\.spec\.ts/, use: { ...devices['iPhone 14'], ...base } },
    { name: 'webkit-desktop', testMatch: /(cross-browser|smart-search)\.spec\.ts/, use: { ...devices['Desktop Safari'], ...base, viewport: { width: 1280, height: 900 } } },
    { name: 'firefox', testMatch: /(cross-browser|smart-search)\.spec\.ts/, use: { ...devices['Desktop Firefox'], ...base, viewport: { width: 1280, height: 900 } } },
  ],
  outputDir: 'test-results',
});
