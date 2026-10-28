/* Playwright config for the planner prototype's specs. Run through planner/tests/run.sh, which puts web/node_modules on NODE_PATH.
   The specs reuse the shared helpers in ../../shared/tests (server fixture, contrast, keyboard walker, accessibility dump). */
const path = require('node:path');
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /.*\.spec\.js$/,
  outputDir: path.resolve(__dirname, '..', '..', 'test-results', 'planner-artifacts'),
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { browserName: 'chromium', launchOptions: { args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] } },
});
