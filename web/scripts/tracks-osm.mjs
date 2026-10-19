#!/usr/bin/env node
// Fetches OSM geometry for every trail that carries an OSM relation or way id and stores it once in data/tracks/
// (trail-track/1, see data/tracks/README.md). Elevation comes from the AWS Terrain Tiles (Terrarium). The site build never
// calls Overpass, the OSM API or the tile server: it reads the committed files.
//
//   node web/scripts/tracks-osm.mjs                  fetch every missing track (cached responses are reused)
//   node web/scripts/tracks-osm.mjs --refresh        re-read OSM even when a cached response exists
//   node web/scripts/tracks-osm.mjs --only tre-cime  one trail (a prototype place id), repeatable with commas
//   node web/scripts/tracks-osm.mjs --check          offline: every trail with an OSM id has a consistent track file
//   node web/scripts/tracks-osm.mjs --rebuild       rebuild every file from the cached OSM responses (no OSM request)
//   --source auto|overpass|osm-api                   auto (default) tries Overpass first and falls back to the OSM API
//
// Politeness: one request at a time, at least 1 s apart, at most 200 requests a run, Retry-After obeyed, stop after the
// second 429. The whole run takes the machine-wide Overpass lock (flock /tmp/travel-overpass.lock).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SCHEMA = 'trail-track/1';
export const USER_AGENT = 'travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)';
export const LICENCE = 'ODbL-1.0';
export const ATTRIBUTION = '© OpenStreetMap contributors';
export const DEM_NAME = 'AWS Terrain Tiles (Terrarium), Mapzen; sources include SRTM and others';
export const SIMPLIFY_M = 5;
export const MAX_POINTS = 2000;
export const SAMPLE_STEP_M = 25;
export const HYSTERESIS_M = 5;
export const START_TOLERANCE_M = 300;
const DEM_ZOOM = 13;
const MIN_GAP_MS = 1100;
const MAX_REQUESTS = 200;

/* ------------------------------------------------------------------ geometry helpers (pure) */

const R = 6371008.8;
const rad = Math.PI / 180;

