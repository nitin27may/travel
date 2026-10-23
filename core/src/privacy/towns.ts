// THE TOWNS LAYER AND PRIVACY (store.ts A33; owner ruling 23 Oct 2026, Q87 reopened and FINAL). Every town is shown EXACTLY as the public
// gazetteer (GeoNames for points, OSM for outlines) has it: nothing moved, nothing dropped, nothing flagged. The household's location
// stays private because the site never publishes a point of the household's, not because it distorts public ones. A towns layer that
// moved or dropped the one town near home would itself say where home is: a diff against the free GeoNames and OSM files shows the
// changed town (review API3-R-3).
//
// So this file holds no rule that depends on where home is. It holds:
//   - `safeTown` and `safeOutline`: the identity under TOWN_POLICY "public" (the names stay because the loaders call them, A18);
//   - `publicGazetteer`: the loaded public points and outline vertices, by town id, which the privacy detector (detect.ts) uses to
//     accept a town's point or outline vertex inside the household radius ONLY when it equals the gazetteer's own value for that id,
//     exactly (the numbers as the gazetteer file holds them). Any other point within the radius still fails closed: a place, a
//     planted point under a town id, a moved centre, an id the gazetteer does not hold;
//   - `publicTownLayer`: the one call a towns loader makes (stub now, JsonStore and SupabaseStore with META-2), giving the layer and
//     its gazetteer from the same rows;
//   - `safeLine` and `lineClearOfHome`: route LINES (trip legs, A34), which are not public gazetteer data, keep the old refusal: a leg
//     with a vertex within the radius is served with no geometry (open item API3-R-5 is about that).
// This file names no town and holds no coordinate (core/test/privacy/towns.test.ts greps it).
import { decodePolyline5, POLYLINE5_RE } from "../schema/api/legs.ts";
import { nearHome } from "./home.ts";

/**
 * How the towns layer treats a town whose public centre lies within the household radius.
 *   - `"public"` (the default, owner ruling Q87 23 Oct): served exactly as the gazetteer has it, like every other town.
 *   - `"exclude"`: the town is left out, so `city=<its id>` answers `not_found`. This is a PRODUCT switch, not a privacy one: the
 *     missing town is an obvious diff against GeoNames and says "home is within the radius of this town's centre" (review API3-R-3).
 */
export type TownPolicy = "public" | "exclude";

export const TOWN_POLICY: TownPolicy = "public";

export interface TownPoint {
  lat: number;
  lon: number;
}

/** The centre to serve for a town: its public point unchanged, or null when TOWN_POLICY is `"exclude"` and the centre is within the radius. */
export function safeTown(t: TownPoint, policy: TownPolicy = TOWN_POLICY): TownPoint | null {
  if (policy === "exclude" && nearHome(t.lat, t.lon)) return null;
  return { lat: t.lat, lon: t.lon };
}

/** A town's outline to serve: the public geometry unchanged (a town OSM has no polygon for is null and keeps the ring). */
export function safeOutline<G>(g: G | null): G | null {
  return g;
}

// ---- the loaded public gazetteer ------------------------------------------------------------------------------------------------

