// Coverage (plan 0A.3): how well the catalog covers each area. Per type a score between 0 and 1, a weighted total, and a
// band. The targets and weights are PROVISIONAL: they were set before any region was imported. P4c measures two regions and
// the owner then adopts real ones; that changes this one object and nothing else.
import { ENTITIES } from "./common.ts";
import type { CatalogData, Deps, Entity, Locations, Row } from "./common.ts";
import { findIssues, staleRowKeys } from "./freshness.ts";

export type TypeKey = "sights" | "trails" | "activities" | "stays" | "eateries" | "legs" | "guide";

export interface Targets {
  types: Record<TypeKey, { target: number; weight: number }>;
  bands: { thin_below: number; good_from: number };
  row_weight: { fresh_verified: number; stale_verified: number; raw_or_proposed: number; retired: number };
  top_places: number;
  sight_kinds: string[];
  styles: Record<string, Record<TypeKey, number>>;
}

export const PROVISIONAL_TARGETS: Targets = {
  /** counts that fill a type, and the weight of the type in the total (plan 0A.3) */
  types: {
    sights: { target: 8, weight: 0.25 },
    trails: { target: 6, weight: 0.2 },
    activities: { target: 4, weight: 0.15 },
    stays: { target: 3, weight: 0.15 },
    eateries: { target: 3, weight: 0.05 },
    legs: { target: 1, weight: 0.1 },
    guide: { target: 1, weight: 0.1 },
  },
  bands: { thin_below: 0.4, good_from: 0.7 },
  /** what one row counts for */
  row_weight: { fresh_verified: 1.0, stale_verified: 0.5, raw_or_proposed: 0.3, retired: 0 },
  /** the legs type looks at the area's top places paired with its stays */
  top_places: 6,
  /** place kinds that count as sights */
  sight_kinds: ["viewpoint", "waterfall", "lake", "mountain", "park", "town", "city", "island", "beach", "canyon", "valley", "museum", "lighthouse", "drive", "place"],
  /** the same scores seen through a style: weights that sum to 1 */
  styles: {
    adventure: { sights: 0.1, trails: 0.35, activities: 0.3, stays: 0.1, eateries: 0.03, legs: 0.07, guide: 0.05 },
    "luxury-relax": { sights: 0.2, trails: 0.05, activities: 0.1, stays: 0.3, eateries: 0.2, legs: 0.05, guide: 0.1 },
  },
};
export type Band = "thin" | "usable" | "good";

export interface TypeScore {
  count: number;
  weighted: number;
  target: number;
  weight: number;
  score: number;
}

export interface AreaCoverage {
  area_id: string;
  level: "country" | "region" | "area";
  name: string;
  total: number;
  band: Band;
  types: Record<TypeKey, TypeScore>;
  by_style: Record<string, { total: number; band: Band }>;
  stale_prices: number;
  areas: number;
}

export const bandOf = (total: number, t = PROVISIONAL_TARGETS): Band => (total < t.bands.thin_below ? "thin" : total >= t.bands.good_from ? "good" : "usable");
const r3 = (v: number): number => Math.round(v * 1000) / 1000;

/** what a row counts for: fresh and verified 1.0, verified but stale 0.5, raw or proposed 0.3, retired 0 */
export function rowWeight(row: Row, stale: boolean, t = PROVISIONAL_TARGETS): number {
  const w = t.row_weight;
  switch (row.review_status) {
    case "retired": return w.retired;
    case "verified": return stale ? w.stale_verified : w.fresh_verified;
    case "stale": return row.field_meta?.stale?.was === "proposed" ? w.raw_or_proposed : w.stale_verified;
    default: return w.raw_or_proposed;
  }
}

export interface CoverageInput {
  data: CatalogData;
  deps: Deps;
  locations: Locations;
  /** places carry the common block in locations v3 */
  placeRows: Row[];
  today: string;
}