/** Great-circle distance in metres between two [lon, lat] points. */
export function haversine(a, b) {
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function lengthM(line) {
  let d = 0;
  for (let i = 1; i < line.length; i++) d += haversine(line[i - 1], line[i]);
  return d;
}

const key = (p) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`;

/**
 * Chains ways (arrays of [lon, lat]) into ordered lines by matching end points. Returns the lines found, longest first;
 * `stitched` is true only when everything joined into one line (or one loop).
 */
export function stitchWays(ways) {
  let rest = ways.filter((w) => w.length >= 2).map((w) => w.slice());
  const ends = new Map();
  for (const w of rest) for (const p of [w[0], w[w.length - 1]]) ends.set(key(p), (ends.get(key(p)) ?? 0) + 1);
  const lines = [];
  while (rest.length) {
    // start at a free end when there is one (so an open path is walked from one end to the other), else anywhere (a loop)
    let startIdx = rest.findIndex((w) => ends.get(key(w[0])) === 1 || ends.get(key(w[w.length - 1])) === 1);
    if (startIdx < 0) startIdx = 0;
    let chain = rest.splice(startIdx, 1)[0];
    if (ends.get(key(chain[chain.length - 1])) === 1 && ends.get(key(chain[0])) !== 1) chain.reverse();
    for (;;) {
      const tail = key(chain[chain.length - 1]);
      const i = rest.findIndex((w) => key(w[0]) === tail || key(w[w.length - 1]) === tail);
      if (i < 0) break;
      let next = rest.splice(i, 1)[0];
      if (key(next[next.length - 1]) === tail && key(next[0]) !== tail) next = next.reverse();
      chain = chain.concat(next.slice(1));
    }
    lines.push(chain);
  }
  lines.sort((a, b) => lengthM(b) - lengthM(a));
  return { lines, stitched: lines.length === 1 };
}

/** Local equirectangular projection about a reference latitude, in metres. */
function projector(line) {
  const lat0 = line.reduce((s, p) => s + p[1], 0) / line.length;
  const kx = Math.cos(lat0 * rad) * R * rad;
  const ky = R * rad;
  return (p) => [p[0] * kx, p[1] * ky];
}

function segDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Douglas-Peucker in metres. Keeps the first and last point and every point that moves the line more than `tol`. */
export function simplifyLine(line, tol = SIMPLIFY_M) {
  if (line.length <= 2) return line.slice();
  const proj = projector(line);
  const xy = line.map(proj);
  const keep = new Uint8Array(line.length);
  keep[0] = 1;
  keep[line.length - 1] = 1;
  const stack = [[0, line.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let worst = -1;
    let at = -1;
    for (let i = s + 1; i < e; i++) {
      const d = segDist(xy[i], xy[s], xy[e]);
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (worst > tol) {
      keep[at] = 1;
      stack.push([s, at], [at, e]);
    }
  }
  return line.filter((_, i) => keep[i]);
}

/** Simplifies to `tol` metres, widening the tolerance until the line fits in `max` points. */
export function simplifyToLimit(line, tol = SIMPLIFY_M, max = MAX_POINTS) {
  let t = tol;
  let out = simplifyLine(line, t);
  while (out.length > max) {
    t *= 1.5;
    out = simplifyLine(line, t);
  }
  return { line: out, tolerance: t };
}

/** Points every `step` metres along a line (first and last included): [{at: [lon, lat], d}]. */
export function resample(line, step = SAMPLE_STEP_M) {
  const out = [{ at: line[0], d: 0 }];
  const total = lengthM(line);
  let next = step;
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const seg = haversine(line[i - 1], line[i]);
    while (seg > 0 && next <= walked + seg + 1e-9 && next < total) {
      const t = (next - walked) / seg;
      out.push({ at: [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t], d: next });
      next += step;
    }
    walked += seg;
  }
  out.push({ at: line[line.length - 1], d: total });
  return out;
}

/** Terrarium PNG pixel -> metres above sea level. */
export const decodeTerrarium = (r, g, b) => r * 256 + g + b / 256 - 32768;

/**
 * Gain, loss, high and low from elevation samples. A change only counts once it exceeds `h` metres from the last counted
 * level, so DEM noise of a few metres does not inflate the climb.
 */
export function totalsFromSamples(samples, h = HYSTERESIS_M) {
  const e = samples.map((s) => s[1]);
  let ref = e[0];
  let gain = 0;
  let loss = 0;
  for (const v of e) {
    if (v - ref >= h) {
      gain += v - ref;
      ref = v;
    } else if (ref - v >= h) {
      loss += ref - v;
      ref = v;
    }
  }
  return {
    km: Math.round(((samples[samples.length - 1]?.[0] ?? 0) / 1000) * 100) / 100,
    gain_m: Math.round(gain),
    loss_m: Math.round(loss),
    high_m: Math.round(Math.max(...e)),
    low_m: Math.round(Math.min(...e)),
  };
}

/**
 * A track is the trail we researched only when its length is near the researched figure, as a round trip or as one way
 * (an OSM relation often runs on past our destination, or is a whole long-distance path). No researched figure: no objection.
 */
export function lengthConsistent(trackKm, researchedKm, tol = 0.4) {
  if (!researchedKm) return true;
  return [researchedKm, researchedKm / 2].some((r) => Math.abs(trackKm - r) / r <= tol);
}

/* ------------------------------------------------------------------ OSM responses (pure) */

/** Overpass `out geom` JSON -> [{id, line}] of ways. */
export function waysFromOverpass(json) {
  return (json.elements ?? [])
    .filter((el) => el.type === 'way' && Array.isArray(el.geometry))
    .map((el) => ({ id: el.id, line: el.geometry.filter(Boolean).map((p) => [p.lon, p.lat]) }));
}

/** OSM API `/full.json` -> [{id, line}] of the ways, built from the nodes of the response. */
export function waysFromOsmApi(json) {
  const nodes = new Map((json.elements ?? []).filter((el) => el.type === 'node').map((el) => [el.id, [el.lon, el.lat]]));
  return (json.elements ?? [])
    .filter((el) => el.type === 'way')
    .map((el) => ({ id: el.id, line: (el.nodes ?? []).map((n) => nodes.get(n)).filter(Boolean) }));
}

/* ------------------------------------------------------------------ inputs and checks (pure over data) */

const IDS = /(?:rel(?:ation)?\s+)?(\d{5,})/g;

/** The OSM ids written in a prototype trail's geometry_ids fact: ["relation:123", "way:456"]. */
export function osmRefsOf(source, ids) {
  if (!source || source === 'none') return [];
  const type = source === 'osm_ways' ? 'way' : 'relation';
  return [...new Set([...String(ids ?? '').matchAll(IDS)].map((m) => `${type}:${m[1]}`))];
}

/** Capture-record links that name an OSM relation or way (`links.osm`, `track_source`). */
export function osmRefsFromCapture(rec) {
  const text = [rec?.links?.osm, rec?.track_source].filter((x) => typeof x === 'string').join(' ');
  return [...new Set([...text.matchAll(/(relation|way)\/(\d+)/g)].map((m) => `${m[1]}:${m[2]}`))];
}

/** Prototype place ids in the "Trail data for a person to confirm" list, read from the adapter's own file. */
export function unconfirmedIds(source) {
  return new Set([...source.matchAll(/^\s*'?([\w-]+)'?:\s*'/gm)].map((m) => m[1]));
}

/** Every trail with an OSM reference: [{place, name, osm: [...], trailhead: {lat, lon}|null}]. */
export function collectInputs(snapshot, captureRecords = []) {
  const out = [];
  for (const p of snapshot.places ?? []) {
    const t = snapshot.trails?.[p.id];
    const refs = osmRefsOf(t?.facts?.geometry_source?.v, t?.facts?.geometry_ids?.v);
    if (!refs.length) continue;
    const th = snapshot.access?.[p.id]?.trailhead ?? t?.trailhead ?? null;
    const km = Number(String(t?.facts?.distance_km?.v ?? p.km ?? '').replace(/[^\d.]/g, ''));
    out.push({ place: p.id, name: p.name, osm: refs, trailhead: th ? { lat: th.lat, lon: th.lon } : null, researchedKm: Number.isFinite(km) && km > 0 ? km : null });
  }
  for (const rec of captureRecords) {
    const refs = osmRefsFromCapture(rec);
    if (refs.length) out.push({ place: String(rec.ref), name: String(rec.name ?? rec.ref), osm: refs, trailhead: null });
  }
  return out;
}

/**
 * Problems between the inputs and the track files: [{place, problem}]. `files` is a Map of place -> parsed track.
 * An empty list means `--check` passes.
 */
export function checkTracks(inputs, files, unconfirmed = new Set()) {
  const problems = [];
  for (const inp of inputs) {
    const f = files.get(inp.place);
    if (!f) {
      problems.push({ place: inp.place, problem: 'no track file' });
      continue;
    }
    if (f.schema !== SCHEMA) problems.push({ place: inp.place, problem: `schema is ${f.schema}, expected ${SCHEMA}` });
    if (f.licence !== LICENCE || !f.attribution) problems.push({ place: inp.place, problem: 'licence or attribution missing' });
    if (JSON.stringify([...(f.osm ?? [])].sort()) !== JSON.stringify([...inp.osm].sort())) problems.push({ place: inp.place, problem: `osm list differs (file ${(f.osm ?? []).join(' ')} vs source ${inp.osm.join(' ')})` });
    const pts = f.geometry?.length ?? 0;
    if (f.stitched !== false && pts < 2) problems.push({ place: inp.place, problem: 'geometry has fewer than 2 points' });
    if (pts > MAX_POINTS) problems.push({ place: inp.place, problem: `geometry has ${pts} points, limit ${MAX_POINTS}` });
    if (unconfirmed.has(inp.place) && f.confirmed !== false) problems.push({ place: inp.place, problem: 'listed in UNCONFIRMED_TRAIL_DATA but the track says confirmed' });
  }
  const wanted = new Set(inputs.map((i) => i.place));
  for (const place of files.keys()) if (!wanted.has(place)) problems.push({ place, problem: 'track file for a trail that has no OSM id any more' });
  return problems;
}

/* ------------------------------------------------------------------ file format */

const pairs = (rows, perLine) => {
  const lines = [];
  for (let i = 0; i < rows.length; i += perLine) lines.push('    ' + rows.slice(i, i + perLine).map((r) => `[${r.join(', ')}]`).join(', '));
  return rows.length ? `[\n${lines.join(',\n')}\n  ]` : '[]';
};

/** Stable text for a track file: headers first, long coordinate arrays eight to a line. */
export function formatTrack(t) {
  const head = {
    schema: t.schema,
    place: t.place,
    refs: t.refs,
    osm: t.osm,
    fetched: t.fetched,
    source: t.source,
    licence: t.licence,
    attribution: t.attribution,
    stitched: t.stitched,
    confirmed: t.confirmed,
    held_back: t.held_back,
    start_offset_m: t.start_offset_m,
    simplify_m: t.simplify_m,
    totals: t.totals,
    dem: t.dem,
    step_m: t.step_m,
  };
  const body = JSON.stringify(head, null, 2).replace(/\n}$/, '');
  const parts = [body, `  "geometry": ${pairs(t.geometry, 8)}`];
  if (t.segments) parts.push(`  "segments": [${t.segments.map((s) => `\n  ${pairs(s, 8)}`).join(',')}\n  ]`);
  parts.push(`  "elevation": ${pairs(t.elevation, 8)}`);
  return `${parts.join(',\n')}\n}\n`;
}

/* ------------------------------------------------------------------ the run */

const here = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(here, '..');
const repoRoot = path.resolve(webDir, '..');
const tracksDir = path.join(repoRoot, 'data', 'tracks');
const cacheDir = path.join(webDir, '.tile-cache');

const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const loadFiles = () => {
  const m = new Map();
  if (existsSync(tracksDir)) for (const n of readdirSync(tracksDir).filter((x) => x.endsWith('.json'))) m.set(n.replace(/\.json$/, ''), readJson(path.join(tracksDir, n)));
  return m;
};
const loadInputs = () => {
  const snapshot = readJson(path.join(webDir, 'data-snapshots', 'prototype.json'));
  const capDir = path.join(repoRoot, 'data', 'capture');
  const recs = [];
  for (const trip of existsSync(capDir) ? readdirSync(capDir) : []) {
    const dir = path.join(capDir, trip);
    if (['splits', 'runs'].includes(trip) || !statSync(dir).isDirectory()) continue;
    for (const n of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      try {
        recs.push(...(readJson(path.join(dir, n)).records ?? []));
      } catch {
        /* not a capture sidecar */
      }
    }
  }
  return collectInputs(snapshot, recs);
};
const loadUnconfirmed = () => unconfirmedIds(readFileSync(path.join(webDir, 'lib', 'public', 'honesty-overrides.ts'), 'utf8'));

function runCheck() {
  const problems = checkTracks(loadInputs(), loadFiles(), loadUnconfirmed());
  if (!problems.length) {
    console.log(`tracks: ok (${loadFiles().size} track files)`);
    return 0;
  }
  for (const p of problems) console.error(`tracks: ${p.place}: ${p.problem}`);
  return 1;
}

let lastRequest = 0;
let requests = 0;
let tooMany = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function polite(url, init = {}) {
  if (requests >= MAX_REQUESTS) throw new Error(`stopped: ${MAX_REQUESTS} requests this run`);
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = lastRequest + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    requests++;
    const res = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(60000) });
    if (res.status !== 429) return res;
    tooMany++;
    if (tooMany >= 2) throw new Error('stopped: a second 429 in this run');
    const after = Number(res.headers.get('retry-after'));
    await sleep((Number.isFinite(after) && after > 0 ? after : 30) * 1000);
  }
  throw new Error(`gave up on ${url}`);
}

let overpassDown = false;

async function fetchWays(ref, source, refresh) {
  const [kind, id] = ref.split(':');
  const cacheFile = path.join(cacheDir, 'osm', `${kind}-${id}.json`);
  if (!refresh && existsSync(cacheFile)) return readJson(cacheFile);
  let result = null;
  if (source !== 'osm-api' && !overpassDown) {
    const q = kind === 'relation' ? `[out:json][timeout:60];relation(${id});way(r);out geom;` : `[out:json][timeout:60];way(${id});out geom;`;
    try {
      const res = await polite('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(q)}` });
      const text = await res.text();
      if (res.ok && text.trim().startsWith('{')) result = { read: new Date().toISOString().slice(0, 10), source: 'overpass', ways: waysFromOverpass(JSON.parse(text)) };
      else console.warn(`overpass answered ${res.status} for ${ref}`);
    } catch (e) {
      console.warn(`overpass failed for ${ref}: ${e.message}`);
    }
    if (!result && source === 'overpass') throw new Error(`overpass gave nothing for ${ref}`);
    if (!result) overpassDown = true;
  }
  if (!result) {
    const res = await polite(`https://api.openstreetmap.org/api/0.6/${kind}/${id}/full.json`);
    if (!res.ok) throw new Error(`osm api ${res.status} for ${ref}`);
    result = { read: new Date().toISOString().slice(0, 10), source: 'osm-api', ways: waysFromOsmApi(await res.json()) };
  }
  mkdirSync(path.dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(result));
  return result;
}

