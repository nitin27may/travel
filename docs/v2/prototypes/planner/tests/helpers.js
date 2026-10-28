/* Helpers for the planner specs: a clean browser profile per test, trip reads through the contract, console-error capture. */
const { test, expect } = require('../../shared/tests/fixtures.js');

/** Collects page errors and console errors; call `errors()` at the end of a test. */
function watch(page) {
  const list = [];
  page.on('pageerror', (e) => list.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') list.push('console: ' + m.text()); });
  return () => list;
}
/** Empty storage, then open `path` so the planner seeds itself the way a first visit does. */
async function open(page, base, path, opts = {}) {
  await page.goto(base + '/planner/index.html');
  await page.evaluate(() => { localStorage.clear(); });
  if (opts.today) await page.evaluate((d) => localStorage.setItem('proto.planner', JSON.stringify({ today: d })), opts.today);
  if (opts.theme) await page.evaluate((th) => localStorage.setItem('proto.theme', th), opts.theme);
  await page.goto(base + path);
  await page.waitForSelector(opts.ready || '#app > *');
}
/** The stored trips, read through the same contract the pages use. */
function trips(page) {
  return page.evaluate(() => window.ProtoContract.readTrips(localStorage));
}
module.exports = { test, expect, watch, open, trips };
