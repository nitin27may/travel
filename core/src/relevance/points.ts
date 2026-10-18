// Builds data/relevance/inputs/points.json (relevance-points/1) from coordinates the repository already holds.
// Pure: buildPoints takes plain data and returns the file plus a report; loadSources reads the files; no network.
//
// Order of trust per ref (a trail starts at its trailhead, anything else is the place itself):
//   trail kinds: snapshot OSM trailhead > locations.json > Wikidata P625 > snapshot OSM parking > snapshot approx
//   others:      locations.json > Wikidata P625 > snapshot OSM parking > snapshot approx
// Google is never a source. A point with no coordinate anywhere is left out and listed in the report.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadScope } from "../suitability/refs.ts";
import type { ScopeItem } from "../suitability/refs.ts";
import { loadRelevanceDocs } from "./inputs.ts";
import type { PointsFile } from "./inputs.ts";
import type { Town } from "./derive.ts";

export interface LocRow { id: string; name: string; lat: number | null; lon: number | null; resolver?: string; location_status?: string }
export interface SnapPlace { id: string; name: string; kind: string; lat: number; lng: number }
export interface SnapPoint { lat: number; lon: number; name?: string; point_source?: string }
export interface Snapshot {
  places: SnapPlace[];
  access: Record<string, { parking?: SnapPoint[]; trailhead?: SnapPoint }>;
  publicTrips: { id: string; season?: { label?: string }; days: { base?: string }[] }[];
  trip?: { days?: { baseTown?: string }[] };
}
export interface WdPoint { label: string | null; p625?: { lat: number; lon: number } | null }

export interface RefIn { ref: string; trip: string; class_key: string; qid: string | null; name: string | null; /** legacy trail datasets name the trailhead (text only) */ trailhead?: string | null }
export interface Sources {
  refs: RefIn[];
  scope: ScopeItem[];
  locations: LocRow[];
  snapshot: Snapshot | null;
  wikidata: Record<string, WdPoint>;
  /** data/relevance/inputs/bases.config.json: resolved base towns with their check notes */
  bases?: BaseConfig[];
}
export interface BaseConfig { trip: string; name: string; qid?: string; lat?: number; lon?: number; coord_src: "wikidata" | "nominatim"; country: string; admin: string; check: string; approximate?: boolean; approximate_note?: string }

export interface BuildReport {
  by_src: Record<string, number>;
  missing: string[];
  unresolved_bases: { trip: string; base: string }[];
  windows_missing: string[];
}

/** snapshot public trip id -> relevance trip folder */
export const SNAPSHOT_TRIP: Record<string, string> = {
  "p-dolomites": "dolomites-2027",
  "p-rockies": "canadian-rockies-2029",
  "p-iceland": "iceland-ring-road-2027",
  "p-patagonia": "patagonia-2027",
  "p-utah": "utah-five-parks",
  "p-algonquin": "algonquin-muskoka-2026",
  "p-vermont": "vermont-fall-2026",
  "p-chamonix": "chamonix-mont-blanc-2028",
};
/** Day bases that are the household's own town, never a catalogue base (relevance.md rule 7). */
const PRIVATE_BASES = new Set(["whitby"]);

const norm = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const r5 = (n: number): number => Math.round(n * 1e5) / 1e5;
const last = (id: string): string => id.split("/").pop() ?? id;
const TRAILISH = /^(trail|hike|walk|route)/;

