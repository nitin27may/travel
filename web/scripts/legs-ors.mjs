// Routed legs for the trip map (D-E5, TRP2b; trip-timeline spec 2.5). For every public trip with a schedule, fetches each consecutive pair of
// stops of the trip route model once from OpenRouteService and writes data/schedules/legs/<trip>.json as `trip-legs/2`: km, minutes, mode and an
// encoded polyline (precision 5, simplified to about 30 m). The build never calls ORS. This script runs by hand, sequentially, at most 28
// requests a minute, and only for pairs that are neither in the file nor in the disk cache. The files are results: never edited by hand.
//
//   node scripts/legs-ors.mjs                       fetch the missing legs of every trip with a schedule
//   node scripts/legs-ors.mjs --trip <slug>         one trip
//   node scripts/legs-ors.mjs --check               NO network, no key: validate the files (schema, caps, pair coverage); exit 1 on a problem
//   node scripts/legs-ors.mjs --list                print the pairs and how many are in the file
//   node scripts/legs-ors.mjs --refetch             ask again for every pair (the disk cache is bypassed)
//   node scripts/legs-ors.mjs --key-file <path>     read ORS_API_KEY from that file instead of web/.env.local
//
// The key is read from ORS_API_KEY in the environment or from an env file. It is sent only to the ORS host as the Authorization header and is
// never printed, logged, put in a URL, cached or written to a data file. A leg whose line passes within the household radius is not written
// with geometry (core/src/privacy/towns.ts); only the COUNT of those is printed (API3-R-5).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { haversineKm } from '@travel/core/geo/distance.ts';
import { USER_AGENT } from './tracks-osm.mjs';
import { checkLegsFile, LONG_PAIR_MIN, LEG_SIMPLIFY_M, LEGS_ATTRIBUTION, MAX_CIRCUITY, refusedGeometries, simplifyPolyline, unordered } from './legs/lib.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..');
const ROOT = path.resolve(WEB, '..');
const SCHEDULES = path.join(ROOT, 'data', 'schedules');
const LEGS_DIR = path.join(SCHEDULES, 'legs');
const CACHE = path.join(ROOT, 'tools', '.cache', 'legs-ors'); // gitignored
const ORS = 'https://api.openrouteservice.org/v2/directions';
const MIN_GAP_MS = 2200; // 27 requests a minute, under the free tier's 40
const KM_WALK = 1.2;

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const slugs = arg('--trip')
  ? [arg('--trip')]
  : readdirSync(SCHEDULES).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();

