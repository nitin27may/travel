// City areas for the globe (owner feedback F3, spec 4.2 and 11): the OSM `admin_level=8` boundary of every city or town that holds
// one of our public places or is a public trip base. Written to public/globe/data/cities-adm8.json with its ODbL credit.
//
//   node scripts/globe-cities.mjs [--from <out dir or base url>] [--limit N]
//
// Where the points come from: the globe's own light pins (`globe-data/pins/<cc>/data.json`), read from a built export
// (`out/`, the default) or from a running dev server (`--from http://localhost:3422`). A pin is public by construction, so a
// city is in the file only because a public place or trip base is in it; the household's home town never is.
//
// Overpass and Nominatim are sequential, one request at a time, inside `flock /tmp/travel-overpass.lock` (shared with the
// track and capture jobs), with the project user agent and no email. Results are cached outside git in tools/.cache/cities/.
// The build never calls either service; the result is committed.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(WEB, '..');
const CACHE = path.join(ROOT, 'tools', '.cache', 'cities');
const OUT = path.join(WEB, 'public', 'globe', 'data', 'cities-adm8.json');
const UA = 'travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)';
// public Overpass instances, tried in turn when one answers 5xx (they are shared and often busy)
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const NOMINATIM = 'https://nominatim.openstreetmap.org/lookup';
const LOCK = '/tmp/travel-overpass.lock';

// The lock wraps the whole run: re-run this script under flock unless it already is.
if (!process.env.GLOBE_CITIES_LOCKED) {
  const r = spawnSync('flock', [LOCK, process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, GLOBE_CITIES_LOCKED: '1' } });
  process.exit(r.status ?? 1);
}

const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const FROM = arg('--from', path.join(WEB, process.env.NEXT_DIST_DIR || 'out'));
const LIMIT = Number(arg('--limit', '0'));
mkdirSync(CACHE, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
/** One request at a time, at least `gap` ms after the last. A 429 backs off and stops after the second. */
let tooMany = 0;
async function polite(url, init, gap, retries = 0) {
  const wait = last + gap - Date.now();
  if (wait > 0) await sleep(wait);
  const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init?.headers ?? {}) } });
  last = Date.now();
  if (res.status === 429) {
    if (++tooMany >= 2) throw new Error('429 twice: stopping, try again later');
    console.log('429, waiting 60 s');
    await sleep(60_000);
    return polite(url, init, gap, retries);
  }
  if ([502, 503, 504].includes(res.status) && retries < 4) {
    console.log(`${res.status}, waiting ${20 * (retries + 1)} s`);
    await sleep(20_000 * (retries + 1));
    return polite(url, init, gap, retries + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${url.slice(0, 90)}`);
  return res;
}

async function readJson(rel) {
  if (/^https?:/.test(FROM)) return (await fetch(`${FROM}/${rel}`)).json();
  return JSON.parse(readFileSync(path.join(FROM, rel), 'utf8'));
}

// ---- the points: every real (not country-centre) public pin ----------------------------------------------------------
const tree = await readJson('globe-data/index.json');
const ccs = tree.continents.flatMap((c) => c.countries.map((n) => n.slug));
const points = [];
for (const cc of ccs) {
  const pins = await readJson(`globe-data/pins/${cc}/data.json`);
  for (const p of pins) if (!p.approx) points.push({ lat: p.lat, lon: p.lon, name: p.name, cc });
}
// one query per 0.02 degrees (about 2 km): places in the same town share the answer
const cells = new Map();
for (const p of points) cells.set(`${Math.round(p.lat / 0.02)},${Math.round(p.lon / 0.02)}`, p);
let todo = [...cells.values()];
if (LIMIT) todo = todo.slice(0, LIMIT);
console.log(`${points.length} public points, ${todo.length} cells to ask`);

// ---- which level-8 relations hold each point (Overpass, cached) ------------------------------------------------------
const rels = new Map(); // relation id -> tags
let skipped = 0;
for (const [i, p] of todo.entries()) {
  const key = path.join(CACHE, `is_in-${p.lat.toFixed(3)}_${p.lon.toFixed(3)}.json`);
  let data;
  if (existsSync(key)) data = JSON.parse(readFileSync(key, 'utf8'));
  else {
    const q = `[out:json][timeout:60];is_in(${p.lat},${p.lon})->.a;rel(pivot.a)["boundary"="administrative"]["admin_level"="8"];out tags;`;
    for (const ep of OVERPASS) {
      try {
        data = await (await polite(ep, { method: 'POST', body: new URLSearchParams({ data: q }) }, 2500, 4)).json();
        break;
      } catch (e) { console.log(`  ${new URL(ep).host}: ${String(e).slice(0, 70)}`); }
    }
    // a cell that no instance answers is skipped this run (it is not cached, so the next run asks again)
    if (!data) { skipped += 1; continue; }
    writeFileSync(key, JSON.stringify(data));
  }
  for (const e of data.elements ?? []) if (e.type === 'relation') rels.set(e.id, e.tags ?? {});
  if (i % 10 === 9) console.log(`  asked ${i + 1}/${todo.length}, ${rels.size} areas so far`);
}
console.log(`${rels.size} city areas, ${skipped} cells skipped (no Overpass instance answered)`);

// ---- their outlines (Nominatim assembles the relation; threshold 0.0005 degrees), in batches of 40 ----------------------------
const ids = [...rels.keys()];
const shapes = new Map();
for (let i = 0; i < ids.length; i += 40) {
  const batch = ids.slice(i, i + 40);
  const key = path.join(CACHE, `lookup-${batch[0]}-${batch.length}.json`);
  let rows;
  if (existsSync(key)) rows = JSON.parse(readFileSync(key, 'utf8'));
  else {
    const url = `${NOMINATIM}?osm_ids=${batch.map((id) => `R${id}`).join(',')}&format=jsonv2&polygon_geojson=1&polygon_threshold=0.0005&extratags=1&namedetails=0`;
    rows = await (await polite(url, {}, 1500)).json();
    writeFileSync(key, JSON.stringify(rows));
  }
  for (const r of rows) if (r.geojson && /Polygon/.test(r.geojson.type)) shapes.set(Number(r.osm_id), r);
}

// ---- the file ----------------------------------------------------------------------------------------------------------
const round = (c) => (typeof c[0] === 'number' ? [Math.round(c[0] * 1e4) / 1e4, Math.round(c[1] * 1e4) / 1e4] : c.map(round));
const features = [...shapes.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([id, r]) => ({
    type: 'Feature',
    properties: { id: `r${id}`, name: r.name, wd: r.extratags?.wikidata ?? rels.get(id)?.wikidata ?? null },
    geometry: { type: r.geojson.type, coordinates: round(r.geojson.coordinates) },
  }));
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', credit: '© OpenStreetMap contributors, ODbL 1.0 (boundary=administrative, admin_level=8)', features }));
console.log(`wrote ${path.relative(ROOT, OUT)}: ${features.length} city areas, ${(readdirSync(CACHE).length)} cached answers`);