/** Trip windows as the plans state them (CLAUDE.md "Current trips"; Utah has no dates yet, so none). */
export const TRIP_WINDOWS: Record<string, { from: string; to: string }> = {
  "dolomites-2027": { from: "07-13", to: "07-26" },
  "chamonix-mont-blanc-2028": { from: "09-01", to: "09-09" },
  "canadian-rockies-2029": { from: "09-08", to: "09-22" },
  "iceland-ring-road-2027": { from: "09-04", to: "09-15" },
  "patagonia-2027": { from: "02-26", to: "03-11" },
  "algonquin-muskoka-2026": { from: "10-10", to: "10-12" },
  "vermont-fall-2026": { from: "10-01", to: "10-04" },
};

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** "4 to 22 September" -> { from: "09-04", to: "09-22" }; anything vaguer gives null (no guessed windows). */
export function windowFromLabel(label: string | undefined): { from: string; to: string } | null {
  const m = /^(\d{1,2}) to (\d{1,2}) ([A-Za-z]+)$/.exec(label?.trim() ?? "");
  if (!m) return null;
  const mi = MONTHS.indexOf(m[3]!.toLowerCase());
  if (mi < 0) return null;
  const mm = String(mi + 1).padStart(2, "0");
  return { from: `${mm}-${m[1]!.padStart(2, "0")}`, to: `${mm}-${m[2]!.padStart(2, "0")}` };
}

type Pt = { lat: number; lon: number; coord_src: string; point_source?: string };

