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

/* ------------------------------------------------------------------ cutting and joining routes (pure) */

/** Where an anchor (a trailhead, a destination, a junction) lands on a set of ways: nearest point on any segment, in metres. */
export function nearestOnWays(ways, pt) {
  const kx = Math.cos(pt[1] * rad) * R * rad;
  const ky = R * rad;
  let best = { dist: Infinity, way: -1, seg: -1, t: 0, point: null };
  ways.forEach((w, wi) => {
    for (let i = 0; i + 1 < w.length; i++) {
      const ax = (w[i][0] - pt[0]) * kx;
      const ay = (w[i][1] - pt[1]) * ky;
      const dx = (w[i + 1][0] - w[i][0]) * kx;
      const dy = (w[i + 1][1] - w[i][1]) * ky;
      const l2 = dx * dx + dy * dy;
      const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2));
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < best.dist) best = { dist: d, way: wi, seg: i, t, point: [w[i][0] + (w[i + 1][0] - w[i][0]) * t, w[i][1] + (w[i + 1][1] - w[i][1]) * t] };
    }
  });
  return best;
}

/** Distance in metres from `pt` to the nearest point of the ways, not to the nearer end. */
export const offsetToWays = (ways, pt) => nearestOnWays(ways, pt).dist;

/**
 * Adds `pt` to the ways as a vertex on its nearest segment (so a cut can start exactly there) and returns the vertex key and
 * the distance from `pt` to it. The ways are changed in place.
 */
export function splitAt(ways, pt) {
  const n = nearestOnWays(ways, pt);
  if (n.way < 0) return null;
  const w = ways[n.way];
  const segLen = haversine(w[n.seg], w[n.seg + 1]);
  if (n.t * segLen < 0.5) return { key: key(w[n.seg]), dist: n.dist };
  if ((1 - n.t) * segLen < 0.5) return { key: key(w[n.seg + 1]), dist: n.dist };
  w.splice(n.seg + 1, 0, n.point);
  return { key: key(n.point), dist: n.dist };
}

/** A walkable graph over ways that share end points or vertices: Map key -> {p, adj: Map key -> metres}. */
export function graphOf(ways) {
  const g = new Map();
  const node = (p) => {
    const k = key(p);
    if (!g.has(k)) g.set(k, { p, adj: new Map() });
    return g.get(k);
  };
  for (const w of ways) {
    for (let i = 0; i + 1 < w.length; i++) {
      const a = node(w[i]);
      const b = node(w[i + 1]);
      if (a === b) continue;
      const d = haversine(w[i], w[i + 1]);
      a.adj.set(key(w[i + 1]), Math.min(d, a.adj.get(key(w[i + 1])) ?? Infinity));
      b.adj.set(key(w[i]), Math.min(d, b.adj.get(key(w[i])) ?? Infinity));
    }
  }
  return g;
}

/** Dijkstra from `from`: {dist: Map, prev: Map}. */
export function walkFrom(g, from) {
  const dist = new Map([[from, 0]]);
  const prev = new Map();
  const done = new Set();
  const open = [[0, from]];
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [d, k] = open.splice(bi, 1)[0];
    if (done.has(k)) continue;
    done.add(k);
    for (const [nk, len] of g.get(k)?.adj ?? []) {
      const nd = d + len;
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        prev.set(nk, k);
        open.push([nd, nk]);
      }
    }
  }
  return { dist, prev };
}

/** The points from `from` to `to` along the walk, or null when `to` is not reachable. */
export function pathTo(g, walk, from, to) {
  if (!walk.dist.has(to)) return null;
  const keys = [to];
  while (keys[keys.length - 1] !== from) keys.push(walk.prev.get(keys[keys.length - 1]));
  return keys.reverse().map((k) => g.get(k).p);
}

