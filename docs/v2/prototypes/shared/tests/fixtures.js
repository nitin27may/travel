/* One prototype server per worker; tests receive `base` (its URL). */
const base = require('@playwright/test');
const { startServer } = require('./serve.js');

exports.test = base.test.extend({
  base: [async ({}, use) => { const s = await startServer(); try { await use(s.url); } finally { s.stop(); } }, { scope: 'worker' }],
});
exports.expect = base.expect;
