import { boxOfPoints, type Bbox, type Pt } from './geometry';
import { TIER_RANK } from './cluster';
import type { CountryFacts, GlobeData, GlobeTreeNode as GlobeNode, LightPin as GlobePin, PinModel } from './types';

/** The node of the index tree at `path` (['it', 'south-tyrol']), or null. */
export function nodeAt(data: GlobeData, path: string[]): GlobeNode | null {
  if (!path.length) return null;
  const country = data.index.continents.flatMap((c) => c.countries).find((n) => n.slug === path[0]);
  let node: GlobeNode | undefined = country;
  for (const s of path.slice(1)) node = node?.children.find((c) => c.slug === s);
  return node ?? null;
}

const startsWith = (pin: GlobePin, path: string[]): boolean => path.every((s, i) => pin.path[i] === s);

/** Real (not country-centre) points under an area. */
export function pinsUnder(data: GlobeData, path: string[], kind?: GlobePin['kind']): GlobePin[] {
  return data.index.pins.filter((p) => startsWith(p, path) && (!kind || p.kind === kind));
}

export function boxOfArea(data: GlobeData, path: string[]): Bbox | null {
  const pts = pinsUnder(data, path, 'place').map((p): Pt => [p.lon, p.lat]);
  return boxOfPoints(pts);
}

const meanPoint = (pins: GlobePin[]): Pt => [pins.reduce((s, p) => s + p.lon, 0) / pins.length, pins.reduce((s, p) => s + p.lat, 0) / pins.length];

/** Rounds to about 11 m so co-located pins share a key. */
export const colocationKey = (p: { lng: number; lat: number }): string => `${p.lng.toFixed(4)},${p.lat.toFixed(4)}`;

const placePin = (p: GlobePin, quiet = false): PinModel => {
  const key = `${p.kind}:${p.slug}`;
  return { id: key, kind: p.kind, lng: p.lon, lat: p.lat, count: 1, label: p.name, cardKey: key, glyph: p.kind === 'trip' ? 'trip' : p.type, tier: p.tier ?? 'local', ...(quiet ? { quiet: true } : {}) };
};

/** Place pins drawn as pins at a country (spec relevance 6.4): world and national only, world first, at most 30. */
export const COUNTRY_PIN_CAP = 30;
export function topPlaces(places: GlobePin[], cap = COUNTRY_PIN_CAP): GlobePin[] {
  return places
    .filter((p) => p.kind === 'place' && (p.tier === 'world' || p.tier === 'national'))
    .sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || a.name.localeCompare(b.name))
    .slice(0, cap);
}

/**
 * What the globe draws at a given area path (patterns 3.2): the world shows one pin per country with content;
 * a country shows its state pins and trips; a state shows district pins (two or more places) and the places
 * themselves; a district shows its places. Places inside the open area only; trips of the open country always.
 * The world level needs only the tree; any other level needs that country's pins in `data.index.pins` (see `store.ts`).
 */
export function pinsFor(data: GlobeData, path: string[], countries: Record<string, CountryFacts>): PinModel[] {
  const out: PinModel[] = [];
  if (!path.length) {
    for (const c of data.index.continents.flatMap((x) => x.countries)) {
      const total = c.places + c.trips;
      if (!total) continue;
      const facts = Object.values(countries).find((f) => f.a2.toLowerCase() === c.slug);
      const at: Pt | null = facts?.latlng ? [facts.latlng[1], facts.latlng[0]] : (c.at ?? null);
      if (at) out.push({ id: `country:${c.slug}`, kind: 'country', lng: at[0], lat: at[1], count: total, label: facts?.name ?? c.name, path: [c.slug], tier: 'world' });
    }
    return out;
  }
  const country = nodeAt(data, path.slice(0, 1));
  const here = nodeAt(data, path);
  const trips = pinsUnder(data, path.slice(0, 1), 'trip');
  for (const t of trips) out.push(placePin(t));
  const places = pinsUnder(data, path, 'place');
  if (path.length === 1) {
    for (const s of country?.children ?? []) {
      const under = pinsUnder(data, [path[0], s.slug], 'place');
      if (!under.length) continue;
      const [lng, lat] = meanPoint(under);
      out.push({ id: `state:${path[0]}/${s.slug}`, kind: 'state', lng, lat, count: s.places + s.trips, label: s.name, path: [path[0], s.slug], tier: 'national' });
    }
    // The places people travel for are pins from here (relevance 6.4); the rest wait in the state discs until a state opens.
    for (const p of topPlaces(places)) out.push(placePin(p));
    return out;
  }
  const districtPlaces = new Set<string>();
  if (path.length === 2) {
    for (const d of here?.children ?? []) {
      const under = pinsUnder(data, [path[0], path[1], d.slug], 'place');
      if (under.length < 2) continue;
      under.forEach((p) => districtPlaces.add(p.slug));
      const [lng, lat] = meanPoint(under);
      out.push({ id: `district:${path.join('/')}/${d.slug}`, kind: 'district', lng, lat, count: d.places + d.trips, label: d.name, path: [path[0], path[1], d.slug], tier: 'regional' });
    }
    // The neighbouring states stay on the map as discs, dimmed, so a neighbour is one click away (spec 6.4).
    for (const s of country?.children ?? []) {
      if (s.slug === path[1]) continue;
      const under = pinsUnder(data, [path[0], s.slug], 'place');
      if (!under.length) continue;
      const [lng, lat] = meanPoint(under);
      out.push({ id: `state:${path[0]}/${s.slug}`, kind: 'state', lng, lat, count: s.places + s.trips, label: s.name, path: [path[0], s.slug], tier: 'national', dim: true });
    }
  }
  if (path.length === 3) {
    const state = nodeAt(data, path.slice(0, 2));
    for (const d of state?.children ?? []) {
      if (d.slug === path[2]) continue;
      const under = pinsUnder(data, [path[0], path[1], d.slug], 'place');
      if (under.length < 2) continue;
      const [lng, lat] = meanPoint(under);
      out.push({ id: `district:${path[0]}/${path[1]}/${d.slug}`, kind: 'district', lng, lat, count: d.places + d.trips, label: d.name, path: [path[0], path[1], d.slug], tier: 'regional', dim: true });
    }
  }
  for (const p of places) {
    if (districtPlaces.has(p.slug)) continue;
    // State level: regional and above are pins, local places are quiet dots; a district shows them all (relevance 6.4).
    out.push(placePin(p, path.length === 2 && p.tier === 'local'));
  }
  return out;
}

export interface Group { key: string; at: Pt; pins: PinModel[] }

/** Pins on the same spot become one group (a merged pin with a count that fans out). */
export function groupColocated(pins: PinModel[]): Group[] {
  const by = new Map<string, PinModel[]>();
  for (const p of pins) by.set(colocationKey(p), [...(by.get(colocationKey(p)) ?? []), p]);
  return [...by].map(([key, ps]) => ({ key, at: [ps[0].lng, ps[0].lat] as Pt, pins: ps }));
}

/** Disc diameter in px: 28 to 44 by count (components 7.2). */
export function discSize(count: number): number {
  return Math.round(28 + Math.min(1, Math.log2(Math.max(1, count)) / Math.log2(60)) * 16);
}

/** The area path that holds a place or trip pin, as the URL's level. */
export function areaPathOfPin(data: GlobeData, key: string): string[] {
  const [kind, slug] = key.split(':');
  const pin = data.index.pins.find((p) => p.kind === kind && p.slug === slug);
  return pin ? pin.path : [];
}
