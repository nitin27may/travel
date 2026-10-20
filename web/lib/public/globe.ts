import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { bbox, inBox, inFeature, topoFeatures, type Feat, type Topology } from '@/lib/globe/geometry';
import { slugify } from '@/lib/globe/geoWork';
import { CONTINENT_OF } from './taxonomy';
import { normName } from './places';
import { TRIP_SLUGS } from './slugs';
import type { DrawTier, GlobeIndex, GlobeNode, GlobePin, PublicPlace, PublicTrip } from './types';

/** Country of each trip (ISO alpha-2 and alpha-3), written out: overview trips have no day data to infer it from. */
export const TRIP_COUNTRY: Record<string, { cc: string; a3: string }> = {
  'dolomites-july-2027': { cc: 'it', a3: 'ITA' },
  'canadian-rockies-sept-2029': { cc: 'ca', a3: 'CAN' },
  'patagonia-feb-mar-2027': { cc: 'ar', a3: 'ARG' },
  'iceland-ring-road': { cc: 'is', a3: 'ISL' },
  'chamonix-mont-blanc-sept-2028': { cc: 'fr', a3: 'FRA' },
  'costa-rica-feb-2027': { cc: 'cr', a3: 'CRI' },
  'switzerland-2027': { cc: 'ch', a3: 'CHE' },
  'usa-southwest-rockies': { cc: 'us', a3: 'USA' },
  'algonquin-muskoka-oct-2026': { cc: 'ca', a3: 'CAN' },
  'vermont-fall-2026': { cc: 'us', a3: 'USA' },
  'quebec-sept-2026': { cc: 'ca', a3: 'CAN' },
  'norway-summer': { cc: 'no', a3: 'NOR' },
  'new-hampshire-stopover-2026': { cc: 'us', a3: 'USA' },
  'niagara-day-aug-2026': { cc: 'ca', a3: 'CAN' },
};

type GazRow = [string, string, number, number, string | null, ...unknown[]];

function readGazetteer(root: string): GazRow[] {
  const file = path.join(root, 'legacy', 'globe', 'assets', 'data', 'gazetteer.json');
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as GazRow[]) : [];
}

const TIER_ORDER: Record<DrawTier, number> = { local: 0, regional: 1, national: 2, world: 3 };
const isTier = (v: unknown): v is DrawTier => typeof v === 'string' && v in TIER_ORDER;

/**
 * The effective draw of each place, by normalised name, from the relevance sidecars (`data/relevance/derived`, read only). Refs look
 * like `trip/<slug>/<kind>:<name>` or `part/trip/<slug>/<kind>:<name>#<part>`; the highest tier wins when a place appears in several
 * trips. A place with no record is not in the map and counts as `local`.
 */
export function readDrawTiers(root: string): Map<string, DrawTier> {
  const dir = path.join(root, 'data', 'relevance', 'derived');
  const out = new Map<string, DrawTier>();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    let items: { ref?: unknown; effective_draw?: unknown }[] = [];
    try { items = (JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as { items?: typeof items }).items ?? []; } catch { continue; }
    for (const it of items) {
      if (typeof it.ref !== 'string' || !isTier(it.effective_draw)) continue;
      const name = it.ref.slice(it.ref.lastIndexOf(':') + 1).split('#')[0];
      const key = normName(name);
      const have = out.get(key);
      if (!have || TIER_ORDER[it.effective_draw] > TIER_ORDER[have]) out.set(key, it.effective_draw);
    }
  }
  return out;
}

