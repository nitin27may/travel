// One memoised read of the capture, suitability and relevance sidecars for the whole adapter (list part). The place bands and the
// trip tags both come through here, so the join runs once per build. Server only (reads files); never import it from a client file.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadWorld } from '@travel/core/capture/records.ts';
import type { World } from '@travel/core/capture/records.ts';

const worlds = new Map<string, World>();

/** The joined world under `root`. A root with no sidecars (the privacy fixture) gives an empty world. */
export function publicWorld(root: string): World {
  let w = worlds.get(root);
  if (!w) worlds.set(root, (w = loadWorld(root)));
  return w;
}

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
    items = existsSync(file) ? ((JSON.parse(readFileSync(file, 'utf8')) as { items?: DerivedItem[] }).items ?? []) : [];
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