/** Points within `eps` metres of the other graph's segments, from `a`'s nodes: [{key, touch}] (touch = the distance). */
function touching(g, otherWays) {
  const out = [];
  for (const [k, v] of g) out.push({ key: k, touch: offsetToWays(otherWays, v.p) });
  return out;
}

const JUNCTION_MIN_M = 300;
const JUNCTION_EPS_M = 3;
const JUNCTION_MAX_M = 150;

/**
 * Cuts and joins a route. `pieces` are the ways of each OSM record in walking order ([[line, ...], ...]); the route enters the
 * first at the trailhead (nearest point of the line, not the nearer end), passes from each piece to the next where they touch
 * (the first touching point at least 300 m on), and leaves the last at the destination. Without a destination the last piece
 * runs to its far end; with `loop` it closes back to the trailhead. A relation that is itself a closed loop is walked whole
 * from the trailhead. Returns {line, startOffset, endOffset, legs, cut} or {problem}.
 */
export function routeThrough(pieces, { trailhead, destination = null, loop = false }) {
  if (!trailhead || !pieces.length) return { problem: 'no trailhead to cut at' };
  const T = [trailhead.lon, trailhead.lat];
  const D = destination ? [destination.lon, destination.lat] : null;
  const ways = pieces.map((p) => p.map((w) => w.slice()));
  const first = splitAt(ways[0], T);
  if (!first) return { problem: 'no geometry' };
  const startOffset = Math.round(first.dist);
  if (pieces.length === 1) {
    const ring = stitchWays(ways[0]);
    const chain = ring.lines[0];
    if (ring.stitched && chain.length > 3 && key(chain[0]) === key(chain[chain.length - 1])) {
      // a closed ring is walked whole from the trailhead and back to it
      const at = chain.findIndex((q) => key(q) === first.key);
      const line = [...chain.slice(at), ...chain.slice(1, at + 1)];
      return { line, startOffset, endOffset: D ? Math.round(offsetToWays(pieces[0], D)) : null, legs: [{ index: 0, km: Math.round((lengthM(line) / 1000) * 100) / 100 }], cut: 'ring' };
    }
  }
  let entry = first.key;
  const legs = [];
  const out = [];
  for (let i = 0; i < pieces.length; i++) {
    const g = graphOf(ways[i]);
    const walk = walkFrom(g, entry);
    const last = i === pieces.length - 1;
    let exit = null;
    if (!last) {
      const cand = touching(g, ways[i + 1]).filter((c) => (walk.dist.get(c.key) ?? -1) >= JUNCTION_MIN_M);
      const tight = cand.filter((c) => c.touch <= JUNCTION_EPS_M).sort((a, b) => walk.dist.get(a.key) - walk.dist.get(b.key))[0];
      const near = cand.filter((c) => c.touch <= JUNCTION_MAX_M).sort((a, b) => a.touch - b.touch || walk.dist.get(a.key) - walk.dist.get(b.key))[0];
      exit = tight ?? near;
      if (!exit) return { problem: `record ${i + 1} does not meet record ${i + 2} within ${JUNCTION_MAX_M} m past ${JUNCTION_MIN_M} m` };
      exit = exit.key;
    } else if (loop) {
      const back = splitAt(ways[i], T);
      exit = back.key;
    } else if (D) {
      const dest = splitAt(ways[i], D);
      if (dest.dist > START_TOLERANCE_M) return { problem: `our destination is ${Math.round(dest.dist)} m from the line` };
      exit = dest.key;
    } else {
      // far end: the reachable end (degree 1) with the longest walk
      const ends = [...g.entries()].filter(([k, v]) => v.adj.size === 1 && walk.dist.has(k)).sort((a, b) => walk.dist.get(b[0]) - walk.dist.get(a[0]));
      if (!ends.length) return { problem: 'the last record has no free end to run to' };
      // alone, the record must start near one end: mid-line there is no telling which way the walk goes
      if (i === 0 && walk.dist.get(ends[ends.length - 1][0]) > JUNCTION_MIN_M) return { problem: 'the record runs on both sides of the trailhead and no destination point is recorded' };
      exit = ends[0][0];
    }
    // splitAt may have added vertices: walk again on the final graph
    const g2 = graphOf(ways[i]);
    const w2 = walkFrom(g2, entry);
    const seg = pathTo(g2, w2, entry, exit);
    if (!seg) return { problem: `no walkable path inside record ${i + 1}` };
    legs.push({ index: i, km: Math.round((w2.dist.get(exit) / 1000) * 100) / 100 });
    out.push(...(out.length ? seg.slice(1) : seg));
    if (!last) {
      const at = g2.get(exit).p;
      const nxt = splitAt(ways[i + 1], at);
      entry = nxt.key;
    }
  }
  const endOffset = D ? Math.round(offsetToWays(pieces[pieces.length - 1], D)) : null;
  return { line: out, startOffset, endOffset, legs, cut: loop ? 'loop' : D ? 'destination' : 'far end' };
}