/** data/trips/base-points.json: the sourced pin of a trip with no positioned base in its days, by legacy folder (backlog 3.41). */
export function readBasePoints(root: string): Map<string, { lat: number; lon: number }> {
  const file = path.join(root, 'data', 'trips', 'base-points.json');
  const out = new Map<string, { lat: number; lon: number }>();
  if (!existsSync(file)) return out;
  const doc = JSON.parse(readFileSync(file, 'utf8')) as { records?: { ref?: string; point?: { lat?: number; lon?: number } }[] };
  for (const r of doc.records ?? []) {
    const folder = /^trip\/(.+)$/.exec(r.ref ?? '')?.[1];
    if (folder && Number.isFinite(r.point?.lat) && Number.isFinite(r.point?.lon)) out.set(folder, { lat: r.point!.lat!, lon: r.point!.lon! });
  }
  return out;
}

/** The pin of a trip: its first base, then our sourced base point, then a place of that name, then the globe's gazetteer. */
function tripPin(trip: PublicTrip, folder: string, places: PublicPlace[], gaz: GazRow[], basePoints: ReadonlyMap<string, { lat: number; lon: number }> = new Map()): { lat: number; lon: number; approx: boolean } | null {
  const bp = trip.bases[0]?.point;
  if (bp) return { lat: bp.lat, lon: bp.lon, approx: false };
  const own0 = basePoints.get(folder);
  if (own0) return { lat: own0.lat, lon: own0.lon, approx: false };
  const a3 = TRIP_COUNTRY[folder]?.a3;
  const country = gaz.find((r) => r[0] === 'country' && r[4] === a3);
  const countryPin = country ? { lat: country[3], lon: country[2], approx: true } : null;
  const name = trip.firstBase;
  if (!name) return countryPin;
  const n = normName(name.replace(/\s+area$/i, ''));
  const own = places.filter((p) => p.point && normName(p.name) === n);
  if (own.length === 1) return { lat: own[0].point!.lat, lon: own[0].point!.lon, approx: false };
  const cities = gaz.filter((r) => r[0] === 'city' && r[4] === a3 && normName(String(r[1])) === n).sort((a, b) => Number(b[7] ?? 0) - Number(a[7] ?? 0));
  return cities[0] ? { lat: cities[0][3], lon: cities[0][2], approx: false } : countryPin;
}

const GLOBE_PUBLIC = () => path.join(process.cwd(), 'public', 'globe');

/** The Natural Earth admin-1 shapes of a country (ISO alpha-3), with their boxes; null when the build has no such file. */
function adminShapes(a3: string): Feat[] | null {
  const file = path.join(GLOBE_PUBLIC(), 'admin', `${a3}-ADM1.json`);
  if (!existsSync(file)) return null;
  const topo = JSON.parse(readFileSync(file, 'utf8')) as Topology;
  const fc = topoFeatures(topo, topo.objects[Object.keys(topo.objects)[0]]);
  const shapes = fc.features.filter((f) => f.geometry);
  shapes.forEach((f) => { f._bbox = bbox(f); });
  return shapes;
}

const A3_BY_A2 = (): Record<string, string> => {
  const file = path.join(GLOBE_PUBLIC(), 'data', 'countries.json');
  if (!existsSync(file)) return {};
  const facts = JSON.parse(readFileSync(file, 'utf8')) as Record<string, { a2: string; a3: string }>;
  return Object.fromEntries(Object.values(facts).map((f) => [f.a2.toLowerCase(), f.a3]));
};

/**
 * One node per admin-1 region (spec 11, review M6). The place store files South Tyrol, Trentino and Trentino-Alto Adige as three
 * regions, but Natural Earth has two shapes there, so the globe showed three discs for two shapes. Each place with a real point is
 * placed in the Natural Earth shape that holds it, and every region name that lands in one shape collapses into the one with most places.
 * Places with no shape (an approximate pin, a country with no admin file) keep the store's region.
 * Returns the canonical region of each place slug, and the shape index it fell in (for the build check).
 */
