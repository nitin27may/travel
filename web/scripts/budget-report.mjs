// Budget measures shared by the budget tests and `pnpm --dir web budget:report` (BUD-1), so a hand-back quotes the
// numbers the gate checks, measured the same way.
//
// Shell chrome is the header, the footer, the phone bottom bar and the analytics beacon tag (Q260): their markup, plus
// their share of the inline RSC payload (the serialized subtrees and the payload rows only they reference). It has its
// own cap (CHROME_CAP_BYTES, web/tests/data/shell-size.test.ts).
//
// Place size (S13) holds the shell at its baseline size: a page counts as `page - chrome now + chrome at the baseline`,
// against the baseline page. A footer link, a bar item or the beacon therefore cannot move S13, and every byte a record
// or a place section adds still counts (P8). The +25% keeps the meaning it had when it was set on whole pages; dividing
// content by content instead would tighten it (the shell is the part that did not grow), which only the owner can do.
//
// Usage: node scripts/budget-report.mjs [distDir]   (default .next; reads a server build, prints under 20 lines)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** S13: the median and the largest place page may grow by this ratio over the baseline (web/tests/data/place-size.test.ts). */
export const PLACE_MEDIAN_BUDGET = 1.25;
/** No single place page grows by more than this, except the pages in OVER_50. */
export const PAGE_CAP = 1.5;
/** The pages in OVER_50 stay under this. */
export const EXCEPTION_CAP = 2;
/**
 * No single page grows by more than 50%, except these. They are small pages (about 45 kB before) of fully researched records: every
 * suitability group, provenance row and section now has content, and the page carries it once in the payload. They stay under +100%.
 * CS7c added Funbob, Otzi, Paint Pots and Wedge Pond (+51 to 54%): small pages that gained a full record (price, hours, season, official links).
 * PLC (stage 4) added lago-di-carezza (+49.7% to +51.2%): a small page that crossed the line by the stroller and wheelchair chips at rest (S10),
 * which are drawn twice (markup and payload); the median grew by 0.05%.
 * PLC2a (trail strip) added grand-view-point-walk (+51.1%), mesa-arch (+52.4%) and lago-federa-walk (+55.8%): small, sparse trail pages that were at
 * +37% to +49% already and now carry the 15-tile key-facts strip (each gap tile is a marker we must show); the strip is the single source on a trail page.
 * A page leaves this list when it passes 50%; a new one must be argued in review, not added here.
 */
export const OVER_50 = new Set(["grand-view-point-walk", "mesa-arch", "lago-federa-walk", "rafting-on-the-rienza", "chorrillo-del-salto", "coastal-path", "delicate-arch-trail", "devils-garden", "emerald-lakeshore", "grassi-lakes-easy-route", "ha-ling-peak", "hickman-bridge", "iceline-trail", "lac-blanc-via-flegere", "lago-di-braies-walk", "laguna-capri", "laguna-de-los-tres", "laguna-esmeralda", "lake-louise", "lower-calf-creek-falls", "marble-canyon-walk", "mirador-de-las-aguilas", "mirador-de-los-condores", "narrows-from-the-temple-of-sinawava", "navajo-loop-and-queens-garden", "parus-trail", "plan-de-laiguille", "riverside-walk", "scout-lookout-angels-landing-chains-view", "skaftafell-svartifoss", "solitaire-lake-trail", "stowe-recreation-path", "takakkaw-falls-walk", "track-and-tower-trail", "troll-falls", "upheaval-dome", "windows-section", "funbob-monte-baranci", "otzi-south-tyrol-museum-of-archaeology", "paint-pots-walk", "wedge-pond-loop", "lago-di-carezza"]);
/** Gzipped KB of the scripts any page loads at start (web/tests/budget.test.ts). */
export const START_JS_BUDGET_KB = 200;
/**
 * The largest shell chrome on any page of each build on 25 Oct 2026 (BUD-1, measured on main 4fe7721c), without the beacon.
 * The cap is this, plus the beacon allowance, plus 1 KB (Q260). A shell change that needs more is argued in review, not raised here.
 */
export const CHROME_TODAY_BYTES = { public: 4004, signIn: 5669 };
/**
 * Bytes the Cloudflare beacon tag adds to a page with a production token: 320 B in the beacon fixture build (151 markup, 169
 * payload) with its 17-character token, plus 15 B in each copy for a 32-character one. A build without the token is charged
 * this, so the cap holds the deployed page and not only the local build.
 */
export const BEACON_ALLOWANCE_BYTES = 350;
export const CHROME_HEADROOM_BYTES = 1024;
export const CHROME_CAP_BYTES = {
  public: CHROME_TODAY_BYTES.public + BEACON_ALLOWANCE_BYTES + CHROME_HEADROOM_BYTES,
  signIn: CHROME_TODAY_BYTES.signIn + BEACON_ALLOWANCE_BYTES + CHROME_HEADROOM_BYTES,
};

