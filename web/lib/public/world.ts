// One memoised read of the capture, suitability and relevance sidecars for the whole adapter (list part). The place bands and the
// trip tags both come through here, so the join runs once per build. Server only (reads files); never import it from a client file.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { emptyIncoming, loadWorld } from '@travel/core/capture/records.ts';
import type { Incoming, Located, World } from '@travel/core/capture/records.ts';
import { folderVisibility, type ManifestFolder } from './sources';
import { TRIP_SLUGS } from './slugs';

// ---- the trip scope: which trips' records may reach a public output ---------------------------------------------------------
//
// A trip that is not built (manifest `private`, a `visibility` that is not public or unlisted, not served, or not in the manifest at
// all) must vanish from every public function (visibility.ts, plan 1.3). Its records sit in the capture world beside the catalogue's,
// and the relevance derive and the relations point across: a catalogue page's "Similar nearby", pairs, Plan B, "Coming from far?",
// parts, parks-for and same-place links can all name a trip record. So the world the adapter reads is cut at load: no record of a
// hidden trip, and no ref to one, is left in it (P9: one boundary, before any page, API answer, index or export is built).

/** `trip/<key>/...`, `legacy/<folder>/...`, and their parts and offers: the refs that name a trip in their own text. */
const TRIP_REF = /^(?:(?:part|offer)\/)?(?:trip|legacy)\/([^/#\s]+)/;
/** a trip ref inside free text (as pages.ts REF_TEXT): never a URL path, which has a `/` or `.` before it */
const REF_IN_TEXT = /(?<![\w/.:#-])(?:(?:part|offer)\/)?(?:trip|legacy)\/[^\s,;)"]+/g;
/** a string that is one ref and nothing else */
const WHOLE_REF = /^(?:(?:part|offer)\/)?(?:trip|legacy|place|route|offer|part|operator|event)\/\S+$/;

export interface TripScope {
  /** true when `ref`, as the record it resolves to, belongs to a trip that is not built or names one (fail closed: an unknown trip is hidden) */
  isPrivate(ref: string): boolean;
  /** true when the trip key (a public slug, a legacy folder or a capture folder) is not built */
  tripHidden(key: string): boolean;
}

/** The trip keys whose records may be public under `root`: each built folder's own name and its public slug, and the catalogue. */
export function builtTripKeys(root: string): Set<string> {
  const file = path.join(root, 'legacy', 'MANIFEST.json');
  const folders = existsSync(file) ? ((JSON.parse(readFileSync(file, 'utf8')) as { folders?: ManifestFolder[] }).folders ?? []) : [];
  const keys = new Set<string>(['catalogue']);
  for (const f of folders) {
    if (folderVisibility(f) === 'private' || !f.served || f.kind === 'site-page') continue;
    keys.add(f.slug);
    if (TRIP_SLUGS[f.slug]) keys.add(TRIP_SLUGS[f.slug]);
  }
  return keys;
}

/** The scope over a raw world: `raw` resolves aliases and tells which trip's file holds a record. */
export function scopeOver(raw: World, builtTrips: ReadonlySet<string>): TripScope {
  const tripHidden = (key: string): boolean => !builtTrips.has(key);
  const memo = new Map<string, boolean>();
  const isPrivate = (ref: string): boolean => {
    let v = memo.get(ref);
    if (v !== undefined) return v;
    // re-point first: a trip ref merged into a catalogue record is that record now, and is public when it is
    const primary = raw.alias.get(ref) ?? ref;
    const named = TRIP_REF.exec(primary)?.[1];
    const base = primary.replace(/^(?:part|offer)\//, '').split('#')[0]!;
    const loc = raw.cap.get(primary) ?? raw.suit.get(primary) ?? raw.rel.get(primary) ?? raw.cap.get(raw.alias.get(base) ?? base);
    v = (named !== undefined && tripHidden(named)) || (loc !== undefined && tripHidden(loc.trip));
    memo.set(ref, v);
    return v;
  };
  return { isPrivate, tripHidden };
}

/** A ref kept for a public output: null when it is private, its primary when its own text names a hidden trip, else itself. */
export function publicRef(scope: TripScope, raw: World, ref: string): string | null {
  if (scope.isPrivate(ref)) return null;
  const named = TRIP_REF.exec(ref)?.[1];
  return named !== undefined && scope.tripHidden(named) ? (raw.alias.get(ref) ?? null) : ref;
}

/**
 * A copy of `value` with every ref to a private record taken out: a ref in a list is dropped, an object in a list whose `ref` is
 * private is dropped, a ref field is removed, a ref written in free text is cut out, and an alias that names a hidden trip is dropped.
 * `value` itself is never changed; an unchanged branch is returned as it is, so a record that names no hidden trip stays shared.
 */
export function withoutPrivate<T>(value: T, scope: TripScope, raw: World): T {
  const DROP = Symbol('drop');
  const walk = (v: unknown, key: string, top: boolean): unknown => {
    if (typeof v === 'string') {
      if (WHOLE_REF.test(v)) {
        const r = publicRef(scope, raw, v);
        return r === null || (key === 'aliases' && r !== v) ? DROP : r;
      }
      if (!v.includes('trip/') && !v.includes('legacy/')) return v;
      const out = v.replace(REF_IN_TEXT, (m) => publicRef(scope, raw, m) ?? '');
      return out === v ? v : out.replace(/\s{2,}/g, ' ').trim();
    }
    if (Array.isArray(v)) {
      let changed = false;
      const out: unknown[] = [];
      for (const x of v) {
        const y = walk(x, key, false);
        if (y !== x) changed = true;
        if (y !== DROP) out.push(y);
      }
      return changed ? out : v;
    }
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      // an object that stands for a private record (a pair, a pass, a pick) goes with it
      if (!top && typeof o.ref === 'string' && WHOLE_REF.test(o.ref) && publicRef(scope, raw, o.ref) === null) return DROP;
      let copy: Record<string, unknown> | null = null;
      for (const k of Object.keys(o)) {
        const y = walk(o[k], k, false);
        if (y === o[k]) continue;
        copy ??= { ...o };
        if (y === DROP) delete copy[k];
        else copy[k] = y;
      }
      return copy ?? v;
    }
    return v;
  };
  return walk(value, '', true) as T;
}

/** the legacy names of Incoming share their arrays with offers_at, offers_on and members (records.ts) */
const LEGACY_SLOTS = new Set<keyof Incoming>(['at', 'on', 'children']);

/** The public world: `raw` without the records of hidden trips, and with no ref to one in any record, inverse, alias or point. */
export function publicView(raw: World, scope: TripScope): World {
  const keep = <R,>(m: Map<string, Located<R>>): Map<string, Located<R>> => {
    const out = new Map<string, Located<R>>();
    for (const [ref, loc] of m) {
      if (scope.tripHidden(loc.trip) || scope.isPrivate(ref)) continue;
      const rec = withoutPrivate(loc.rec, scope, raw);
      out.set(ref, rec === loc.rec ? loc : { ...loc, rec });
    }
    return out;
  };
  const cap = keep(raw.cap);
  const suit = keep(raw.suit);
  const rel = keep(raw.rel);
  const same = <R,>(a: Map<string, Located<R>>, b: Map<string, Located<R>>): boolean => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
  const aliasOk = [...raw.alias.values()].every((to) => !scope.isPrivate(to));
  const pointsOk = Object.keys(raw.points).every((r) => !scope.isPrivate(r));
  // nothing hidden: the raw world is the public one (no copy, so today's output is byte for byte what it was)
  if (same(cap, raw.cap) && same(suit, raw.suit) && same(rel, raw.rel) && aliasOk && pointsOk && [...raw.trips.keys()].every((t) => !scope.tripHidden(t))) return raw;

  const incoming = new Map<string, Incoming>();
  for (const [ref, inc] of raw.incoming) {
    if (scope.isPrivate(ref)) continue;
    const x = emptyIncoming();
    for (const k of Object.keys(inc) as (keyof Incoming)[]) {
      if (LEGACY_SLOTS.has(k)) continue;
      for (const r of inc[k]) if (!scope.isPrivate(r)) x[k].push(r);
    }
    incoming.set(ref, x);
  }
  const alias = new Map([...raw.alias].filter(([, to]) => !scope.isPrivate(to)));
  const points = Object.fromEntries(Object.entries(raw.points).filter(([r]) => !scope.isPrivate(r)));
  const trips = new Map([...raw.trips].filter(([t]) => !scope.tripHidden(t)).map(([t, refs]) => [t, refs.filter((r) => !scope.isPrivate(r))]));
  const operators = new Map([...raw.operators].map(([ref, o]) => [ref, withoutPrivate(o, scope, raw)]));
  const supersedes = raw.supersedes ? new Map([...raw.supersedes].filter(([, e]) => !scope.isPrivate(e.ref))) : undefined;
  return { ...raw, cap, suit, rel, incoming, alias, points, trips, operators, ...(supersedes ? { supersedes } : {}) };
}

const worlds = new Map<string, World>();
const scopes = new Map<string, TripScope>();
const scopeOfWorld = new WeakMap<World, TripScope>();

/**
 * The joined world under `root`, cut to the trips that are built (above). A root with no sidecars (the privacy fixture) gives an empty
 * world. Every public module reads this one, never `loadWorld` itself.
 */
export function publicWorld(root: string): World {
  let w = worlds.get(root);
  if (!w) {
    const raw = loadWorld(root);
    const scope = scopeOver(raw, builtTripKeys(root));
    w = publicView(raw, scope);
    worlds.set(root, w);
    scopes.set(root, scope);
    scopeOfWorld.set(w, scope);
  }
  return w;
}

/** The trip scope under `root`: the manifest's built trips over the raw capture world. */
export function tripScope(root: string): TripScope {
  if (!scopes.has(root)) publicWorld(root);
  return scopes.get(root)!;
}

/** The scope a public world was cut with; null for a world that did not come from `publicWorld` (a test's own). */
export const scopeOf = (w: World): TripScope | null => scopeOfWorld.get(w) ?? null;

/** One item of data/relevance/derived/<trip>.json: only what the trip tags read. */
export interface DerivedItem {
  ref: string;
  role: 'anchor' | 'highlight' | 'filler' | 'local_only' | string;
  effective_draw: 'world' | 'national' | 'regional' | 'local' | string;
  badge: string | null;
}

const derived = new Map<string, DerivedItem[]>();

/** The derived relevance items of one trip (by public slug), or [] when the trip has none. */
export function derivedItems(root: string, tripSlug: string): DerivedItem[] {
  const key = `${root}|${tripSlug}`;
  let items = derived.get(key);
  if (!items) {
    const file = path.join(root, 'data', 'relevance', 'derived', `${tripSlug}.json`);
    const scope = tripScope(root);
    // a hidden trip has no derived items in public, and no item of a built trip is a hidden trip's record
    items = existsSync(file) && !scope.tripHidden(tripSlug) ? ((JSON.parse(readFileSync(file, 'utf8')) as { items?: DerivedItem[] }).items ?? []).filter((it) => !scope.isPrivate(it.ref)) : [];
    derived.set(key, items);
  }
  return items;
}

/** The type tree nodes with a legacy (kind, subkind) pair, to map a place that has no capture record to a type id. */
export interface TypeIndex {
  /** `kind/subkind` -> type id */
  byPair: Map<string, string>;
}

let typeIndex: { root: string; index: TypeIndex } | null = null;

export function publicTypes(root: string): TypeIndex {
  if (typeIndex?.root === root) return typeIndex.index;
  const file = path.join(root, 'data', 'vocab', 'types.json');
  const byPair = new Map<string, string>();
  if (existsSync(file)) {
    const doc = JSON.parse(readFileSync(file, 'utf8')) as { nodes: { id: string; legacy?: { kind: string; subkind?: string }[] }[] };
    for (const n of doc.nodes) for (const l of n.legacy ?? []) byPair.set(`${l.kind}/${l.subkind ?? ''}`, n.id);
  }
  typeIndex = { root, index: { byPair } };
  return typeIndex.index;
}

/** Labels of tags.json by id, so a tag chip says the same thing on a trip and on a place. */
export function tagLabels(root: string): Map<string, string> {
  const file = path.join(root, 'data', 'vocab', 'tags.json');
  const doc = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as { tags: { id: string; label: string }[] }) : { tags: [] };
  return new Map(doc.tags.map((t) => [t.id, t.label]));
}

/** One drive from a public hub (short-trips 4.1), as data/outings/from-hubs.json writes it. */
export interface FromHubRow {
  hub: 'toronto' | 'hamilton' | 'ottawa' | 'montreal';
  minutes: number;
  km: number;
  basis: 'routed' | 'estimate';
  fetched: string;
}

/**
 * `data/outings/from-hubs.json` (the hub matrix, lane L3e): `{ "trips": { "<trip slug>": FromHubRow[] } }`. The file does not exist
 * yet, so every trip answers []. A malformed row is skipped, never guessed.
 */
export function fromHubsOf(root: string, tripSlug: string): FromHubRow[] {
  const file = path.join(root, 'data', 'outings', 'from-hubs.json');
  if (!existsSync(file)) return [];
  const doc = JSON.parse(readFileSync(file, 'utf8')) as { trips?: Record<string, Partial<FromHubRow>[]> };
  return (doc.trips?.[tripSlug] ?? []).filter(
    (r): r is FromHubRow => typeof r.hub === 'string' && typeof r.minutes === 'number' && typeof r.km === 'number' && (r.basis === 'routed' || r.basis === 'estimate') && typeof r.fetched === 'string',
  );
}