/** The pairs of the route model, read under vitest (the store and the page model need its '@' alias). */
function readPairs() {
  mkdirSync(CACHE, { recursive: true });
  const out = path.join(CACHE, 'pairs.json');
  writeFileSync(path.join(CACHE, 'request.json'), JSON.stringify(slugs));
  const r = spawnSync(path.join(WEB, 'node_modules', '.bin', 'vitest'), ['run', '-c', path.join(HERE, 'legs', 'vitest.config.mts')], {
    cwd: WEB,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  if (r.status !== 0) {
    console.error('legs: could not read the route model');
    process.exit(1);
  }
  return JSON.parse(readFileSync(out, 'utf8'));
}

const fileOf = (slug) => path.join(LEGS_DIR, `${slug}.json`);
const readFile = (slug) => (existsSync(fileOf(slug)) ? JSON.parse(readFileSync(fileOf(slug), 'utf8')) : null);
const unroutedOf = (slug) => path.join(LEGS_DIR, `${slug}.unrouted.json`);
const readUnrouted = (slug) => (existsSync(unroutedOf(slug)) ? JSON.parse(readFileSync(unroutedOf(slug), 'utf8')) : null);
const pairsBySlug = readPairs();

// ---- --list and --check: no network, no key ----------------------------------------------------------------------------------------------------
if (flag('--list') || flag('--check')) {
  let bad = 0;
  for (const slug of slugs) {
    const pairs = pairsBySlug[slug] ?? [];
    const raw = readFile(slug);
    if (!raw) {
      console.error(`legs: ${slug}: no file (${pairs.length} pairs)`);
      bad += 1;
      continue;
    }
    const rep = checkLegsFile(raw, slug, pairs, readUnrouted(slug));
    console.log(`legs: ${slug}: ${rep.legs} legs, ${rep.routed} with geometry, ${rep.chars} polyline characters, ${pairs.length} pairs, ${rep.missing.length} missing, ${rep.refused} refused`);
    if (flag('--list')) for (const p of rep.missing) console.log(`  ${p.from} -> ${p.to}`);
    for (const m of rep.problems) console.error(`  ${slug}: ${m}`);
    if (rep.problems.length) bad += 1;
  }
  if (flag('--check')) {
    if (bad) {
      console.error('Run: node scripts/legs-ors.mjs   (needs ORS_API_KEY in the environment or web/.env.local)');
      process.exit(1);
    }
    console.log('legs: all files are valid and cover their route models');
  }
  process.exit(0);
}

// ---- fetching -----------------------------------------------------------------------------------------------------------------------------------
function loadKey() {
  if (process.env.ORS_API_KEY) return process.env.ORS_API_KEY;
  const file = arg('--key-file') ?? path.join(WEB, '.env.local');
  if (!existsSync(file)) return null;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*ORS_API_KEY\s*=\s*(.*?)\s*$/.exec(line);
    if (m) return m[1].replace(/^['"]|['"]$/g, '');
  }
  return null;
}

const stats = { requests: 0, cacheHits: 0 };
let key = null;
let lastAt = 0;

/** One ORS response, from the disk cache when this exact request was made before. The cache holds the response, never the key. */
async function ors(profile, a, b, radius) {
  const body = { coordinates: [[a.lng, a.lat], [b.lng, b.lat]], radiuses: [radius, radius], instructions: false };
  const file = path.join(CACHE, `${createHash('sha1').update(JSON.stringify([profile, body])).digest('hex').slice(0, 20)}.json`);
  if (!flag('--refetch') && existsSync(file)) {
    stats.cacheHits += 1;
    return JSON.parse(readFileSync(file, 'utf8'));
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = lastAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastAt = Date.now();
    stats.requests += 1;
    const res = await fetch(`${ORS}/${profile}`, {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      await sleep(30_000);
      continue;
    }
    const json = await res.json().catch(() => null);
    // a summit pin far from any road: ask for the nearest road wherever it is
    if (res.status === 404 && radius > 0) return ors(profile, a, b, -1);
    // ORS names the coordinate in this message, so only the fact is kept (and cached, so the pair is never asked twice)
    if (res.status === 404) {
      mkdirSync(CACHE, { recursive: true });
      writeFileSync(file, JSON.stringify({ unrouted: 'no road or path within reach of a stop' }));
      return { unrouted: 'no road or path within reach of a stop' };
    }
    if (!res.ok) return { error: `${res.status} ${json?.error?.message ?? json?.error ?? res.statusText}`.slice(0, 160) };
    const route = json?.routes?.[0];
    if (!route?.summary || typeof route.geometry !== 'string') return { error: 'no route in the response' };
    const slim = { summary: { distance: route.summary.distance, duration: route.summary.duration }, geometry: route.geometry };
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(file, JSON.stringify(slim));
    return slim;
  }
  return { error: 'rate limited after three tries' };
}

async function legFor(pair) {
  const km = haversineKm({ lat: pair.a.lat, lon: pair.a.lng }, { lat: pair.b.lat, lon: pair.b.lng });
  const profile = km < KM_WALK ? 'foot-hiking' : 'driving-car';
  const r = await ors(profile, pair.a, pair.b, 5000);
  if (r.error || r.unrouted) return r;
  if (km > LONG_PAIR_MIN && r.summary.distance / 1000 > MAX_CIRCUITY * km) return { unrouted: `the route is over ${MAX_CIRCUITY} times the straight line` };
  const line = simplifyPolyline(r.geometry, LEG_SIMPLIFY_M);
  if (!line) return { error: 'the route line does not decode or is too long' };
  return {
    leg: { from: pair.from, to: pair.to, profile, mode: profile === 'driving-car' ? 'drive' : 'walk', km: Math.round(r.summary.distance / 100) / 10, minutes: Math.max(1, Math.round(r.summary.duration / 60)), geometry: line.geometry },
  };
}

let failed = 0;
let refusedTotal = 0;
for (const slug of slugs) {
  const pairs = pairsBySlug[slug] ?? [];
  const old = readFile(slug);
  const have = new Map((old?.legs ?? []).filter((l) => l.geometry && !flag('--refetch')).map((l) => [unordered(l.from, l.to), l]));
  const ledger = new Map((readUnrouted(slug)?.pairs ?? []).filter(() => !flag('--refetch')).map((u) => [unordered(u.from, u.to), u]));
  const todo = pairs.filter((p) => !have.has(unordered(p.from, p.to)) && !ledger.has(unordered(p.from, p.to)));
  console.log(`legs: ${slug}: ${pairs.length} pairs, ${pairs.length - todo.length - [...ledger.keys()].filter((k) => !have.has(k)).length} in the file, ${ledger.size} listed as not routed, ${todo.length} to fetch`);
  if (todo.length && !key) {
    key = loadKey();
    if (!key) {
      console.error('legs: ORS_API_KEY is not set (environment or web/.env.local). Nothing fetched; the map draws dashed estimates for the missing pairs.');
      process.exit(1);
    }
  }
  const unrouted = new Map(ledger);
  const legs = [];
  const wanted = new Set(pairs.map((p) => unordered(p.from, p.to)));
  for (const [k, l] of have) if (wanted.has(k)) legs.push(l);
  let n = 0;
  for (const p of todo) {
    n += 1;
    const r = await legFor(p);
    if (r.unrouted) {
      unrouted.set(unordered(p.from, p.to), { from: p.from, to: p.to, reason: r.unrouted });
      console.log(`  ${n}/${todo.length} ${p.label}: not drawn as a route (${r.unrouted})`);
      continue;
    }
    if (r.error) {
      failed += 1;
      console.log(`  ${n}/${todo.length} ${p.label}: not routed (${r.error})`);
      continue;
    }
    legs.push(r.leg);
    console.log(`  ${n}/${todo.length} ${p.label}: ${r.leg.minutes} min, ${r.leg.km} km`);
  }
  // privacy (API-3c): a line within the household radius is not written; the leg keeps its km and minutes. Only the count is printed (R-5).
  const refused = refusedGeometries(legs);
  refusedTotal += refused;
  const written = legs.map((l) => (refused && refusedGeometries([l]) ? { from: l.from, to: l.to, profile: l.profile, mode: l.mode, km: l.km, minutes: l.minutes } : l));
  written.sort((x, y) => (x.from + x.to).localeCompare(y.from + y.to));
  mkdirSync(LEGS_DIR, { recursive: true });
  const doc = { schema: 'trip-legs/2', trip: slug, fetched: new Date().toISOString().slice(0, 10), attribution: LEGS_ATTRIBUTION, simplifiedM: LEG_SIMPLIFY_M, legs: written };
  writeFileSync(fileOf(slug), `${JSON.stringify(doc, null, 1)}\n`);
  const keep = [...unrouted.values()].filter((u) => wanted.has(unordered(u.from, u.to))).sort((x, y) => (x.from + x.to).localeCompare(y.from + y.to));
  const ledgerDoc = { schema: 'trip-legs-unrouted/1', trip: slug, pairs: keep };
  if (keep.length) writeFileSync(unroutedOf(slug), `${JSON.stringify(ledgerDoc, null, 1)}\n`);
  const rep = checkLegsFile(doc, slug, pairs, keep.length ? ledgerDoc : null);
  console.log(`legs: wrote ${written.length} legs to ${path.relative(ROOT, fileOf(slug))} (${rep.routed} with geometry, ${rep.chars} polyline characters); ${keep.length} pair(s) not drawn as a route; ${refused} refused by the privacy guard`);
  for (const m of rep.problems) console.log(`  ${m}`);
}
console.log(`legs: ${stats.requests} ORS request(s) made, ${stats.cacheHits} cache hit(s), ${failed} pair(s) not routed, ${refusedTotal} refused`);
process.exit(failed ? 1 : 0);
