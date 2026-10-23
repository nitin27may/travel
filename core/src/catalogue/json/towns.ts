// The towns layer of JsonStore (META-2; nearby spec 5.6; store.ts A33). Rows arrive from the source (data/reference/towns/**, written only by
// tools/towns.py from the GeoNames dump); this file turns them into the contract's `Town` and serves them EXACTLY as the dump has them:
// `publicTownLayer()` (core/src/privacy/towns.ts) runs on every row at load and builds the gazetteer the privacy detector accepts by
// identity. Nothing here names a town or knows where the household lives: a town is never special.
//
// What it answers: `towns()` (a centre and a radius, or a name prefix inside one region) and the `city=` filter of a list. `near`,
// `nearbyForPlace` and `globeCity` stay `not_available` until their own lanes (LST2c, PLC2b, GLB2b) fill them.
import type { TownRow } from "../../derive/townsData.ts";
import { publicTownLayer, type PublicGazetteer } from "../../privacy/towns.ts";
import * as S from "../../schema/api/index.ts";
import { compareByDistance, measure, within, type LatLon, type Measure } from "../distance.ts";
import { regionSlugOf, resolveRegion, kebab, type SlugRegistry } from "../slugs.ts";
import { compareCodePoints, sortKey } from "../sortKey.ts";

export type Outcome<T> = { ok: true; data: T } | { ok: false; error: S.ApiError };
const fail = <T>(code: S.ApiErrorCode, message: string, details?: Record<string, unknown>): Outcome<T> => ({ ok: false, error: { code, message, ...(details ? { details } : {}) } });

export const NO_TOWNS = "The towns layer is not loaded on this store, so towns, city filters and near mode are not available.";

/** A town of the layer before a query measures it. */
type Base = S.Town;

export class TownsLayer {
  /** What the privacy detector accepts by identity: the loaded rows, as served. */
  readonly gazetteer: PublicGazetteer;
  private readonly byId = new Map<string, Base>();
  private readonly all: Base[];
  private grid: Map<number, S.PlaceRow[]> | null = null;

  private readonly registry: SlugRegistry;
  private readonly placeRows: () => readonly S.PlaceRow[];

  constructor(rows: readonly TownRow[], registry: SlugRegistry, placeRows: () => readonly S.PlaceRow[]) {
    this.registry = registry;
    this.placeRows = placeRows;
    const base: Base[] = rows.map((r) => {
      const keys = r.admin1Name ? resolveRegion(registry, r.admin1Name, r.cc) : [];
      return { id: r.id, name: r.name, lat: r.lat, lon: r.lon, pop: r.pop, cc: r.cc, region: keys.length === 1 ? regionSlugOf(keys[0]!) : null, places: null, distanceKm: null, bearing: null };
    });
    const layer = publicTownLayer(base, []);
    this.all = layer.towns;
    this.gazetteer = layer.gazetteer;
    for (const t of this.all) if (!this.byId.has(t.id)) this.byId.set(t.id, t);
  }

  get size(): number {
    return this.byId.size;
  }

  town(id: string): Base | undefined {
    return this.byId.get(id);
  }

  // ---- places near a town ------------------------------------------------------------------------------------------------------

  /** The exact-point rows in whole-degree latitude buckets, so counting the places near one town reads three buckets, not the catalogue. */
  private buckets(): Map<number, S.PlaceRow[]> {
    if (!this.grid) {
      this.grid = new Map();
      for (const r of this.placeRows()) {
        if (r.lat === null || r.lon === null || r.approx) continue;
        const b = Math.floor(r.lat);
        this.grid.set(b, [...(this.grid.get(b) ?? []), r]);
      }
    }
    return this.grid;
  }

  /** Exact-point places within `r` km of a point (approximate points never count for a distance, T5). */
  placesWithin(p: LatLon, r: number): S.PlaceRow[] {
    const reach = Math.ceil(r / 100);
    const b = Math.floor(p.lat);
    const out: S.PlaceRow[] = [];
    for (let k = b - reach; k <= b + reach; k++) for (const row of this.buckets().get(k) ?? []) if (within(measure(p, { lat: row.lat!, lon: row.lon! }), r)) out.push(row);
    return out;
  }

  private served(t: Base, m?: Measure): S.Town {
    return { ...t, places: this.placesWithin(t, S.API_LIMITS.nearby.radius).length, distanceKm: m ? m.distanceKm : null, bearing: m ? m.bearing : null };
  }