/** Terrarium PNG pixel -> metres above sea level. */
export const decodeTerrarium = (r, g, b) => r * 256 + g + b / 256 - 32768;

/**
 * Gain, loss, high and low from elevation samples. A change only counts once it exceeds `h` metres from the last counted
 * level, so DEM noise of a few metres does not inflate the climb.
 */
export function totalsFromSamples(samples, h = HYSTERESIS_M) {
  const e = samples.map((s) => s[1]);
  // peaks and valleys: a turn counts once the profile has moved `h` metres back from its extreme, and the extreme is what is credited
  let base = e[0];
  let lo = e[0];
  let hi = e[0];
  let dir = 0;
  let gain = 0;
  let loss = 0;
  for (const v of e) {
    if (dir === 0) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
      if (v - lo >= h) {
        dir = 1;
        hi = v;
      } else if (hi - v >= h) {
        dir = -1;
        lo = v;
      }
    } else if (dir === 1) {
      if (v > hi) hi = v;
      else if (hi - v >= h) {
        gain += hi - base;
        base = hi;
        dir = -1;
        lo = v;
      }
    } else if (v < lo) lo = v;
    else if (v - lo >= h) {
      loss += base - lo;
      base = lo;
      dir = 1;
      hi = v;
    }
  }
  if (dir === 1) gain += hi - base;
  else if (dir === -1) loss += base - lo;
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

/**
 * Capture-record links that name an OSM relation or way, in the order the record lists them (that order is the walking order
 * of a route made of several relations). `links` is a list of {kind, url, state}; an older `track_source` string is also read.
 * Nodes (parking, viewpoints) and `searched_none` entries are not tracks.
 */
export function osmRefsFromCapture(rec) {
  const urls = [];
  if (Array.isArray(rec?.links)) for (const l of rec.links) if (l?.kind === 'osm' && l.state !== 'searched_none' && typeof l.url === 'string') urls.push(l.url);
  if (typeof rec?.track_source === 'string') urls.push(rec.track_source);
  return [...new Set(urls.flatMap((u) => [...u.matchAll(/(relation|way)\/(\d+)/g)].map((m) => `${m[1]}:${m[2]}`)))];
}

