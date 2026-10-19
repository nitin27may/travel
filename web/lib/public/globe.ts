import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
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

/** The pin of a trip: its first base, from our own points, then a place of that name, then the globe's gazetteer. */
function tripPin(trip: PublicTrip, folder: string, places: PublicPlace[], gaz: GazRow[]): { lat: number; lon: number; approx: boolean } | null {
  const bp = trip.bases[0]?.point;
  if (bp) return { lat: bp.lat, lon: bp.lon, approx: false };
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

export function buildGlobe(root: string, places: PublicPlace[], trips: PublicTrip[], listedFolders: Map<string, string>): GlobeIndex {
  const gaz = readGazetteer(root);
  const tiers = readDrawTiers(root);
  const folderOf = new Map([...listedFolders].map(([f, s]) => [s, f]));
  const pins: GlobePin[] = [];
  for (const p of places) {
    if (!p.point) continue;
    pins.push({ kind: 'place', slug: p.slug, name: p.name, lat: p.point.lat, lon: p.point.lon, type: p.kind, path: p.areaChain.map((a) => a.slug), approx: p.point.pointSource === 'prototype_approx', tier: tiers.get(normName(p.name)) ?? 'local' });
  }
  const tripCountry = new Map<string, string>();
  for (const t of trips) {
    const folder = folderOf.get(t.slug)!;
    const cc = TRIP_COUNTRY[folder]?.cc;
    if (!cc) continue;
    tripCountry.set(t.slug, cc);
    const pin = tripPin(t, folder, places, gaz);
    if (pin) pins.push({ kind: 'trip', slug: t.slug, name: t.title, lat: pin.lat, lon: pin.lon, type: t.depth, path: [cc], approx: pin.approx, tier: 'world' });
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
    const [c, s, d] = p.areaChain;
    if (!c) continue;
    const cn = countryNode(c.slug, c.name);
    bump(cn, 'places');
    if (s) {
      const sn = child(cn, s.slug, s.name);
      bump(sn, 'places');
      if (d) bump(child(sn, d.slug, d.name), 'places');
    }
  }
  const countryName = (cc: string) => [...places].flatMap((p) => p.areaChain).find((a) => a.level === 'country' && a.slug === cc)?.name ?? cc.toUpperCase();
  for (const t of trips) {
    const cc = tripCountry.get(t.slug);
    if (cc) bump(countryNode(cc, countryName(cc)), 'trips');
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