export function buildPoints(src: Sources, windows: Record<string, { from: string; to: string }> = TRIP_WINDOWS): { file: PointsFile; report: BuildReport } {
  const report: BuildReport = { by_src: {}, missing: [], unresolved_bases: [], windows_missing: [] };
  const scopeBy = new Map(src.scope.map((i) => [i.ref, i]));
  const locBy = new Map(src.locations.filter((l) => l.lat !== null && l.lon !== null && (l.resolver === "wikidata" || l.resolver === "nominatim") && l.location_status === "resolved").map((l) => [l.id, l]));
  const locByLast = new Map<string, LocRow[]>();
  for (const l of locBy.values()) locByLast.set(last(l.id), [...(locByLast.get(last(l.id)) ?? []), l]);
  const snapBy = new Map((src.snapshot?.places ?? []).map((p) => [p.id, p]));

  const fromLoc = (l: LocRow | undefined): Pt | null => (l ? { lat: r5(l.lat!), lon: r5(l.lon!), coord_src: l.resolver!, point_source: `locations.json ${l.id}` } : null);
  const fromSnapPoint = (p: SnapPoint | undefined, what: string): Pt | null => (p ? { lat: r5(p.lat), lon: r5(p.lon), coord_src: "osm", point_source: `${what}${p.point_source ? ` ${p.point_source}` : ""}` } : null);

  function locFor(r: RefIn, item: ScopeItem | undefined): LocRow | undefined {
    const sid = item?.source.locationId;
    if (sid && locBy.has(sid)) return locBy.get(sid);
    const m = /^(place|legacy)\/(.+)$/.exec(r.ref);
    if (!m) return undefined;
    const id = m[1] === "place" ? m[2]! : last(m[2]!);
    const hits = locByLast.get(id) ?? [];
    return hits.length === 1 ? hits[0] : undefined;
  }

  const points: PointsFile["points"] = {};
  for (const r of src.refs) {
    const item = scopeBy.get(r.ref);
    const proto = item?.source.protoId;
    const acc = proto ? src.snapshot?.access[proto] : undefined;
    const wd = r.qid ? src.wikidata[r.qid]?.p625 : null;
    const trailish = TRAILISH.test(r.class_key);
    const cands: (Pt | null)[] = [
      trailish ? fromSnapPoint(acc?.trailhead, `snapshot trailhead of ${proto}`) : null,
      fromLoc(locFor(r, item)),
      wd ? { lat: wd.lat, lon: wd.lon, coord_src: "wikidata", point_source: `${r.qid} P625` } : null,
      fromSnapPoint(acc?.parking?.[0], `snapshot parking of ${proto}`),
      proto && snapBy.get(proto) ? { lat: r5(snapBy.get(proto)!.lat), lon: r5(snapBy.get(proto)!.lng), coord_src: "prototype", point_source: `snapshot place ${proto} (approximate)` } : null,
    ];
    const hit = cands.find((c) => c !== null) ?? null;
    if (!hit) {
      report.missing.push(r.ref);
      continue;
    }
    points[r.ref] = { lat: hit.lat, lon: hit.lon, coord_src: hit.coord_src, ...(hit.point_source ? { point_source: hit.point_source } : {}) } as PointsFile["points"][string];
    report.by_src[hit.coord_src] = (report.by_src[hit.coord_src] ?? 0) + 1;
  }

  // A legacy trail that names its trailhead ("Moraine Lake", "Takakkaw Falls parking") starts where the sight of that
  // name is, when the same trip holds a point for it. The longest matching name wins.
  const named = src.refs.filter((r) => points[r.ref] && r.name && r.ref !== "" && !/^trail/.test(r.class_key) && norm(r.name).length >= 6);
  for (const r of src.refs) {
    if (points[r.ref] || !r.trailhead) continue;
    const th = norm(r.trailhead);
    const hit = named.filter((n) => n.trip === r.trip && (th === norm(n.name!) || th.startsWith(norm(n.name!) + " ") || th.endsWith(" " + norm(n.name!)))).sort((a, b) => norm(b.name!).length - norm(a.name!).length)[0];
    if (!hit) continue;
    const base = points[hit.ref]!;
    points[r.ref] = { lat: base.lat, lon: base.lon, coord_src: base.coord_src, point_source: `trailhead "${r.trailhead}" at ${hit.ref}` } as PointsFile["points"][string];
    report.by_src[base.coord_src] = (report.by_src[base.coord_src] ?? 0) + 1;
    report.missing = report.missing.filter((x) => x !== r.ref);
  }

  // ---- bases and towns with a stay ----
  const towns: Town[] = [];
  const trips: NonNullable<PointsFile["trips"]> = {};
  const byName = new Map<string, Pt & { name: string }>();
  const addName = (name: string | null | undefined, pt: Pt | null | undefined): void => {
    if (!name || !pt) return;
    const k = norm(name);
    if (!byName.has(k)) byName.set(k, { ...pt, name });
  };
  for (const l of locBy.values()) addName(l.name, fromLoc(l));
  for (const p of src.snapshot?.places ?? []) if (p.kind === "town") addName(p.name, { lat: r5(p.lat), lon: r5(p.lng), coord_src: "prototype", point_source: `snapshot place ${p.id} (approximate)` });
  for (const r of src.refs) if (/^town/.test(r.class_key) && points[r.ref] && r.name) addName(r.name, points[r.ref] as unknown as Pt);
  const configured = new Map<string, Pt & { name: string }>();
  for (const b of src.bases ?? []) {
    const p = b.qid ? src.wikidata[b.qid]?.p625 : b.lat !== undefined && b.lon !== undefined ? { lat: b.lat, lon: b.lon } : null;
    if (p) configured.set(`${b.trip}|${norm(b.name)}`, { name: b.name, lat: r5(p.lat), lon: r5(p.lon), coord_src: b.coord_src, point_source: `${b.qid ? `${b.qid} P625` : "Nominatim"}; ${b.country}, ${b.admin}${b.approximate ? ` (approximate: ${b.approximate_note ?? "centroid"})` : ""}`, ...(b.approximate ? { approximate: true } : {}) } as never);
  }
  for (const wd of Object.values(src.wikidata)) if (wd.label && wd.p625) addName(wd.label, { lat: wd.p625.lat, lon: wd.p625.lon, coord_src: "wikidata", point_source: "P625 by exact label" });

  const seenTown = new Set<string>();
  for (const pt of src.snapshot?.publicTrips ?? []) {
    const trip = SNAPSHOT_TRIP[pt.id];
    if (!trip) continue;
    const baseNames = [...new Set(pt.days.map((d) => d.base).filter((b): b is string => !!b))].map((b) => b.replace(/ area$/i, "")).filter((b) => !PRIVATE_BASES.has(norm(b)) && !/ to /.test(b));
    // the Dolomites days also name their base town as a snapshot place id
    const baseTowns = pt.id === "p-dolomites" ? [...new Set((src.snapshot?.trip?.days ?? []).map((d) => d.baseTown).filter((b): b is string => !!b))].map((id) => snapBy.get(id)?.name).filter((n): n is string => !!n) : [];
    const resolved: (Pt & { name: string })[] = [];
    for (const name of pt.id === "p-dolomites" ? baseTowns : baseNames) {
      const hit = configured.get(`${trip}|${norm(name)}`) ?? byName.get(norm(name));
      if (!hit) {
        report.unresolved_bases.push({ trip, base: name });
        continue;
      }
      resolved.push({ ...hit, name });
      const id = norm(name).replace(/ /g, "-");
      if (!seenTown.has(id)) {
        seenTown.add(id);
        towns.push({ id, name, lat: hit.lat, lon: hit.lon, has_stay: true, coord_src: hit.coord_src, ...((hit as { approximate?: boolean }).approximate ? { approximate: true } : {}) } as Town);
      }
    }
    const win = windows[trip] ?? windowFromLabel(pt.season?.label);
    if (!win) report.windows_missing.push(trip);
    trips[trip] = { ...(win ? { window: win } : {}), ...(resolved.length === 1 ? { base: { lat: resolved[0]!.lat, lon: resolved[0]!.lon } } : {}) };
  }
  towns.sort((a, b) => a.id.localeCompare(b.id));
  const sorted = Object.fromEntries(Object.entries(points).sort(([a], [b]) => a.localeCompare(b)));
  return { file: { schema: "relevance-points/1", points: sorted, towns, trips }, report };
}

