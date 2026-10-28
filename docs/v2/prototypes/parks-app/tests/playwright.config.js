/* Playwright config for the parks prototype specs. Run through run.sh (puts web/node_modules on NODE_PATH). The helpers
   (server, fixtures, contrast, keyboard, a11y) come from ../../shared/tests; nothing here is copied from them. */
const path = require('node:path');
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /.*\.(test|spec)\.js$/,
  outputDir: path.resolve(__dirname, '..', '..', 'test-results', 'parks-artifacts'),
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { browserName: 'chromium', launchOptions: { args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] } },
});
