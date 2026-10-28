/* Shared by the parks specs: the park list, console-error capture, and the deep-link contract with the builder. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', 'data.js'), 'utf8'), ctx);
const PARKS = ctx.window.PROTO.PARKS;
const FULL = PARKS.filter((p) => p.level === 'full').map((p) => p.slug);
const BASICS = PARKS.filter((p) => p.level === 'basics').map((p) => p.slug);
const LISTED = PARKS.filter((p) => p.kind !== 'zone');

/** collects console errors and page errors; call .list() at the end of the test */
function watchErrors(page) {
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  return { list: () => errs };
}
/** the builder contract: /builder/index.html?m=near&n=0|1|2&p=<slug>, ?m=trip&cc=<CC>&p=<slug>, ?add=<park>--<place>&p=<park> */
function planVisitOk(href, park) {
  const u = new URL(href, 'http://x'); const q = u.searchParams;
  if (u.pathname !== '/builder/index.html' || q.get('p') !== park.slug) return false;
  if (q.get('m') === 'near') return ['0', '1', '2'].includes(q.get('n')) && [...q.keys()].sort().join() === 'm,n,p';
  if (q.get('m') === 'trip') return q.get('cc') === park.cc.toUpperCase() && /^[A-Z]{2}$/.test(q.get('cc')) && [...q.keys()].sort().join() === 'cc,m,p';
  return false;
}
function addOk(href, park) {
  const u = new URL(href, 'http://x'); const q = u.searchParams; const add = q.get('add') || '';
  return u.pathname === '/builder/index.html' && q.get('p') === park.slug && add.startsWith(park.slug + '--') && add.length > park.slug.length + 2 && /^[a-z0-9-]+$/.test(add) && [...q.keys()].sort().join() === 'add,p';
}
/** fulfil every external request so a new tab never needs the network */
async function stubExternal(context) {
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>external</title>' }));
}
module.exports = { PARKS, FULL, BASICS, LISTED, watchErrors, planVisitOk, addOk, stubExternal };
