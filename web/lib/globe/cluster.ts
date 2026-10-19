/**
 * Screen-space clustering (spec 6.5): after each camera move any two discs or pins whose centres are closer than the sum of
 * their radii plus 6 px merge into one disc with the summed count and the label of the highest-draw member (relevance 6.4).
 * Quiet dots (local places) merge on a 48 px grid. Pure: it works on projected positions, so it needs no map.
 */
export type DrawTier = 'world' | 'national' | 'regional' | 'local';
export const TIER_RANK: Record<DrawTier, number> = { local: 0, regional: 1, national: 2, world: 3 };

export interface ClusterItem {
  id: string;
  x: number;
  y: number;
  lng: number;
  lat: number;
  /** Radius in px of what is drawn: half a disc, 9 for a place dot, 13 for a trip pin. */
  r: number;
  count: number;
  label: string;
  tier: DrawTier;
  /** A local place drawn as a quiet dot: these merge on the 48 px grid. */
  quiet?: boolean;
}

export interface Cluster {
  id: string;
  /** Members in priority order: the first is the one whose label the cluster takes. */
  items: ClusterItem[];
  lng: number;
  lat: number;
  x: number;
  y: number;
  count: number;
  label: string;
  tier: DrawTier;
}

export const GAP_PX = 6;
export const QUIET_GRID_PX = 48;

/** Higher tier first, then the larger count, then the id (so the result never depends on input order). */
export const byPriority = (a: ClusterItem, b: ClusterItem): number =>
  TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.count - a.count || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const reach = (a: { r: number; quiet?: boolean }, b: { r: number; quiet?: boolean }): number =>
  a.quiet && b.quiet ? QUIET_GRID_PX : a.r + b.r + GAP_PX;

function fromItem(i: ClusterItem): Cluster {
  return { id: i.id, items: [i], lng: i.lng, lat: i.lat, x: i.x, y: i.y, count: i.count, label: i.label, tier: i.tier };
}

function merge(a: Cluster, b: Cluster): Cluster {
  const items = [...a.items, ...b.items].sort(byPriority);
  const n = a.count + b.count;
  const w = (k: 'x' | 'y' | 'lng' | 'lat') => (a[k] * a.count + b[k] * b.count) / n;
  const top = items[0];
  // lng is averaged on the shorter side of the antimeridian
  let lng = w('lng');
  if (Math.abs(a.lng - b.lng) > 180) lng = ((((a.lng * a.count + (b.lng + (a.lng > b.lng ? 360 : -360)) * b.count) / n) + 540) % 360) - 180;
  return { id: items.map((i) => i.id).sort().join('+'), items, lng, lat: w('lat'), x: w('x'), y: w('y'), count: n, label: top.label, tier: top.tier };
}

/**
 * Greedy merge to a fixed point. A cluster's radius is the largest member's, so a merged disc keeps the reach of its biggest part.
 * The result is the same whatever the input order.
 */
export function clusterItems(items: ClusterItem[]): Cluster[] {
  let cs = [...items].sort(byPriority).map(fromItem);
  const radius = (c: Cluster) => Math.max(...c.items.map((i) => i.r)) * (c.items.length > 1 ? 1.15 : 1);
  const quiet = (c: Cluster) => c.items.every((i) => i.quiet);
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    const out: Cluster[] = [];
    for (const c of cs) {
      const hit = out.findIndex((o) => Math.hypot(o.x - c.x, o.y - c.y) < reach({ r: radius(o), quiet: quiet(o) }, { r: radius(c), quiet: quiet(c) }));
      if (hit >= 0) { out[hit] = merge(out[hit], c); changed = true; } else out.push(c);
    }
    cs = out;
    if (!changed) break;
  }
  return cs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** True when a cluster is more than one item: it is drawn as a merged disc. */
export const isMerged = (c: Cluster): boolean => c.items.length > 1;

/** Overlap in px between two drawn discs, for the acceptance check (no two discs overlap by more than 6 px). */
export const overlapPx = (a: { x: number; y: number; r: number }, b: { x: number; y: number; r: number }): number => a.r + b.r - Math.hypot(a.x - b.x, a.y - b.y);