export function computeCoverage(inp: CoverageInput, t = PROVISIONAL_TARGETS): { as_of: string; targets: Targets; areas: AreaCoverage[] } {
  const { data, deps, locations, today } = inp;
  const issues = findIssues(data, deps, today);
  const staleKeys = staleRowKeys(issues, data);
  const isStale = (entity: Entity, id: string): boolean => staleKeys.has(`${entity}:${id}`);
  const areaIds = new Set<string>(locations.areas.map((a) => a.id));
  for (const e of ENTITIES) for (const r of data.rows(e)) if (r.area_id) areaIds.add(r.area_id);
  for (const p of inp.placeRows) areaIds.add(p.area_id);
  for (const r of data.rows("area_guides")) areaIds.add(r.id);

  const nameOf = new Map<string, string>(locations.areas.map((a) => [a.id, a.name]));
  const regionName = new Map<string, string>();
  const rawDoc = locations as unknown as { regions?: Row[]; countries?: Row[] };
  for (const r of rawDoc.regions ?? []) regionName.set(r.id, r.name);
  const countryName = new Map<string, string>();
  for (const c of rawDoc.countries ?? []) countryName.set(c.id ?? c.code, c.name);

  const offersBySubject = new Map<string, Row[]>();
  for (const o of data.rows("offers")) {
    if (o.review_status === "retired") continue;
    const k = `${o.subject_entity}:${o.subject_id}`;
    (offersBySubject.get(k) ?? offersBySubject.set(k, []).get(k)!).push(o);
  }
  const legPairs = new Set<string>();
  for (const l of data.rows("legs")) {
    if (l.review_status === "retired") continue;
    legPairs.add(`${l.from_id}|${l.to_id}`);
    legPairs.add(`${l.to_id}|${l.from_id}`);
  }

  const out: AreaCoverage[] = [];
  for (const areaId of [...areaIds].sort()) {
    const types = {} as Record<TypeKey, TypeScore>;
    const mk = (key: TypeKey, count: number, weighted: number): void => {
      const { target, weight } = t.types[key];
      types[key] = { count, weighted: r3(weighted), target, weight, score: r3(Math.min(1, weighted / target)) };
    };
    const places = inp.placeRows.filter((p) => p.area_id === areaId);
    const sights = places.filter((p) => t.sight_kinds.includes(p.kind));
    mk("sights", sights.filter((p) => p.review_status !== "retired").length, sights.reduce((n, p) => n + rowWeight(p, false, t), 0));
    const live = (e: Entity): Row[] => data.rows(e).filter((r) => r.area_id === areaId && r.review_status !== "retired");
    const trails = live("trails");
    mk("trails", trails.length, trails.reduce((n, r) => n + rowWeight(r, isStale("trails", r.id), t), 0));
    const acts = live("activities").filter((a) => (offersBySubject.get(`activity:${a.id}`) ?? []).length > 0);
    mk("activities", acts.length, acts.reduce((n, r) => n + rowWeight(r, isStale("activities", r.id), t), 0));
    const stays = live("stays");
    mk("stays", stays.length, stays.reduce((n, r) => n + rowWeight(r, isStale("stays", r.id), t), 0));
    const eats = live("eateries");
    mk("eateries", eats.length, eats.reduce((n, r) => n + rowWeight(r, isStale("eateries", r.id), t), 0));
    // legs: the area's top places paired with its stays; the share of pairs a leg covers
    const top = [...sights].filter((p) => p.review_status !== "retired").sort((a, b) => rowWeight(b, false, t) - rowWeight(a, false, t) || String(a.id).localeCompare(String(b.id))).slice(0, t.top_places);
    let pairs = 0;
    let covered = 0;
    for (const p of top) for (const s of stays) {
      pairs++;
      if (legPairs.has(`${p.id}|${s.id}`)) covered++;
    }
    mk("legs", covered, pairs === 0 ? 0 : covered / pairs);
    const guide = data.rows("area_guides").find((g) => g.id === areaId && g.review_status !== "retired");
    mk("guide", guide ? 1 : 0, guide ? rowWeight(guide, isStale("area_guides", guide.id), t) : 0);

    const total = r3((Object.keys(types) as TypeKey[]).reduce((n, k) => n + types[k].weight * types[k].score, 0));
    const by_style: AreaCoverage["by_style"] = {};
    for (const [style, w] of Object.entries(t.styles)) {
      const s = r3((Object.keys(types) as TypeKey[]).reduce((n, k) => n + (w[k] ?? 0) * types[k].score, 0));
      by_style[style] = { total: s, band: bandOf(s, t) };
    }
    const stale_prices = issues.filter((i) => i.entity === "offer_prices" && data.findRow("offers", String(i.id).split("#")[0]!)?.row.area_id === areaId).length;
    out.push({ area_id: areaId, level: "area", name: nameOf.get(areaId) ?? areaId, total, band: bandOf(total, t), types, by_style, stale_prices, areas: 1 });
  }

  // roll up: counts add, scores average over the areas below
  const roll = (level: "region" | "country", keyOf: (id: string) => string, nameFor: (k: string) => string): AreaCoverage[] => {
    const groups = new Map<string, AreaCoverage[]>();
    for (const a of out.filter((x) => x.level === "area")) {
      const k = keyOf(a.area_id);
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(a);
    }
    return [...groups].map(([k, kids]) => {
      const types = {} as Record<TypeKey, TypeScore>;
      for (const key of Object.keys(t.types) as TypeKey[]) {
        types[key] = {
          count: kids.reduce((n, a) => n + a.types[key].count, 0),
          weighted: r3(kids.reduce((n, a) => n + a.types[key].weighted, 0)),
          target: t.types[key].target * kids.length,
          weight: t.types[key].weight,
          score: r3(kids.reduce((n, a) => n + a.types[key].score, 0) / kids.length),
        };
      }
      const total = r3(kids.reduce((n, a) => n + a.total, 0) / kids.length);
      const by_style: AreaCoverage["by_style"] = {};
      for (const s of Object.keys(t.styles)) {
        const v = r3(kids.reduce((n, a) => n + a.by_style[s]!.total, 0) / kids.length);
        by_style[s] = { total: v, band: bandOf(v, t) };
      }
      return { area_id: k, level, name: nameFor(k), total, band: bandOf(total, t), types, by_style, stale_prices: kids.reduce((n, a) => n + a.stale_prices, 0), areas: kids.length };
    });
  };
  const regions = roll("region", (id) => id.split("/").slice(0, 2).join("/"), (k) => regionName.get(k) ?? k);
  const countries = roll("country", (id) => id.split("/")[0]!, (k) => countryName.get(k) ?? k);
  const rank = { country: 0, region: 1, area: 2 };
  const areas = [...countries, ...regions, ...out].sort((a, b) => rank[a.level] - rank[b.level] || a.area_id.localeCompare(b.area_id));
  return { as_of: today, targets: t, areas };
}

/** data/catalog/coverage.json: sorted, no clock, so the same inputs give the same bytes */
export function coverageText(c: ReturnType<typeof computeCoverage>): string {
  return JSON.stringify({ schema_version: 1, as_of: c.as_of, targets: c.targets, areas: c.areas }, null, 1) + "\n";
}
