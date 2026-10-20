// Place names for the parser (A1, A5, A6): areas, places and trips from the records the search already loads. No new list of places (P8).
import { normalize } from '@/lib/search/normalize';
import type { SearchRecord } from '@/lib/search/types';
import { GENERIC_AREA_WORDS, RANGES } from './phrases';

export interface Area {
  rec: SearchRecord;
  /** Lower-case path from the globe address: ['ca', 'alberta', 'banff']. */
  path: string[];
  norm: string;
  places: number;
}

export interface NameIndex {
  /** Every name of every kind, for A1. */
  names: Map<string, SearchRecord[]>;
  /** Areas of the globe tree (not landforms), by normalised name. */
  areas: Map<string, Area[]>;
  list: Area[];
  byPath: Map<string, Area>;
  /** Landforms and seas: names with no tree path, which set no filter (A5). */
  features: Map<string, SearchRecord[]>;
  places: Map<string, SearchRecord[]>;
  trips: SearchRecord[];
  records: readonly SearchRecord[];
  /** Every word of every name and match text in the records: a word of a query that is not here matches nothing. */
  tokens: Set<string>;
}

const cache = new WeakMap<readonly SearchRecord[], NameIndex>();

/** `/globe/ca/alberta/banff/` -> ['ca', 'alberta', 'banff'], and null for a landform address (`/globe/?c=...`). */
export function pathOf(h: string): string[] | null {
  const m = /^\/globe\/((?:[a-z0-9-]+\/)+)$/.exec(h);
  return m ? m[1]!.split('/').filter(Boolean) : null;
}

const push = <T>(m: Map<string, T[]>, k: string, v: T): void => {
  const l = m.get(k);
  if (l) l.push(v);
  else m.set(k, [v]);
};

export function indexNames(records: readonly SearchRecord[]): NameIndex {
  const hit = cache.get(records);
  if (hit) return hit;
  const ix: NameIndex = { names: new Map(), areas: new Map(), list: [], byPath: new Map(), features: new Map(), places: new Map(), trips: [], records, tokens: new Set() };
  for (const rec of records) {
    const norm = normalize(rec.n);
    if (!norm) continue;
    for (const w of `${norm} ${normalize(rec.x)}`.split(' ')) if (w) ix.tokens.add(w);
    push(ix.names, norm, rec);
    if (rec.k === 'trip') ix.trips.push(rec);
    else if (rec.k === 'place') push(ix.places, norm, rec);
    else {
      const path = pathOf(rec.h);
      if (!path) push(ix.features, norm, rec);
      else {
        const area: Area = { rec, path, norm, places: Number(/(\d+) places?\b/.exec(rec.s)?.[1] ?? 0) };
        push(ix.areas, norm, area);
        ix.list.push(area);
        ix.byPath.set(path.join('/'), area);
      }
    }
  }
  cache.set(records, ix);
  return ix;
}

/** A range word read through the trips that carry it (RANGES): the area paths of their places. */
export interface RangeHit {
  name: string;
  /** `cc/region/district` of every area the range's trips reach. */
  paths: string[];
}

export type NameHit =
  | { kind: 'area'; area: Area; others: Area[] }
  | { kind: 'range'; range: RangeHit }
  | { kind: 'place'; rec: SearchRecord }
  | { kind: 'feature'; rec: SearchRecord };

const byPlaces = (a: Area, b: Area) => b.places - a.places || a.path.length - b.path.length;

/**
 * A place-like run of words against the names (A5). Full name first, then a prefix of at least four letters (`isWord` stops a prefix
 * from catching an ordinary vocabulary word). One area wins by its place count and the rest are offered.
 */
export function resolveName(ix: NameIndex, text: string, prefix: boolean): NameHit | null {
  const range = resolveRange(ix, text);
  const exact = ix.areas.get(text);
  const near = prefix && text.length >= 4 ? ix.list.filter((a) => a.norm !== text && a.norm.startsWith(text)).sort(byPlaces) : [];
  if (exact?.length) {
    const [main, ...rest] = [...exact].sort(byPlaces);
    return { kind: 'area', area: main!, others: [...rest, ...near] };
  }
  if (range) return { kind: 'range', range };
  const place = ix.places.get(text)?.[0];
  if (place) return { kind: 'place', rec: place };
  const feature = ix.features.get(text)?.[0];
  if (feature) return { kind: 'feature', rec: feature };
  if (near.length) return { kind: 'area', area: near[0]!, others: near.slice(1) };
  return null;
}

/**
 * The area of a place record (A6): the deepest area of the tree whose name ends the place's match text and whose parents are all in it.
 * A place record carries the area chain in `x` (country, region, area) and nothing with a slug.
 */
export function placeArea(ix: NameIndex, place: SearchRecord): Area | null {
  const x = ` ${normalize(place.x)} `;
  let best: Area | null = null;
  for (const a of ix.list) {
    if (!x.endsWith(` ${a.norm} `) && !x.includes(` ${a.norm} `)) continue;
    const parents = a.path.slice(0, -1).map((_, i) => ix.byPath.get(a.path.slice(0, i + 1).join('/'))?.norm);
    if (!parents.every((p) => p && x.includes(` ${p} `))) continue;
    if (!best || a.path.length > best.path.length || (a.path.length === best.path.length && x.endsWith(` ${a.norm} `) && !x.endsWith(` ${best.norm} `))) best = a;
  }
  return best;
}

/** Display name of an area with its parent: "Banff, Alberta". A country is just its name. */
export function areaLabel(ix: NameIndex, a: Area): string {
  if (a.path.length < 2) return a.rec.n;
  const parent = ix.byPath.get(a.path.slice(0, -1).join('/'));
  return parent ? `${a.rec.n}, ${parent.rec.n}` : a.rec.n;
}

const GENERIC = new Set(GENERIC_AREA_WORDS);

/**
 * The other areas of the same country and depth that carry this area's name, or are carried by it (smart-search 4.20): "Banff" and
 * "Banff National Park", "Canmore" and "Canmore Area". It goes by whole words, and the shared name must hold a word that names a place:
 * "Lake" or "National Park" alone never joins anything, so a generic word cannot widen a query to every park.
 */
export function relatedAreas(ix: NameIndex, a: Area): Area[] {
  return ix.list.filter((b) => {
    if (b === a || b.path[0] !== a.path[0] || b.path.length !== a.path.length || b.norm === a.norm) return false;
    const [short, long] = a.norm.length < b.norm.length ? [a.norm, b.norm] : [b.norm, a.norm];
    return ` ${long} `.includes(` ${short} `) && short.split(' ').some((w) => w.length > 2 && !GENERIC.has(w));
  });
}

/** The range a typed phrase names, with the area paths of the trips that carry it. Null when it is no range or no trip carries it. */
export function resolveRange(ix: NameIndex, text: string): RangeHit | null {
  const key = Object.keys(RANGES).find((k) => RANGES[k]!.words.includes(text));
  if (!key) return null;
  const range = RANGES[key]!;
  const paths = new Set<string>();
  for (const t of ix.trips) {
    const hay = ` ${normalize(`${t.n} ${t.x}`)} `;
    if (t.ar && range.trips.some((w) => hay.includes(` ${w} `))) for (const p of t.ar) paths.add(p);
  }
  return paths.size ? { name: range.name, paths: [...paths].sort() } : null;
}
