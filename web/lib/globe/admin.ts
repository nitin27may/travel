import { bbox, centroid, inFeature, topoFeatures, type Feat, type FeatColl, type Pt, type Topology } from './geometry';

export type AdminLevel = 'adm1' | 'adm2';
type Manifest = Record<string, Partial<Record<AdminLevel, { file: string; n: number; source: string }>>>;

/** ISO 3 codes whose admin file is filed under the Natural Earth code (legacy NE_ALIAS). */
export const NE_ALIAS: Record<string, string> = { PSE: 'PSX', SSD: 'SDS', XKX: 'KOS' };

export const ADMIN_BASE = '/globe/admin/';
export const DATA_BASE = '/globe/data/';

export const slugify = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function manifestEntry(manifest: Manifest, a3: string, level: AdminLevel) {
  return manifest[a3]?.[level] ?? manifest[NE_ALIAS[a3]]?.[level] ?? null;
}

/** Turns a decoded admin topology into sorted features with a bbox, centroid and URL slug each. */
export function adminFeatures(topo: Topology): FeatColl {
  const fc = topoFeatures(topo, topo.objects[Object.keys(topo.objects)[0]]);
  fc.features = fc.features.filter((f) => f.geometry);
  fc.features.forEach((f) => {
    f.properties.name = (f.properties.name as string) || (f.properties.shapeName as string) || '?';
    f._bbox = bbox(f);
    f._c = centroid(f);
    f.properties.slug = slugify(String(f.properties.name));
  });
  fc.features.sort((a, b) => String(a.properties.name).localeCompare(String(b.properties.name)));
  fc.features.forEach((f, i) => { f.id = i; });
  return fc;
}

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

const cache = new Map<string, Promise<FeatColl | null>>();
let manifestPromise: Promise<Manifest> | null = null;

export function loadManifest(): Promise<Manifest> {
  return (manifestPromise ??= fetch(`${ADMIN_BASE}index.json`).then((r) => r.json() as Promise<Manifest>));
}

/** Lazy and cached. Resolves null when the country has no file for that level. */
export function loadAdmin(a3: string, level: AdminLevel): Promise<FeatColl | null> {
  const key = a3 + level;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = (async () => {
    const entry = manifestEntry(await loadManifest(), a3, level);
    if (!entry) return null;
    const res = await fetch(`${ADMIN_BASE}${entry.file}`);
    if (!res.ok) return null;
    return adminFeatures((await res.json()) as Topology);
  })().catch(() => { cache.delete(key); return null; });
  cache.set(key, p);
  return p;
}

export type { Feat };