const tileCache = new Map();
async function tile(z, x, y) {
  const k = `${z}/${x}/${y}`;
  if (tileCache.has(k)) return tileCache.get(k);
  const file = path.join(cacheDir, 'terrarium', `${z}-${x}-${y}.png`);
  let buf;
  if (existsSync(file)) buf = readFileSync(file);
  else {
    const res = await polite(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`);
    if (!res.ok) throw new Error(`terrain tile ${k}: ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, buf);
  }
  const { default: sharp } = await import('sharp');
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const t = { data, channels: info.channels, w: info.width, h: info.height };
  tileCache.set(k, t);
  return t;
}

/** Elevation (m) at [lon, lat] by bilinear interpolation inside the Terrarium tile that holds it. */
async function elevationAt(lon, lat) {
  const n = 2 ** DEM_ZOOM;
  const fx = ((lon + 180) / 360) * n;
  const fy = ((1 - Math.log(Math.tan(lat * rad) + 1 / Math.cos(lat * rad)) / Math.PI) / 2) * n;
  const tx = Math.floor(fx);
  const ty = Math.floor(fy);
  const t = await tile(DEM_ZOOM, tx, ty);
  const px = Math.min(t.w - 1.001, Math.max(0, (fx - tx) * t.w - 0.5));
  const py = Math.min(t.h - 1.001, Math.max(0, (fy - ty) * t.h - 0.5));
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const at = (xx, yy) => {
    const i = (yy * t.w + xx) * t.channels;
    return decodeTerrarium(t.data[i], t.data[i + 1], t.data[i + 2]);
  };
  const ax = px - x0;
  const ay = py - y0;
  return at(x0, y0) * (1 - ax) * (1 - ay) + at(x0 + 1, y0) * ax * (1 - ay) + at(x0, y0 + 1) * (1 - ax) * ay + at(x0 + 1, y0 + 1) * ax * ay;
}