const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';
const bytes = (s) => Buffer.byteLength(s, 'utf8');

// ---- start JS (the 200 KB gate) ----

/**
 * Same-origin <script src> tags in the HTML that a modern browser runs at load: what is there before any dynamic import.
 * `noModule` scripts (legacy polyfills) are skipped, as browsers do.
 */
export function startScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>/g)]
    .map((m) => m[1])
    .filter((attrs) => !/\bnoModule\b/i.test(attrs))
    .map((attrs) => /\ssrc="([^"]+)"/.exec(` ${attrs}`)?.[1])
    .filter((s) => Boolean(s) && s.startsWith('/'));
}

/** Gzipped bytes of the unique scripts, read through `resolve` (a `/_next/static/...` URL to a file path). */
export function gzippedBytes(srcs, resolve) {
  return [...new Set(srcs)].reduce((n, s) => n + gzipSync(readFileSync(resolve(s.split('?')[0]))).length, 0);
}

// ---- the inline RSC payload ----

// Next writes the payload as `self.__next_f.push([1,"<JSON string>"])`, the string html-escaped (& < > U+2028 U+2029).
const PUSH = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
const htmlEscape = (s) => s.replace(/[&<>\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

/** The decoded payload text of a page and the pieces it came from, so a decoded range maps back to the bytes it took in the HTML. */
export function flightOf(html) {
  const pieces = [];
  let text = '';
  for (const m of html.matchAll(PUSH)) {
    const s = JSON.parse(m[1]);
    pieces.push({ from: text.length, to: text.length + s.length, text: s });
    text += s;
  }
  return { text, pieces };
}

/** HTML bytes that the decoded payload range [a, b) occupies (exact: the escaping is per character). */
function encodedBytes(flight, a, b) {
  let n = 0;
  for (const p of flight.pieces) {
    const lo = Math.max(a, p.from);
    const hi = Math.min(b, p.to);
    if (lo < hi) n += bytes(htmlEscape(JSON.stringify(p.text.slice(lo - p.from, hi - p.from)))) - 2;
  }
  return n;
}

/** End (exclusive) of the JSON array or object that opens at `start`, skipping strings. */
function jsonEnd(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      for (i++; i < text.length && text[i] !== '"'; i++) if (text[i] === '\\') i++;
    } else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  throw new Error(`unbalanced payload at ${start}`);
}

/** Payload rows `id:<one line>` by id (module rows `I[...]` and model rows; length-prefixed text rows are not chrome and are skipped). */
function rowsOf(text) {
  const rows = new Map();
  for (const m of text.matchAll(/(?:^|\n)([0-9a-f]+):(?!T[0-9a-f]+,)([^\n]*)/g)) {
    const from = m.index + (m[0].startsWith('\n') ? 1 : 0);
    rows.set(m[1], { from, to: from + m[1].length + 1 + m[2].length + 1, body: m[2] });
  }
  return rows;
}

const REF = /"\$[L@]?([0-9a-f]+)(?=["])/g;