export function canonicalRegions(places: PublicPlace[]): { region: Map<string, { slug: string; name: string }>; shapeOf: Map<string, string>; winner: Map<string, { slug: string; name: string }>; shapesOf: (cc: string) => Feat[] | null } {
  const a3s = A3_BY_A2();
  const shapesByCc = new Map<string, Feat[] | null>();
  const shapeOf = new Map<string, string>();
  const byShape = new Map<string, Map<string, { name: string; n: number }>>();
  for (const p of places) {
    const [country, state] = p.areaChain;
    if (!country || !state || !p.point || p.point.pointSource === 'prototype_approx') continue;
    if (!shapesByCc.has(country.slug)) shapesByCc.set(country.slug, a3s[country.slug] ? adminShapes(a3s[country.slug]) : null);
    const shapes = shapesByCc.get(country.slug);
    if (!shapes) continue;
    const at: [number, number] = [p.point.lon, p.point.lat];
    const hit = shapes.findIndex((f) => f._bbox && inBox(f._bbox, at) && inFeature(f, at));
    if (hit < 0) continue;
    const key = `${country.slug}#${hit}`;
    shapeOf.set(p.slug, key);
    const names = byShape.get(key) ?? new Map();
    const have = names.get(state.slug) ?? { name: state.name, n: 0 };
    have.n += 1;
    names.set(state.slug, have);
    byShape.set(key, names);
  }
  const winner = new Map<string, { slug: string; name: string }>();
  for (const [key, names] of byShape) {
    const best = [...names].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))[0];
    winner.set(key, { slug: best[0], name: best[1].name });
  }
  const region = new Map<string, { slug: string; name: string }>();
  for (const [slug, key] of shapeOf) region.set(slug, winner.get(key)!);
  return { region, shapeOf, winner, shapesOf: (cc) => { if (!shapesByCc.has(cc)) shapesByCc.set(cc, a3s[cc] ? adminShapes(a3s[cc]) : null); return shapesByCc.get(cc) ?? null; } };
}