/** One gazetteer row as the loader read it from the public file. */
export interface GazetteerTown {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

/** One public outline (OSM) by town id, as the loader read it. */
export interface GazetteerOutline {
  id: string;
  geometry: unknown;
}

/** What the detector asks of the loaded gazetteer. Exact equality only: a value it did not load is never public. */
export interface PublicGazetteer {
  /** how many towns were loaded */
  readonly size: number;
  /** the town id is a row of the loaded gazetteer */
  has(id: string): boolean;
  /** the gazetteer's name for the id */
  name(id: string): string | undefined;
  /** `lat` and `lon` are exactly the gazetteer point of `id` */
  isPoint(id: string, lat: number, lon: number): boolean;
  /** the pair, in the order served, is exactly a vertex of the gazetteer outline of `id` */
  isVertex(id: string, a: number, b: number): boolean;
}

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const pairKey = (a: number, b: number): string => `${a},${b}`;

/** Every numeric pair of a GeoJSON-style geometry (any depth, an optional height), as served. */
function vertices(g: unknown, out: Set<string>): Set<string> {
  if (Array.isArray(g)) {
    if ((g.length === 2 || g.length === 3) && isNum(g[0]) && isNum(g[1])) out.add(pairKey(g[0], g[1]));
    else for (const x of g) vertices(x, out);
  } else if (g && typeof g === "object") for (const x of Object.values(g)) vertices(x, out);
  return out;
}

/** The gazetteer from the rows a loader read (a duplicate id keeps its first row, as the layer does). */
export function publicGazetteer(towns: readonly GazetteerTown[], outlines: readonly GazetteerOutline[] = []): PublicGazetteer {
  const rows = new Map<string, GazetteerTown>();
  for (const t of towns) if (!rows.has(t.id)) rows.set(t.id, t);
  const outline = new Map<string, Set<string>>();
  for (const o of outlines) if (rows.has(o.id) && o.geometry !== null && o.geometry !== undefined) vertices(o.geometry, outline.get(o.id) ?? outline.set(o.id, new Set()).get(o.id)!);
  return {
    size: rows.size,
    has: (id) => rows.has(id),
    name: (id) => rows.get(id)?.name,
    isPoint: (id, lat, lon) => {
      const t = rows.get(id);
      return !!t && t.lat === lat && t.lon === lon;
    },
    isVertex: (id, a, b) => outline.get(id)?.has(pairKey(a, b)) ?? false,
  };
}

/**
 * The towns layer a store serves, its outlines and their gazetteer, from the public rows as loaded: towns through `safeTown`, outlines
 * through `safeOutline` (both the identity under "public"), an outline only for a served town. The gazetteer is built from the same
 * rows, so what is served and what the detector accepts cannot drift; a loader that changed a point after this call fails closed.
 */
export function publicTownLayer<T extends GazetteerTown, C extends GazetteerOutline>(towns: readonly T[], outlines: readonly C[], policy: TownPolicy = TOWN_POLICY): { towns: T[]; outlines: C[]; gazetteer: PublicGazetteer } {
  const served = towns.flatMap((t) => (safeTown(t, policy) ? [t] : []));
  const ids = new Set(served.map((t) => t.id));
  const shown = outlines.filter((o) => ids.has(o.id)).map((o) => ({ ...o, geometry: safeOutline(o.geometry) }));
  return { towns: served, outlines: shown, gazetteer: publicGazetteer(served, shown) };
}

/** A store that holds a towns layer says which gazetteer it loaded, so respond() and the contract kit run the detector with it. */
export interface PublicTownsHolder {
  publicTowns(): PublicGazetteer | null | Promise<PublicGazetteer | null>;
}

/** The gazetteer a store loaded, or null (no towns layer: the detector then accepts no point within the radius at all). */
export async function gazetteerOf(store: unknown): Promise<PublicGazetteer | null> {
  const h = store as Partial<PublicTownsHolder> | null;
  return h && typeof h.publicTowns === "function" ? ((await h.publicTowns()) ?? null) : null;
}

// ---- route lines (A34): not gazetteer data -------------------------------------------------------------------------------------

/** The detector's own test (detect.ts): a pair is near home in either axis order. */
const pairNear = (a: number, b: number): boolean => nearHome(a, b) || nearHome(b, a);

/**
 * True when no coordinate of a line lies within the household radius. Reads GeoJSON-style nested coordinate arrays (any depth, either
 * axis order, an optional height), `{lat, lon}` objects, and encoded polylines (a string of polyline characters).
 */
export function lineClearOfHome(g: unknown): boolean {
  if (g === null || g === undefined) return true;
  if (typeof g === "string") {
    if (!POLYLINE5_RE.test(g)) return true;
    const pts = decodePolyline5(g);
    return !pts || !pts.some(([x, y]) => pairNear(x, y));
  }
  if (Array.isArray(g)) {
    if ((g.length === 2 || g.length === 3) && isNum(g[0]) && isNum(g[1])) return !pairNear(g[0], g[1]);
    return g.every(lineClearOfHome);
  }
  if (typeof g === "object") {
    const o = g as Record<string, unknown>;
    if (isNum(o.lat) && isNum(o.lon) && nearHome(o.lat, o.lon)) return false;
    return Object.values(o).every(lineClearOfHome);
  }
  return true;
}

/** A route line to serve: the line itself when `lineClearOfHome` holds, else null (the leg is drawn as a dashed estimate). */
export function safeLine<G>(g: G | null): G | null {
  return g !== null && lineClearOfHome(g) ? g : null;
}