const round6 = (p) => [Math.round(p[0] * 1e6) / 1e6, Math.round(p[1] * 1e6) / 1e6];

async function buildTrack(inp, unconfirmed, source, refresh) {
  const ways = new Map();
  let read = null;
  let used = null;
  for (const ref of inp.osm) {
    const r = await fetchWays(ref, source, refresh);
    read = !read || r.read > read ? r.read : read;
    used = used && used !== r.source ? 'overpass+osm-api' : r.source;
    for (const w of r.ways) ways.set(w.id, w.line);
  }
  const { lines, stitched } = stitchWays([...ways.values()]);
  if (!lines.length) throw new Error('no geometry in the response');
  const thPoint = inp.trailhead ? [inp.trailhead.lon, inp.trailhead.lat] : null;
  const endsOf = (ls) => ls.flatMap((l) => [l[0], l[l.length - 1]]);
  const offset = thPoint ? Math.round(Math.min(...endsOf(lines).map((p) => haversine(p, thPoint)))) : null;
  const total = lines.reduce((s, l) => s + lengthM(l), 0) / 1000;
  const heldBack = [];
  if (unconfirmed.has(inp.place)) heldBack.push('listed in UNCONFIRMED_TRAIL_DATA');
  if (!stitched) heldBack.push('the relation does not stitch into one line');
  if (offset !== null && offset > START_TOLERANCE_M) heldBack.push(`starts ${offset} m from our trailhead`);
  if (!lengthConsistent(total, inp.researchedKm)) heldBack.push(`${Math.round(total * 10) / 10} km against ${inp.researchedKm} km researched`);
  const confirmed = heldBack.length === 0;
  const base = { schema: SCHEMA, place: inp.place, refs: inp.refs ?? [], osm: inp.osm, fetched: read, source: used, licence: LICENCE, attribution: ATTRIBUTION, stitched, confirmed, held_back: heldBack, start_offset_m: offset, simplify_m: SIMPLIFY_M, step_m: SAMPLE_STEP_M };
  if (!stitched) {
    const segments = lines.map((l) => simplifyToLimit(l, SIMPLIFY_M, Math.floor(MAX_POINTS / lines.length)).line.map(round6));
    return { ...base, totals: { km: Math.round((lines.reduce((s, l) => s + lengthM(l), 0) / 1000) * 100) / 100, gain_m: null, loss_m: null, high_m: null, low_m: null }, dem: null, geometry: [], segments, elevation: [] };
  }
  let line = lines[0];
  // oriented from the end nearest our trailhead
  if (thPoint && haversine(line[line.length - 1], thPoint) < haversine(line[0], thPoint)) line = [...line].reverse();
  const simple = simplifyToLimit(line).line.map(round6);
  const samples = resample(simple);
  const elevation = [];
  for (const s of samples) elevation.push([Math.round(s.d), Math.round((await elevationAt(s.at[0], s.at[1])) * 10) / 10]);
  return { ...base, totals: totalsFromSamples(elevation), dem: DEM_NAME, geometry: simple, elevation };
}