export function buildGlobe(root: string, places: PublicPlace[], trips: PublicTrip[], listedFolders: Map<string, string>): GlobeIndex {
  const gaz = readGazetteer(root);
  const basePoints = readBasePoints(root);
  const tiers = readDrawTiers(root);
  const folderOf = new Map([...listedFolders].map(([f, s]) => [s, f]));
  const pins: GlobePin[] = [];
  const { region, winner, shapesOf } = canonicalRegions(places);
  /** The state a sourced point lies in (the shape's own region name where places use one, else Natural Earth's name), for scoping a trip to a level. */
  const stateAt = (cc: string, lat: number, lon: number): { slug: string; name: string } | null => {
    const shapes = shapesOf(cc);
    const at: [number, number] = [lon, lat];
    const hit = shapes ? shapes.findIndex((f) => f._bbox && inBox(f._bbox, at) && inFeature(f, at)) : -1;
    if (hit < 0 || !shapes) return null;
    const name = String(shapes[hit].properties?.name ?? '');
    return winner.get(`${cc}#${hit}`) ?? (name ? { slug: slugify(name), name } : null);
  };
  /** The area chain with its state replaced by the one region that shape stands for. */
  const chainOf = (p: PublicPlace) => p.areaChain.map((a, i) => (i === 1 && region.get(p.slug) ? { ...a, ...region.get(p.slug)! } : a));
  for (const p of places) {
    if (!p.point) continue;
    pins.push({ kind: 'place', slug: p.slug, name: p.name, lat: p.point.lat, lon: p.point.lon, type: p.kind, path: chainOf(p).map((a) => a.slug), approx: p.point.pointSource === 'prototype_approx', tier: tiers.get(normName(p.name)) ?? 'local' });
  }
  const tripCountry = new Map<string, string>();
  const tripState = new Map<string, { slug: string; name: string }>();
  for (const t of trips) {
    const folder = folderOf.get(t.slug)!;
    const cc = TRIP_COUNTRY[folder]?.cc;
    if (!cc) continue;
    tripCountry.set(t.slug, cc);
    const pin = tripPin(t, folder, places, gaz, basePoints);
    if (pin) {
      // A trip belongs to the state its sourced base lies in, so a level lists only the trips inside it (review S1). An approximate pin has no state.
      const st = pin.approx ? null : stateAt(cc, pin.lat, pin.lon);
      if (st) tripState.set(t.slug, st);
      pins.push({ kind: 'trip', slug: t.slug, name: t.title, lat: pin.lat, lon: pin.lon, type: t.depth, path: st ? [cc, st.slug] : [cc], approx: pin.approx, tier: 'world' });
    }
  }

  const countries = new Map<string, GlobeNode>();
  const bump = (n: GlobeNode, kind: 'places' | 'trips') => { n[kind] += 1; };
  const child = (parent: GlobeNode, slug: string, name: string) => {
    let c = parent.children.find((x) => x.slug === slug);
    if (!c) parent.children.push((c = { slug, name, places: 0, trips: 0, children: [] }));
    return c;
  };
  const rootNode = { slug: '', name: '', places: 0, trips: 0, children: [] as GlobeNode[] };
  const countryNode = (cc: string, name: string) => {
    if (!countries.has(cc)) countries.set(cc, child(rootNode, cc, name));
    return countries.get(cc)!;
  };
  for (const p of places) {
    const [c, s, d] = chainOf(p);
    if (!c) continue;
    const cn = countryNode(c.slug, c.name);
    bump(cn, 'places');
    if (s) {
      const sn = child(cn, s.slug, s.name);
      bump(sn, 'places');
      if (d) bump(child(sn, d.slug, d.name), 'places');
    }
  }
  // A country with trips and no places (Switzerland, Norway) has no area chain to read a name from: take it from the gazetteer, which
  // names every country, and fall back to the code only when the gazetteer has no row (backlog 3.44).
  const gazName = (cc: string): string | undefined => {
    const a3 = Object.values(TRIP_COUNTRY).find((c) => c.cc === cc)?.a3;
    const row = gaz.find((r) => r[0] === 'country' && r[4] === a3);
    return row ? String(row[1]) : undefined;
  };
  const countryName = (cc: string) => [...places].flatMap((p) => p.areaChain).find((a) => a.level === 'country' && a.slug === cc)?.name ?? gazName(cc) ?? cc.toUpperCase();
  for (const t of trips) {
    const cc = tripCountry.get(t.slug);
    if (!cc) continue;
    const cn = countryNode(cc, countryName(cc));
    bump(cn, 'trips');
    const st = tripState.get(t.slug);
    if (st) bump(child(cn, st.slug, st.name), 'trips');
  }
  const sortNodes = (ns: GlobeNode[]) => { ns.sort((a, b) => a.name.localeCompare(b.name)); ns.forEach((n) => sortNodes(n.children)); };
  sortNodes(rootNode.children);
  const byContinent = new Map<string, GlobeNode[]>();
  for (const c of rootNode.children) byContinent.set(CONTINENT_OF[c.slug] ?? 'Other', [...(byContinent.get(CONTINENT_OF[c.slug] ?? 'Other') ?? []), c]);
  const continents = [...byContinent].sort((a, b) => a[0].localeCompare(b[0])).map(([name, cs]) => ({
    slug: kebabName(name), name, places: cs.reduce((s, c) => s + c.places, 0), trips: cs.reduce((s, c) => s + c.trips, 0), countries: cs,
  }));
  pins.sort((a, b) => a.kind.localeCompare(b.kind) || a.slug.localeCompare(b.slug));
  return { continents, pins };
}

const kebabName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export function globePathsOf(idx: GlobeIndex): string[][] {
  const out: string[][] = [];
  const walk = (n: GlobeNode, prefix: string[]) => {
    const p = [...prefix, n.slug];
    if (n.places + n.trips > 0) out.push(p);
    n.children.forEach((c) => walk(c, p));
  };
  for (const c of idx.continents) c.countries.forEach((n) => walk(n, []));
  return out;
}

export { TRIP_SLUGS };
