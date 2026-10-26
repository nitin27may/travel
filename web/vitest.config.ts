import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)), 'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)) } },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    testTimeout: 30000,
    hookTimeout: 300000,
    globalSetup: ['tests/global-setup.ts'],
    // the household home point comes from the environment; without it the core setup injects a decoy (core/src/config/home.ts)
    setupFiles: ['../core/test/setup/home-point.ts'],
  },
});
