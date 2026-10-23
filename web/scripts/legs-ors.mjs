// Road times for the Dolomites timeline (trip-timeline spec 2.5, D10). Fetches each consecutive place pair once from
// OpenRouteService and stores the result in data/schedules/legs/dolomites-2027.json. The build never calls ORS; this script
// runs by hand, sequentially, at most 28 requests a minute, and only for pairs the cache lacks.
//
//   node scripts/legs-ors.mjs             fetch the missing pairs
//   node scripts/legs-ors.mjs --check     exit 1 when a pair is missing (prints the pairs, never a key)
//   node scripts/legs-ors.mjs --refetch   fetch every pair again
//   node scripts/legs-ors.mjs --list      print the pairs and how many are cached
//   node scripts/legs-ors.mjs --env-file <path>   read ORS_API_KEY from that file instead of web/.env.local
//
// The key is read from ORS_API_KEY in the environment or from an env file, and is sent only as the Authorization header.
// It is never printed, logged, put in a URL, or written to the cache.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { haversineKm } from '@travel/core/geo/distance.ts';
import { dolomitesLegPairs, routingPoint } from '../lib/public/legs-pairs.ts';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(WEB, '..');
const OUT = path.join(ROOT, 'data', 'schedules', 'legs', 'dolomites-2027.json');
const ATTRIBUTION = 'Road times from OpenRouteService (openrouteservice.org), route data from OpenStreetMap contributors (ODbL).';
const MIN_GAP_MS = 2200; // 27 requests a minute, under the free tier's 40
const KM_WALK = 1.2;

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);

const snapshot = JSON.parse(readFileSync(path.join(WEB, 'data-snapshots', 'prototype.json'), 'utf8'));
const places = new Map(snapshot.places.map((p) => [p.id, p]));
const pairs = dolomitesLegPairs(snapshot.trip.days, snapshot.places);

const cache = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
const have = new Map((cache?.legs ?? []).map((l) => [`${l.from}|${l.to}`, l]));
const cached = (a, b) => have.has(`${a}|${b}`) || have.has(`${b}|${a}`);
const missing = pairs.filter(([a, b]) => flag('--refetch') || !cached(a, b));

if (flag('--list')) {
  console.log(`${pairs.length} pairs, ${pairs.length - missing.length} cached, ${missing.length} missing`);
  for (const [a, b] of missing) console.log(`  ${a} -> ${b}`);
  process.exit(0);
}
if (flag('--check')) {
  if (!missing.length) {
    console.log(`legs: all ${pairs.length} pairs are cached`);
    process.exit(0);
  }
  console.error(`legs: ${missing.length} of ${pairs.length} pairs are missing from ${path.relative(ROOT, OUT)}${cache ? '' : ' (no cache file yet)'}:`);
  for (const [a, b] of missing) console.error(`  ${a} -> ${b}`);
  console.error('Run: node scripts/legs-ors.mjs   (needs ORS_API_KEY in the environment or web/.env.local)');
  process.exit(1);
}

function loadKey() {
  if (process.env.ORS_API_KEY) return process.env.ORS_API_KEY;
  const file = arg('--env-file') ?? path.join(WEB, '.env.local');
  if (!existsSync(file)) return null;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*ORS_API_KEY\s*=\s*(.*?)\s*$/.exec(line);
    if (m) return m[1].replace(/^['"]|['"]$/g, '');
  }
  return null;
}

const key = loadKey();
if (!key) {
  console.error('legs: ORS_API_KEY is not set (environment or web/.env.local). Nothing fetched; the timeline uses estimated legs for the missing pairs.');
  process.exit(missing.length ? 1 : 0);
}

const straightKm = (a, b) => haversineKm({ lat: a.lat, lon: a.lng }, { lat: b.lat, lon: b.lng });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function route(a, b, radius = 5000) {
  const profile = straightKm(a, b) < KM_WALK ? 'foot-hiking' : 'driving-car';
  // the prototype pins are approximate and many sit on a trail, so snap each end to the nearest road within `radius` m
  const body = JSON.stringify({ coordinates: [[a.lng, a.lat], [b.lng, b.lat]], radiuses: [radius, radius] });
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}`, {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
    });
    if (res.status === 429) {
      await sleep(30_000);
      continue;
    }
    const json = await res.json().catch(() => null);
    if (res.status === 404 && radius > 0) {
      await sleep(MIN_GAP_MS);
      return route(a, b, -1); // a summit pin far from any road: the nearest road wherever it is
    }
    if (!res.ok) return { error: `${res.status} ${json?.error?.message ?? json?.error ?? res.statusText}`.slice(0, 160) };
    const s = json?.routes?.[0]?.summary;
    if (!s) return { error: 'no route in the response' };
    return { profile, mode: profile === 'driving-car' ? 'drive' : 'walk', km: Math.round(s.distance / 100) / 10, minutes: Math.max(1, Math.round(s.duration / 60)) };
  }
  return { error: 'rate limited after three tries' };
}

const legs = flag('--refetch') ? [] : [...(cache?.legs ?? [])];
const failed = [];
let n = 0;
for (const [a, b] of missing) {
  if (n++ > 0) await sleep(MIN_GAP_MS);
  const r = await route(routingPoint(places.get(a), snapshot.access[a]), routingPoint(places.get(b), snapshot.access[b]));
  if (r.error) {
    failed.push(`${a} -> ${b}: ${r.error}`);
    console.log(`  ${n}/${missing.length} ${a} -> ${b}: not routed (${r.error})`);
    continue;
  }
  legs.push({ from: a, to: b, profile: r.profile, mode: r.mode, km: r.km, minutes: r.minutes });
  console.log(`  ${n}/${missing.length} ${a} -> ${b}: ${r.minutes} min, ${r.km} km`);
}
legs.sort((x, y) => (x.from + x.to).localeCompare(y.from + y.to));
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `${JSON.stringify({ schema: 'trip-legs/1', trip: 'dolomites-2027', fetched: new Date().toISOString().slice(0, 10), attribution: ATTRIBUTION, legs }, null, 1)}\n`,
);
console.log(`legs: wrote ${legs.length} legs to ${path.relative(ROOT, OUT)}; ${failed.length} pair(s) could not be routed`);
for (const f of failed) console.log(`  ${f}`);
process.exit(failed.length ? 1 : 0);
