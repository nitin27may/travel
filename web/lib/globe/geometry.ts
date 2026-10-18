/**
 * Geometry for the globe, ported from legacy/globe/index.html: TopoJSON decode, bounding boxes that survive the
 * antimeridian, centroids and point-in-polygon with holes. Pure functions, no map and no DOM.
 */
export type Pt = [number, number];
export type Ring = Pt[];
export type Geom =
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] }
  | { type: 'GeometryCollection'; geometries: (Geom | null)[] };

export interface Feat<P = Record<string, unknown>> {
  type: 'Feature';
  id?: number | string;
  properties: P;
  geometry: Geom | null;
  /** [[west, south], [east, north]]; east can pass 180 for shapes that cross the antimeridian. */
  _bbox?: Bbox;
  _c?: Pt | null;
  /** Place ids counted into this shape by `tally`. */
  _pids?: string[];
}
export interface FeatColl<P = Record<string, unknown>> { type: 'FeatureCollection'; features: Feat<P>[] }
export type Bbox = [Pt, Pt];

interface TopoGeom { type: string; id?: number | string; properties?: Record<string, unknown>; arcs?: number[] | number[][] | number[][][]; geometries?: TopoGeom[] }
export interface Topology {
  transform?: { scale: Pt; translate: Pt };
  arcs: [number, number][][];
  objects: Record<string, { geometries: TopoGeom[] }>;
}

export function topoFeatures<P = Record<string, unknown>>(topo: Topology, obj: { geometries: TopoGeom[] }): FeatColl<P> {
  const { scale, translate } = topo.transform ?? { scale: [1, 1] as Pt, translate: [0, 0] as Pt };
  const arcs = topo.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]): Pt => { x += dx; y += dy; return [x * scale[0] + translate[0], y * scale[1] + translate[1]]; });
  });
  const ring = (idx: number[]): Ring => {
    const out: Ring = [];
    idx.forEach((i, k) => {
      let a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
      if (k > 0) a = a.slice(1);
      out.push(...a);
    });
    return out;
  };
  const geom = (g: TopoGeom | null | undefined): Geom | null => {
    if (!g) return null;
    if (g.type === 'Polygon') return { type: 'Polygon', coordinates: (g.arcs as number[][]).map(ring) };
    if (g.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: (g.arcs as number[][][]).map((p) => p.map(ring)) };
    if (g.type === 'GeometryCollection') return { type: 'GeometryCollection', geometries: (g.geometries ?? []).map(geom) };
    return null;
  };
  return { type: 'FeatureCollection', features: obj.geometries.map((g) => ({ type: 'Feature' as const, id: g.id, properties: (g.properties ?? {}) as P, geometry: geom(g) })) };
}

function eachPoint(f: Feat, cb: (p: Pt) => void): void {
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && Array.isArray(c[0])) (c as unknown[]).forEach(walk);
    else cb(c as Pt);
  };
  const g = f.geometry;
  if (!g) return;
  if (g.type === 'GeometryCollection') g.geometries.forEach((x) => x && x.type !== 'GeometryCollection' && walk(x.coordinates));
  else walk(g.coordinates);
}

/** Bounding box. A shape that straddles 180 degrees (Fiji, Russia) gets the narrower eastern span, so east can exceed 180. */
export function bbox(f: Feat): Bbox {
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180, minE = 360, maxE = 0;
  eachPoint(f, ([x, y]) => {
    minLat = Math.min(minLat, y); maxLat = Math.max(maxLat, y);
    minLon = Math.min(minLon, x); maxLon = Math.max(maxLon, x);
    const e = x < 0 ? x + 360 : x;
    minE = Math.min(minE, e); maxE = Math.max(maxE, e);
  });
  if (maxLon - minLon > 180 && maxE - minE < maxLon - minLon) return [[minE > 180 ? minE - 360 : minE, minLat], [maxE, maxLat]];
  return [[minLon, minLat], [maxLon, maxLat]];
}

/** Mean of the outer ring of the biggest polygon: good enough to anchor a label. */
export function centroid(f: Feat): Pt | null {
  const g = f.geometry;
  if (!g) return null;
  const ring: Ring | null = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates.reduce((a, b) => (a[0].length > b[0].length ? a : b))[0] : null;
  if (!ring?.length) return null;
  let x = 0, y = 0;
  for (const [px, py] of ring) { x += px; y += py; }
  return [x / ring.length, y / ring.length];
}

export function inRing(ring: Ring, [x, y]: Pt): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Inside a polygon's outer ring and outside every hole. */
export function inFeature(f: Feat, pt: Pt): boolean {
  const g = f.geometry;
  if (!g) return false;
  const polys: Ring[][] = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  return polys.some((p) => inRing(p[0], pt) && !p.slice(1).some((h) => inRing(h, pt)));
}

/** Box test that also matches a point written 360 degrees away (a box whose east passes 180). */
export function inBox(b: Bbox, [x, y]: Pt): boolean {
  return y >= b[0][1] && y <= b[1][1] && [x, x + 360, x - 360].some((v) => v >= b[0][0] && v <= b[1][0]);
}

export const locate = (fc: FeatColl, pt: Pt): Feat | undefined => fc.features.find((f) => f._bbox && inBox(f._bbox, pt) && inFeature(f, pt));

export interface Located { id: string; lon: number | null; lat: number | null }

/**
 * Counts each located item into the shape that contains it. Counts go into `properties.n` (properties survive
 * into rendered features; ad-hoc fields do not) and the ids stay JS-side in `_pids`. Returns the items no shape holds.
 */
export function tally(fc: FeatColl, list: Located[]): Located[] {
  fc.features.forEach((f) => { f.properties.n = 0; f._pids = []; });
  const outside: Located[] = [];
  for (const p of list) {
    if (p.lon == null || p.lat == null) continue;
    const f = locate(fc, [p.lon, p.lat]);
    if (f) { (f.properties.n as number) += 1; f._pids!.push(p.id); } else outside.push(p);
  }
  return outside;
}

/** Width of a box in degrees of longitude, counting the wrap. */
export const spanLon = (b: Bbox): number => b[1][0] - b[0][0];
export const centreOf = (b: Bbox): Pt => [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];

/** Box around a set of points (no wrap handling needed: a node's places sit near each other). */
export function boxOfPoints(pts: Pt[]): Bbox | null {
  if (!pts.length) return null;
  let w = 180, e = -180, s = 90, n = -90;
  for (const [x, y] of pts) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
  return [[w, s], [e, n]];
}

/**
 * Hit priority of a named basemap feature at a zoom (spec 4.1): lower wins, `null` means "not a target here". Below zoom 5
 * parks are not targets and rivers rank last; towns below rank 4 wait until zoom 7.
 */
export function hitRank(zoom: number, sourceLayer: string, props: { class?: unknown; rank?: unknown } = {}): number | null {
  if (sourceLayer === 'park' && zoom < 5) return null;
  if (sourceLayer === 'place' && zoom < 7 && Number(props.rank ?? 9) > 4 && !['country', 'state', 'city'].includes(String(props.class))) return null;
  const far: Record<string, number> = { mountain_peak: 0, place: 0, water_name: 1, waterway: 2 };
  const near: Record<string, number> = { mountain_peak: 0, place: 1, water_name: 2, waterway: 3, park: 4 };
  return (zoom < 5 ? far : near)[sourceLayer] ?? 9;
}