async function runFetch(argv) {
  const get = (name) => argv[argv.indexOf(name) + 1];
  const only = argv.includes('--only') ? new Set(get('--only').split(',')) : null;
  const source = argv.includes('--source') ? get('--source') : 'auto';
  const refresh = argv.includes('--refresh');
  const rebuild = argv.includes('--rebuild');
  const unconfirmed = loadUnconfirmed();
  const have = loadFiles();
  const todo = loadInputs().filter((i) => (only ? only.has(i.place) : refresh || rebuild || !have.has(i.place) || have.get(i.place).osm.join() !== i.osm.join()));
  mkdirSync(tracksDir, { recursive: true });
  const failed = [];
  for (const inp of todo) {
    try {
      const t = await buildTrack(inp, unconfirmed, source, refresh);
      writeFileSync(path.join(tracksDir, `${inp.place}.json`), formatTrack(t));
      console.log(`${inp.place}: ${t.stitched ? `${t.geometry.length} points, ${t.totals.km} km, +${t.totals.gain_m} m` : `${t.segments.length} segments, not stitched`}; start ${t.start_offset_m ?? '?'} m from our trailhead; ${t.confirmed ? 'confirmed' : 'held back'}`);
    } catch (e) {
      failed.push(`${inp.place}: ${e.message}`);
      console.error(`${inp.place}: FAILED ${e.message}`);
      if (/^stopped/.test(e.message)) break;
    }
  }
  console.log(`${todo.length - failed.length} written, ${failed.length} failed, ${requests} requests`);
  return failed.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  if (argv.includes('--check')) process.exit(runCheck());
  if (!process.env.TRACKS_LOCKED) {
    // one Overpass job on the machine at a time (L2b and CS7 use the same lock)
    const r = spawnSync('flock', ['/tmp/travel-overpass.lock', process.execPath, process.argv[1], ...argv], { stdio: 'inherit', env: { ...process.env, TRACKS_LOCKED: '1' } });
    process.exit(r.status ?? 1);
  }
  runFetch(argv).then((code) => process.exit(code), (e) => {
    console.error(e);
    process.exit(1);
  });
}