/** Payload ranges of the shell: its element subtrees and every row that only they reference (transitively). */
function chromeFlight(text) {
  const rows = rowsOf(text);
  const exportsOf = new Map();
  for (const [id, r] of rows) {
    const m = /^I(\[.*\])$/.exec(r.body);
    if (!m) continue;
    const name = JSON.parse(m[1])[2];
    exportsOf.set(id, name);
  }
  const ranges = [];
  const roots = { header: 0, footer: 0, bar: 0, beacon: 0 };
  const addElement = (start, part) => {
    const end = jsonEnd(text, start);
    ranges.push([start, end]);
    roots[part] += 1;
  };
  for (const [id, name] of exportsOf) {
    const part = name === 'SiteHeader' ? 'header' : name === 'BottomBar' ? 'bar' : null;
    if (!part) continue;
    for (const m of text.matchAll(new RegExp(`\\["\\$","\\$L${id}",`, 'g'))) addElement(m.index, part);
  }
  for (const m of text.matchAll(/\["\$","footer",(?:null|"[^"]*"),\{"className":"site-footer"/g)) addElement(m.index, 'footer');
  for (const m of text.matchAll(/\["\$","script",(?:null|"[^"]*"),\{/g)) {
    const end = jsonEnd(text, m.index);
    if (text.slice(m.index, end).includes(`"src":"${BEACON_SRC}"`)) {
      ranges.push([m.index, end]);
      roots.beacon += 1;
    }
  }
  // rows referenced only from inside the chrome ranges belong to it (a shell client component's module row, say)
  const inChrome = (i) => ranges.some(([a, b]) => i >= a && i < b);
  for (let grew = true; grew; ) {
    grew = false;
    const refs = new Set();
    for (const [a, b] of [...ranges]) for (const m of text.slice(a, b).matchAll(REF)) refs.add(m[1]);
    for (const id of refs) {
      const row = rows.get(id);
      if (!row || inChrome(row.from)) continue;
      const elsewhere = [...text.matchAll(new RegExp(`"\\$[L@]?${id}(?=["])`, 'g'))].some((m) => !inChrome(m.index) && !(m.index >= row.from && m.index < row.to));
      if (elsewhere) continue;
      ranges.push([row.from, row.to]);
      grew = true;
    }
  }
  // merged, so a byte is never counted twice
  const merged = [];
  for (const [a, b] of ranges.sort((x, y) => x[0] - y[0])) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return { ranges: merged, roots };
}

// ---- the markup ----

/** [start, end) of the element that opens at `start`, matching nested tags of the same name. */
function elementEnd(html, start, tag) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  throw new Error(`unclosed <${tag}> at ${start}`);
}

const MARKUP = [
  { part: 'header', tag: 'header', open: /<header class="site-header"/g },
  { part: 'footer', tag: 'footer', open: /<footer class="site-footer"/g },
  { part: 'bar', tag: 'nav', open: /<nav class="bottom-bar"/g },
  { part: 'beacon', tag: 'script', open: new RegExp(`<script\\b[^>]*src="${BEACON_SRC.replace(/[.]/g, '\\.')}"`, 'g') },
];

/**
 * The shell chrome of one page's HTML, in bytes: `markup` (the elements as served), `payload` (their share of the inline
 * RSC payload), `total`, and per part. Throws when the header, footer or bottom bar is missing from either side: a shell
 * renamed or moved must update this method, never measure as zero. A redirect or error document (no layout) has no shell
 * and measures zero with `shell: false`. `beacon` is true when the page carries the tag; `signIn` when the bar has the
 * account items (the sign-in-on build).
 */
export function chromeOf(html) {
  const parts = { header: 0, footer: 0, bar: 0, beacon: 0 };
  const found = { header: 0, footer: 0, bar: 0, beacon: 0 };
  let markup = 0;
  let signIn = false;
  for (const { part, tag, open } of MARKUP) {
    for (const m of html.matchAll(open)) {
      const el = html.slice(m.index, elementEnd(html, m.index, tag));
      const n = bytes(el);
      if (part === 'bar') signIn = el.includes(' data-acct="');
      parts[part] += n;
      markup += n;
      found[part] += 1;
    }
  }
  if (!found.header && !found.footer && !found.bar && /^<!DOCTYPE html><html id="__next_error__"/.test(html)) {
    return { markup: 0, payload: 0, total: 0, parts, shell: false, beacon: false, signIn: false };
  }
  const flight = flightOf(html);
  const { ranges, roots } = chromeFlight(flight.text);
  const payload = ranges.reduce((n, [a, b]) => n + encodedBytes(flight, a, b), 0);
  for (const part of ['header', 'footer', 'bar']) {
    if (found[part] !== 1) throw new Error(`chrome: expected one ${part} element in the markup, found ${found[part]}`);
    if (roots[part] !== 1) throw new Error(`chrome: expected one ${part} subtree in the payload, found ${roots[part]}`);
  }
  if (found.beacon !== roots.beacon) throw new Error(`chrome: ${found.beacon} beacon tags in the markup, ${roots.beacon} in the payload`);
  return { markup, payload, total: markup + payload, parts, shell: true, beacon: found.beacon > 0, signIn };
}

/** Chrome as the cap reads it: a page without the beacon is charged the allowance, so the cap holds the deployed page. */
export function chargedChrome(c) {
  return c.total + (c.beacon ? 0 : BEACON_ALLOWANCE_BYTES);
}

// ---- S13 ----

/**
 * One row per baseline page that the build has: `was` is the baseline page, `now` is today's page with today's chrome
 * swapped for the chrome it had at the baseline (`baseline.chrome`, measured by chromeOf on a rebuild of that commit).
 * `htmlOf(slug)` returns the page's HTML or null when the build does not have it.
 */
export function placeRows(baseline, htmlOf) {
  return Object.entries(baseline.pages).flatMap(([slug, was]) => {
    const html = htmlOf(slug);
    if (html == null) return [];
    const then = baseline.chrome?.[slug];
    if (typeof then !== 'number') throw new Error(`place-html-baseline.json has no chrome for ${slug}`);
    const c = chromeOf(html).total;
    return [{ slug, was, now: bytes(html) - c + then, page: bytes(html), chromeNow: c, chromeThen: then }];
  });
}

/** The median ratio and its page, the largest page against the largest baseline, and the pages over their own cap. */
export function s13(rows) {
  const sorted = [...rows].sort((a, b) => a.now / a.was - b.now / b.was);
  const mid = sorted[Math.floor(sorted.length / 2)];
  const largestWas = Math.max(...rows.map((r) => r.was));
  const largestNow = Math.max(...rows.map((r) => r.now));
  const over = rows.filter((r) => r.now / r.was > (OVER_50.has(r.slug) ? EXCEPTION_CAP : PAGE_CAP));
  return { median: mid.now / mid.was, mid, largest: largestNow / largestWas, largestWas, largestNow, over };
}

// ---- the report ----

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const f = path.join(dir, name);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (name.endsWith('.html') && !name.startsWith('_global-error')) out.push(f);
  }
  return out;
}

/** The report lines for one server build (`dist` relative to web/). */
export function report(dist = '.next') {
  const root = path.resolve(WEB, dist);
  const app = path.join(root, 'server', 'app');
  if (!existsSync(path.join(root, 'BUILD_ID'))) throw new Error(`no server build in ${root}: run \`pnpm --dir web build\` first`);
  const baseline = JSON.parse(readFileSync(path.join(WEB, 'tests', 'data', 'place-html-baseline.json'), 'utf8'));
  const rows = placeRows(baseline, (slug) => {
    const f = path.join(app, 'places', `${slug}.html`);
    return existsSync(f) ? readFileSync(f, 'utf8') : null;
  });
  const r = s13(rows);
  const pages = walk(app);
  let top = { charged: -1, page: '', c: null };
  let signIn = false;
  let js = { kb: 0, page: '' };
  let trip = { kb: 0, page: '' };
  const resolve = (s) => path.join(root, 'static', s.replace(/^\/_next\/static\//, ''));
  for (const f of pages) {
    const html = readFileSync(f, 'utf8');
    const rel = path.relative(app, f).replace(/\.html$/, '');
    const c = chromeOf(html);
    if (!c.shell) continue;
    signIn ||= c.signIn;
    if (chargedChrome(c) > top.charged) top = { charged: chargedChrome(c), page: rel, c };
    const kb = gzippedBytes(startScripts(html), resolve) / 1024;
    if (kb > js.kb) js = { kb, page: rel };
    if (/^trips\/[^/]+$/.test(rel) && kb > trip.kb) trip = { kb, page: rel };
  }
  const build = signIn ? 'signIn' : 'public';
  const cap = CHROME_CAP_BYTES[build];
  const room = (kb) => `${Math.round((START_JS_BUDGET_KB - kb) * 1024)} B`;
  return [
    `budget report: ${dist} (${build === 'signIn' ? 'sign-in on' : 'public'} build, ${pages.length} pages)`,
    `place size (S13: page with its baseline chrome, against tests/data/place-html-baseline.json; ${rows.length} pages)`,
    `  median ${r.median.toFixed(4)} of ${PLACE_MEDIAN_BUDGET} (${r.mid.slug} ${r.mid.now} B against ${r.mid.was} B); headroom ${Math.floor(r.mid.was * PLACE_MEDIAN_BUDGET - r.mid.now)} B`,
    `  largest ${r.largest.toFixed(4)} of ${PLACE_MEDIAN_BUDGET} (${r.largestNow} B against ${r.largestWas} B); headroom ${Math.floor(r.largestWas * PLACE_MEDIAN_BUDGET - r.largestNow)} B`,
    `  pages over their own cap (${PAGE_CAP}, listed ${EXCEPTION_CAP}): ${r.over.length ? r.over.map((x) => `${x.slug} ${(x.now / x.was).toFixed(3)}`).join(', ') : 'none'}`,
    `shell chrome (header, footer, bottom bar, beacon; markup and payload)`,
    `  largest ${top.charged} B of ${cap} B (${top.page}: markup ${top.c.markup}, payload ${top.c.payload}${top.c.beacon ? '' : `, beacon allowance ${BEACON_ALLOWANCE_BYTES}`}); headroom ${cap - top.charged} B`,
    `  markup by part: header ${top.c.parts.header}, footer ${top.c.parts.footer}, bar ${top.c.parts.bar}, beacon ${top.c.parts.beacon}`,
    `start JS (gzipped scripts at load, limit ${START_JS_BUDGET_KB} KB)`,
    `  heaviest page ${js.kb.toFixed(1)} KB (${js.page}); headroom ${room(js.kb)}`,
    `  heaviest trip page ${trip.kb.toFixed(1)} KB (${trip.page}); headroom ${room(trip.kb)}`,
  ];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(report(process.argv[2] || '.next').join('\n'));
}
