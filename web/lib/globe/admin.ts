import { globeAdmin, type GlobeAdminLevel } from '@/lib/client/data';
import { adminInWorker } from './geoClient';
import type { AdminResult, PlacePoint } from './geoWork';
import { inFeature, type Feat, type FeatColl, type Pt, type Topology } from './geometry';

export type AdminLevel = GlobeAdminLevel;

export { adminFeatures, slugify } from './geoWork';
import { slugify } from './geoWork';

/**
 * Finds the admin shape a URL slug names. LD's slugs come from our own place data ("south-tyrol"), the shapes from
 * Natural Earth and geoBoundaries ("Bolzano"), so a name match comes first, then a looser one, then the shape that
 * holds most of the points we have under that slug.
 */
export function resolveFeature(fc: FeatColl, slug: string, points: Pt[] = []): number | null {
  const s = slugify(slug);
  const exact = fc.features.find((f) => f.properties.slug === s);
  if (exact) return exact.id as number;
  const loose = fc.features.filter((f) => {
    const n = String(f.properties.slug);
    return n.length > 3 && s.length > 3 && (n.includes(s) || s.includes(n));
  });
  if (loose.length === 1) return loose[0].id as number;
  if (points.length) {
    const hits = new Map<number, number>();
    for (const p of points) {
      const f = fc.features.find((x) => x._bbox && inFeature(x, p));
      if (f) hits.set(f.id as number, (hits.get(f.id as number) ?? 0) + 1);
    }
    const best = [...hits].sort((a, b) => b[1] - a[1])[0];
    if (best) return best[0];
  }
  return loose[0] ? (loose[0].id as number) : null;
}

export interface LoadedAdmin extends AdminResult { fc: FeatColl }

const cache = new Map<string, Promise<LoadedAdmin | null>>();

/**
 * Lazy and cached: the file (through the data module), then the shapes, the counts of our places and the drawn GeoJSON, in a worker.
 * Resolves null when the country has no file for that level. `within` keeps the districts inside one state.
 */
export function loadAdmin(a3: string, level: AdminLevel, o: { part?: string; pins?: PlacePoint[]; within?: Feat | null } = {}): Promise<LoadedAdmin | null> {
  const key = `${a3}${level}${o.part ?? ''}${o.within ? `#${String(o.within.properties.slug ?? o.within.id)}` : ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = globeAdmin(a3, level, o.part)
    .then((topo) => (topo ? adminInWorker({ topo: topo as Topology, pins: o.pins ?? [], within: o.within ?? null }) : null))
    .catch(() => { cache.delete(key); return null; });
  cache.set(key, p);
  return p;
}

export type { Feat };
