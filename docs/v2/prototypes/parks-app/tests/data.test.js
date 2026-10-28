/* Parks data: one source for the index and the page, and every invented value flagged. No browser. */
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP = path.resolve(__dirname, '..');
function load() {
  const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(APP, 'data.js'), 'utf8'), ctx);
  return ctx.window.PROTO;
}
const P = load();
const SLUGS = P.PARKS.map((p) => p.slug);

test('ten parks: six full pages and four Basics only', () => {
  expect(P.PARKS).toHaveLength(10);
  const full = P.PARKS.filter((p) => p.level === 'full').map((p) => p.slug).sort();
  expect(full).toEqual(['algonquin-provincial-park', 'banff-national-park', 'jasper-national-park', 'killarney-provincial-park', 'lake-ohara-area', 'yoho-national-park']);
  const basics = P.PARKS.filter((p) => p.level === 'basics').map((p) => p.slug).sort();
  expect(basics).toEqual(['bruce-peninsula-national-park', 'castle-provincial-park', 'kootenay-national-park', 'zion-national-park']);
});

test('a full park carries every section of data the page renders', () => {
  for (const p of P.PARKS.filter((x) => x.level === 'full')) {
    for (const k of ['rows', 'safety', 'season', 'camps', 'todo', 'airport', 'gateway', 'sources', 'closures', 'glanceCamp']) expect(p[k], `${p.slug}.${k}`).toBeTruthy();
    expect(p.rows.length, p.slug).toBeGreaterThanOrEqual(2);
    expect(p.camps.length, p.slug).toBeGreaterThanOrEqual(1);
  }
});

test('facts() is the only place chip text is built: three facts per park', () => {
  for (const p of P.PARKS) {
    const f = P.facts(p);
    expect(Object.keys(f).sort()).toEqual(['camping', 'entry', 'season']);
    for (const k of Object.keys(f)) expect(typeof f[k].text).toBe('string');
  }
  expect(P.facts(P.PARKS.find((p) => p.slug === 'jasper-national-park')).camping.text).toBe('3 campgrounds');
});

test('every stored URL is a placeholder URL and is stored (sources, rows, camps, alerts)', () => {
  for (const p of P.PARKS) {
    expect(p.sources.length, p.slug).toBeGreaterThan(0);
    for (const s of p.sources) { expect(s.url).toMatch(/^https:\/\/example\.org\/placeholder\//); expect(s.ph).toBe(true); }
    for (const r of [...(p.rows || []), ...(p.camps || [])]) expect(r.url, `${p.slug} ${r.name}`).toMatch(/^https:\/\/example\.org\/placeholder\//);
    expect(p.alertsUrl).toMatch(/^https:\/\/example\.org\//);
  }
});

/* grep-style: the word never sits inside a value (the page prints the tag from the flag), and a flagged park flags every record */
test('no unlabelled placeholder value: no value contains the word, every record of a placeholder park is flagged', () => {
  const bad = [];
  (function walk(v, trail) {
    if (typeof v === 'string') { if (/placeholder/i.test(v) && !/^https:\/\/example\.org\//.test(v)) bad.push(trail + ' = ' + v); return; }
    if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], trail + '.' + k);
  })(P.PARKS, 'PARKS');
  expect(bad).toEqual([]);
  for (const p of P.PARKS.filter((x) => x.placeholder)) {
    for (const r of [...(p.rows || []), ...(p.camps || []), ...(p.closures || [])]) expect(r.ph, `${p.slug} ${r.name || r.member}`).toBe(true);
    if (p.airport) expect(p.airport.ph, p.slug + ' airport').toBe(true);
    if (p.gateway) expect(p.gateway.ph, p.slug + ' gateway').toBe(true);
    if (p.glanceCamp) expect(p.glanceCamp.ph, p.slug + ' camp glance').toBe(true);
    if (p.safety) expect(p.safety.ph, p.slug + ' safety').toBe(true);
  }
  for (const p of P.PARKS) { if (p.airport) expect(p.airport.ph, p.slug + ' airport').toBe(true); for (const c of p.camps || []) expect(c.ph, `${p.slug} ${c.name}`).toBe(true); }
});

test('the app source never writes the word into a visible string outside the tag and the notes', () => {
  const src = ['park.js', 'index.js', 'app.js'].map((f) => [f, fs.readFileSync(path.join(APP, f), 'utf8')]);
  for (const [f, raw] of src) {
    const text = raw.replace(/\/\*[\s\S]*?\*\//g, '');
    const hits = text.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /placeholder/i.test(l) && !/^\s*(\/\/|\/\*)/.test(l)).filter(([, l]) => !/ph\(|A\.ph|phtag|protonote|Placeholder data|Placeholder:|Placeholder URL|\.placeholder|URL_BASE|placeholder=|Photo placeholder|class="ph"|"placeholder"|\/\*/.test(l));
    expect(hits.map(([n, l]) => f + ':' + n + ' ' + l.trim().slice(0, 80)), f).toEqual([]);
  }
});

test('slugs are unique and the page default exists', () => { expect(new Set(SLUGS).size).toBe(SLUGS.length); expect(SLUGS).toContain('banff-national-park'); });