const readJson = <T>(p: string): T | null => (existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : null);

export function loadSources(root: string): Sources {
  const docs = loadRelevanceDocs(root);
  const scope = loadScope(root);
  const names = new Map((scope?.items ?? []).map((i) => [i.ref, i.name]));
  const legacy = new Map<string, { trailhead?: string }[] & Record<string, never>>();
  const trailhead = (ref: string): string | null => {
    const m = /^legacy\/([^/]+)\/trails\/(.+)$/.exec(ref);
    if (!m) return null;
    const key = m[1]!;
    if (!legacy.has(key)) legacy.set(key, (readJson<never>(join(root, "legacy", key, "data", "trails.json")) ?? []) as never);
    const row = (legacy.get(key) as unknown as { id: string; trailhead?: string }[]).find((x) => x.id === m[2]);
    return row?.trailhead ?? null;
  };
  const refs: RefIn[] = docs.flatMap(({ doc }) =>
    doc.records.map((r) => ({ ref: r.ref, trip: doc.trip, class_key: r.class_key, qid: r.wikidata.state === "value" ? r.wikidata.v : null, name: names.get(r.ref) ?? null, trailhead: trailhead(r.ref) })),
  );
  const loc = readJson<{ places: { id: string; name: string; lat?: number; lon?: number; resolver?: string; location_status?: string }[] }>(join(root, "data", "locations", "locations.json"));
  const wd = readJson<{ items: Record<string, WdPoint> }>(join(root, "data", "relevance", "signals", "wikidata.json"));
  return {
    refs,
    scope: scope?.items ?? [],
    locations: (loc?.places ?? []).map((p) => ({ id: p.id, name: p.name, lat: p.lat ?? null, lon: p.lon ?? null, resolver: p.resolver, location_status: p.location_status })),
    snapshot: readJson<Snapshot>(join(root, "web", "data-snapshots", "prototype.json")),
    wikidata: wd?.items ?? {},
    bases: readJson<{ bases: BaseConfig[] }>(join(root, "data", "relevance", "inputs", "bases.config.json"))?.bases ?? [],
  };
}

export function pointsPath(root: string): string {
  return join(root, "data", "relevance", "inputs", "points.json");
}
