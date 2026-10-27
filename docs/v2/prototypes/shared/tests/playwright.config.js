/* Playwright config for the prototypes' shared tests. Run through docs/v2/prototypes/tests/run.sh, which puts web/node_modules
   on NODE_PATH. Reports and dumps go to docs/v2/prototypes/test-results (ignored). */
const path = require('node:path');
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /.*\.(test|spec)\.js$/,
  outputDir: path.resolve(__dirname, '..', '..', 'test-results', 'artifacts'),
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { browserName: 'chromium', launchOptions: { args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] } },
});