  // ---- the city filter ----------------------------------------------------------------------------------------------------------

  /** The rows of a list within the nearby radius of the town (nearby spec 4.2); an unknown id is `not_found`. */
  cityRows<R extends { lat: number | null; lon: number | null; approx: boolean }>(rows: readonly R[], id: string): Outcome<R[]> {
    const t = this.byId.get(id);
    if (!t) return fail("not_found", "No town has that id.");
    return { ok: true, data: rows.filter((r) => r.lat !== null && r.lon !== null && !r.approx && within(measure(t, { lat: r.lat, lon: r.lon }), S.API_LIMITS.nearby.radius)) };
  }

  // ---- towns() -------------------------------------------------------------------------------------------------------------------

  private centre(near: string | undefined, city: string | undefined, place: (slug: string) => S.PlaceRow | undefined): Outcome<S.NearPage["centre"]> {
    if (city) {
      const t = this.byId.get(city);
      return t ? { ok: true, data: { kind: "town", key: city, name: t.name, lat: t.lat, lon: t.lon } } : fail("not_found", "No town has that id.");
    }
    if (!near) return fail("invalid_scope", "A near query needs a centre: `near` (place:<slug> or area:<id>) or `city` (a town id).");
    const at = near.indexOf(":");
    const [kind, id] = [near.slice(0, at), near.slice(at + 1)];
    if (kind === "place") {
      const r = place(id);
      if (!r || r.lat === null || r.lon === null) return fail("not_found", "No place with a point has that slug.");
      if (r.approx) return fail("not_found", "That place's point is approximate, so no distance can be measured from it.");
      return { ok: true, data: { kind: "place", key: near, name: r.name, lat: r.lat, lon: r.lon } };
    }
    const inArea = this.placeRows().filter((r) => r.lat !== null && r.lon !== null && !r.approx && (r.area === id || `${r.country.toLowerCase()}/${r.region}/${r.area}` === id));
    if (!inArea.length) return fail("not_found", "No area with an exact point has that id.");
    const lat = inArea.reduce((s, r) => s + r.lat!, 0) / inArea.length;
    const lon = inArea.reduce((s, r) => s + r.lon!, 0) / inArea.length;
    return { ok: true, data: { kind: "area", key: near, name: inArea[0]!.area_name, lat, lon } };
  }

  /** The radius rule (case K3): the default by centre kind, clamped to the max. */
  private radius(r: number | undefined, kind: "place" | "area" | "town"): { r: number; clamped: boolean } {
    const lim = S.API_LIMITS.nearRadius;
    const asked = r ?? (kind === "area" ? lim.areaDefault : lim.default);
    return asked > lim.max ? { r: lim.max, clamped: true } : { r: asked, clamped: false };
  }

  list(q: S.TownQuery, place: (slug: string) => S.PlaceRow | undefined): Outcome<S.TownList> {
    const cap = S.API_LIMITS.towns.max;
    if (q.prefix !== undefined) {
      if (!q.cc || !q.region) return fail("invalid_scope", "A town prefix needs a country (`cc`) and a region: towns load by region, never the world.");
      const keys = resolveRegion(this.registry, q.region, q.cc);
      if (!keys.length) return fail("not_found", "No region has that name or code.");
      const want = kebab(q.prefix);
      const hits = this.all
        .filter((t) => keys.includes(`${t.cc}/${t.region}`) && kebab(t.name).startsWith(want))
        .sort((a, b) => compareCodePoints(sortKey(a.name), sortKey(b.name)) || compareCodePoints(a.id, b.id));
      return { ok: true, data: { items: hits.slice(0, cap).map((t) => this.served(t)), truncated: hits.length > cap, clamped: false } };
    }
    if (!q.near && !q.city) return fail("invalid_scope", "Towns need a centre (`near` or `city`) or a prefix with a country and a region.");
    const c = this.centre(q.near, q.city, place);
    if (!c.ok) return c;
    const { r, clamped } = this.radius(q.r, c.data.kind);
    const hits = this.all
      .filter((t) => t.id !== q.city)
      .map((t) => ({ t, m: measure(c.data, t) }))
      .filter((x) => within(x.m, r))
      .map((x) => ({ ...x, distanceKm: x.m.distanceKm, name: x.t.name, ref: x.t.id }))
      .sort(compareByDistance);
    return { ok: true, data: { items: hits.slice(0, cap).map((x) => this.served(x.t, x.m)), truncated: hits.length > cap, clamped } };
  }
}