const normName = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+walk$/i, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Prototype place ids in the "Trail data for a person to confirm" list, read from the adapter's own file. */
export function unconfirmedIds(source) {
  return new Set([...source.matchAll(/^\s*'?([\w-]+)'?:\s*'/gm)].map((m) => m[1]));
}

/**
 * Every trail with an OSM reference: [{place, name, osm: [...], refs, trailhead, destination, researchedKm, wrongRoute}].
 * The capture record of the same trail (a route of type nature.trail.*, matched by name) names the intended relations in its
 * `links`; they replace the ids written in the prototype fact. `ctx.points` is the relevance points file (the record's first
 * `reaches` point is the destination the track is cut at); `ctx.overrides` is data/tracks/inputs.json (`start` replaces the stored trailhead).
 */
export function collectInputs(snapshot, captureRecords = [], ctx = {}) {
  const routes = new Map();
  for (const rec of captureRecords) {
    if (rec?.layer !== 'route' || !/^nature\.trail\./.test(String(rec.type ?? ''))) continue;
    const k = normName(rec.name);
    const have = routes.get(k);
    // a record that names relations wins over one that does not
    if (!have || (osmRefsFromCapture(rec).length && !osmRefsFromCapture(have).length)) routes.set(k, rec);
  }
  const out = [];
  for (const p of snapshot.places ?? []) {
    const t = snapshot.trails?.[p.id];
    const over = ctx.overrides?.places?.[p.id] ?? {};
    const rec = routes.get(normName(p.name));
    let refs = osmRefsFromCapture(rec);
    if (!refs.length) refs = over.osm ?? osmRefsOf(t?.facts?.geometry_source?.v, t?.facts?.geometry_ids?.v);
    if (!refs.length) continue;
    // an explicit start point (inputs.json `start`) wins where the stored trailhead is far from the OSM line by design: the lift base, a gate before a closed road
    const startOver = over.start && Number.isFinite(over.start.lat) && Number.isFinite(over.start.lon) ? over.start : null;
    const th = startOver ?? snapshot.access?.[p.id]?.trailhead ?? t?.trailhead ?? null;
    const km = Number(String(t?.facts?.distance_km?.v ?? p.km ?? '').replace(/[^\d.]/g, ''));
    const reach = rec?.reaches?.map((r) => ctx.points?.[r]).find((q) => q && Number.isFinite(q.lat) && Number.isFinite(q.lon));
    const named = over.destination_ref ? ctx.points?.[over.destination_ref] : null;
    const dest = over.destination ?? (named ? { lat: named.lat, lon: named.lon } : null) ?? (reach ? { lat: reach.lat, lon: reach.lon } : null);
    out.push({
      place: p.id,
      name: p.name,
      osm: refs,
      refs: rec ? [String(rec.ref)] : [],
      trailhead: th ? { lat: th.lat, lon: th.lon } : null,
      destination: dest ? { lat: dest.lat, lon: dest.lon } : null,
      researchedKm: Number.isFinite(km) && km > 0 ? km : null,
      wrongRoute: over.wrong_route ?? null,
      loop: !!over.loop,
      startOverride: !!startOver,
    });
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
    ...(t.start_override ? { start_override: true } : {}),
    start_offset_m: t.start_offset_m,
    end_offset_m: t.end_offset_m,
    cut: t.cut,
    legs: t.legs,
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
  if (existsSync(tracksDir)) for (const n of readdirSync(tracksDir).filter((x) => x.endsWith('.json') && x !== 'inputs.json')) m.set(n.replace(/\.json$/, ''), readJson(path.join(tracksDir, n)));
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
  const pointsFile = path.join(repoRoot, 'data', 'relevance', 'inputs', 'points.json');
  const overFile = path.join(tracksDir, 'inputs.json');
  const points = existsSync(pointsFile) ? readJson(pointsFile).points : {};
  const overrides = existsSync(overFile) ? readJson(overFile) : {};
  return collectInputs(snapshot, recs, { points, overrides });
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
  const pieces = [];
  let read = null;
  let used = null;
  for (const ref of inp.osm) {
    const r = await fetchWays(ref, source, refresh);
    read = !read || r.read > read ? r.read : read;
    used = used && used !== r.source ? 'overpass+osm-api' : r.source;
    for (const w of r.ways) ways.set(w.id, w.line);
    // one piece per relation, in the order given; ways listed one by one are one piece together
    if (ref.startsWith('way:') && pieces.length && pieces.at(-1).way) {
      pieces.at(-1).lines.push(...r.ways.map((w) => w.line));
      pieces.at(-1).label = 'the ways';
    } else pieces.push({ way: ref.startsWith('way:'), lines: r.ways.map((w) => w.line), label: ref.replace(':', ' ') });
  }
  const thPoint = inp.trailhead ? [inp.trailhead.lon, inp.trailhead.lat] : null;
  const heldBack = [];
  if (unconfirmed.has(inp.place)) heldBack.push('listed in UNCONFIRMED_TRAIL_DATA');
  if (inp.wrongRoute) heldBack.push(`the stored OSM relation is the wrong route: ${inp.wrongRoute}`);
  const routed = routeThrough(pieces.map((x) => x.lines), { trailhead: inp.trailhead, destination: inp.destination, loop: !!inp.loop });
  let base;
  let line;
  let offset;
  let total;
  let stitched;
  let lines = [];
  if (!routed.problem) {
    line = routed.line;
    stitched = true;
    offset = routed.startOffset;
    total = lengthM(line) / 1000;
    if (offset > START_TOLERANCE_M) heldBack.push(`our trailhead is ${offset} m from the line`);
    if (routed.endOffset !== null && routed.endOffset > START_TOLERANCE_M) heldBack.push(`our destination is ${routed.endOffset} m from the line`);
    base = { cut: routed.cut, legs: routed.legs.map((l) => ({ osm: inp.osm.length === pieces.length ? inp.osm[l.index] : `${pieces[l.index].lines.length} ways`, km: l.km })), end_offset_m: routed.endOffset };
  } else {
    // nothing to cut at: keep the whole relation as one line (or as pieces), measured to the nearest point
    const st = stitchWays([...ways.values()]);
    lines = st.lines;
    stitched = st.stitched;
    if (!lines.length) throw new Error('no geometry in the response');
    offset = thPoint ? Math.round(offsetToWays(lines, thPoint)) : null;
    total = lines.reduce((s0, l) => s0 + lengthM(l), 0) / 1000;
    if (!stitched) heldBack.push('the relation does not stitch into one line');
    if (offset !== null && offset > START_TOLERANCE_M) heldBack.push(`our trailhead is ${offset} m from the line`);
    heldBack.push(`not cut: ${routed.problem.replace(/record (\d+)/g, (_, n) => pieces[Number(n) - 1]?.label ?? `record ${n}`)}`);
    base = { cut: null, legs: [], end_offset_m: null };
    line = stitched ? lines[0] : null;
  }
  if (!lengthConsistent(total, inp.researchedKm)) heldBack.push(`${Math.round(total * 10) / 10} km against ${inp.researchedKm} km researched`);
  const confirmed = heldBack.length === 0;
  const head = { schema: SCHEMA, place: inp.place, refs: inp.refs ?? [], osm: inp.osm, fetched: read, source: used, licence: LICENCE, attribution: ATTRIBUTION, stitched, confirmed, held_back: heldBack, ...(inp.startOverride ? { start_override: true } : {}), start_offset_m: offset, ...base, simplify_m: SIMPLIFY_M, step_m: SAMPLE_STEP_M };
  if (!stitched) {
    const segments = lines.map((l) => simplifyToLimit(l, SIMPLIFY_M, Math.floor(MAX_POINTS / lines.length)).line.map(round6));
    return { ...head, totals: { km: Math.round(total * 100) / 100, gain_m: null, loss_m: null, high_m: null, low_m: null }, dem: null, geometry: [], segments, elevation: [] };
  }
  // oriented from the end nearest our trailhead (a cut route already starts there)
  if (routed.problem && thPoint && haversine(line[line.length - 1], thPoint) < haversine(line[0], thPoint)) line = [...line].reverse();
  const simple = simplifyToLimit(line).line.map(round6);
  const samples = resample(simple);
  const elevation = [];
  for (const s of samples) elevation.push([Math.round(s.d), Math.round((await elevationAt(s.at[0], s.at[1])) * 10) / 10]);
  return { ...head, totals: totalsFromSamples(elevation), dem: DEM_NAME, geometry: simple, elevation };
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
