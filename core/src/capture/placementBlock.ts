// The placement block (META-0, capture contract 3.7; nearby spec 3.1 to 3.4): the area chain, the sourced point with its role and the
// nearest town, checked per record. Pure over plain inputs once loaded; `loadPlacement` reads the files. Offline.
//
// Not to be confused with data/capture/placement.json (`capture-placement/1`, where facts sit between layers; placement.ts).
//
// Read order of a point (the one META-1 gives JsonStore): data/capture/points.json, then data/relevance/inputs/points.json, by ref, then
// by any alias of the ref. A route with no point of its own reads the point of its `starts_at` (that point is the trailhead).
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { AREA_DERIVATION } from "../config/area.ts";
import { POINT_ROLE } from "../schema/enums.ts";
import { capturePointsFile, CAPTURE_POINTS_SCHEMA_ID, NEAR_TOWN_NONE, relevancePointRow } from "../schema/capture/points.ts";
import type { PointRole } from "../schema/capture/points.ts";
import type { CaptureRecord } from "../schema/capture/records.ts";
import { haversineKm } from "../geo/distance.ts";
import { readJson } from "./records.ts";
import type { World } from "./records.ts";

/** The thresholds of the placement rule, in one place (CONS: no threshold typed twice). */
export const PLACEMENT_RULES = {
  /** E_PLACE_FAR: a point this far outside the bounding box of its area is a wrong area or a swapped lat and lon */
  farKm: 25,
  /** the area's box is judged only when this many reference points define it; fewer cannot tell a big park from a wrong area */
  minBoxPoints: 2,
  /** near_town: the nearest settlement of at least this many people within the radius, else NEAR_TOWN_NONE (META-2) */
  townRadiusKm: 50,
  townMinPopulation: 1000,
} as const;

/** The keys the placement codes report; the tier check leaves them to those codes so nothing is counted twice. */
export const PLACEMENT_KEYS = ["area_id", "point", "near_town", "near_town_km"] as const;

/** The placement codes, in report order. */
export const PLACEMENT_CODES = ["E_PLACE_AREA", "E_PLACE_ORPHAN", "W_PLACE_POINT", "W_PLACE_APPROX", "E_PLACE_FAR", "W_PLACE_TOWN"] as const;
export type PlacementCode = (typeof PLACEMENT_CODES)[number];

export interface PointRow {
  lat: number;
  lon: number;
  coord_src: string;
  point_source?: string;
  point_role?: PointRole;
  approx?: boolean;
  approx_note?: string;
  /** which sidecar held it */
  from: "capture" | "relevance";
}

export interface Box { minLat: number; maxLat: number; minLon: number; maxLon: number; n: number }

export interface AreaTree {
  /** every country, region and area id of the locations store */
  ids: Set<string>;
  /** area or region id -> the box of the locations-store places in it (an area's places also widen its region) */
  boxes: Map<string, Box>;
  /** locations place id -> its area id (to leave a record's own place out of the box that judges it) */
  placeArea: Map<string, string>;
  placePoint: Map<string, { lat: number; lon: number }>;
}

export interface PointsIssue { file: string; path: string; message: string }

export interface PlacementWorld {
  world: World;
  points: Map<string, PointRow>;
  tree: AreaTree;
  /** structural faults of data/capture/points.json (the read side of the relevance sidecar is its own checker's) */
  pointsIssues: PointsIssue[];
  /** the towns layer exists (META-2: data/reference/towns/<cc>.json), so near_town can be derived */
  townsLayer: boolean;
}

export const CAPTURE_POINTS_PATH = "data/capture/points.json";
export const RELEVANCE_POINTS_PATH = "data/relevance/inputs/points.json";
export const TOWNS_DIR = "data/reference/towns";

type Row = Record<string, unknown>;

/** The locations store's countries, regions, areas and places, parts merged for the by-country layout. */
function loadAreaTree(root: string): AreaTree {
  const dir = join(root, "data", "locations");
  const store = readJson<Row>(join(dir, "locations.json")) ?? {};
  const list = (k: string): Row[] => {
    const own = Array.isArray(store[k]) ? (store[k] as Row[]) : [];
    if (store.layout !== "by-country" || !Array.isArray(store.parts)) return own;
    return [...own, ...(store.parts as string[]).flatMap((cc) => {
      const part = readJson<Row>(join(dir, `${cc}.json`));
      return part && Array.isArray(part[k]) ? (part[k] as Row[]) : [];
    })];
  };
  const ids = new Set<string>();
  const regionOf = new Map<string, string>();
  for (const c of list("countries")) if (typeof c.code === "string") ids.add(c.code);
  for (const r of list("regions")) if (typeof r.id === "string") ids.add(r.id);
  for (const a of list("areas")) {
    if (typeof a.id !== "string") continue;
    ids.add(a.id);
    if (typeof a.region_id === "string") regionOf.set(a.id, a.region_id);
  }
  const boxes = new Map<string, Box>();
  const placeArea = new Map<string, string>();
  const placePoint = new Map<string, { lat: number; lon: number }>();
  const widen = (id: string, lat: number, lon: number): void => {
    const b = boxes.get(id);
    if (!b) boxes.set(id, { minLat: lat, maxLat: lat, minLon: lon, maxLon: lon, n: 1 });
    else boxes.set(id, { minLat: Math.min(b.minLat, lat), maxLat: Math.max(b.maxLat, lat), minLon: Math.min(b.minLon, lon), maxLon: Math.max(b.maxLon, lon), n: b.n + 1 });
  };
  for (const p of list("places")) {
    if (typeof p.id !== "string" || typeof p.area_id !== "string") continue;
    placeArea.set(p.id, p.area_id);
    if (typeof p.lat !== "number" || typeof p.lon !== "number") continue;
    placePoint.set(p.id, { lat: p.lat, lon: p.lon });
    widen(p.area_id, p.lat, p.lon);
    const region = regionOf.get(p.area_id);
    if (region) widen(region, p.lat, p.lon);
  }
  return { ids, boxes, placeArea, placePoint };
}

/** Reads both points sidecars into one map, capture rows first (they win), and reports structural faults of the capture file. */
export function loadPoints(root: string): { points: Map<string, PointRow>; issues: PointsIssue[] } {
  const points = new Map<string, PointRow>();
  const issues: PointsIssue[] = [];
  const cap = readJson<unknown>(join(root, CAPTURE_POINTS_PATH));
  if (cap !== null) {
    const parsed = capturePointsFile.safeParse(cap);
    if (!parsed.success) {
      for (const i of parsed.error.issues.slice(0, 20)) {
        issues.push({ file: CAPTURE_POINTS_PATH, path: "/" + i.path.join("/"), message: `${i.message}. A row is {"lat": 51.1, "lon": -115.5, "coord_src": "osm", "point_source": "OSM node 123 ...", "point_role": "trailhead"}; schema "${CAPTURE_POINTS_SCHEMA_ID}"; point_role is one of ${POINT_ROLE.join(", ")}.` });
      }
    }
    // read every row that parses on its own, so one bad row does not hide the others' points
    const rows = cap && typeof cap === "object" && "points" in cap ? ((cap as { points: unknown }).points as Row) : {};
    for (const [ref, raw] of Object.entries(rows && typeof rows === "object" ? rows : {})) {
      const r = relevancePointRow.safeParse(raw);
      if (r.success) points.set(ref, { ...(r.data as Omit<PointRow, "from">), from: "capture" });
    }
  }
  const rel = readJson<{ points?: Row }>(join(root, RELEVANCE_POINTS_PATH));
  for (const [ref, raw] of Object.entries(rel?.points ?? {})) {
    if (points.has(ref)) continue;
    const r = relevancePointRow.safeParse(raw);
    if (r.success) points.set(ref, { ...(r.data as Omit<PointRow, "from">), from: "relevance" });
  }
  return { points, issues };
}

export function hasTownsLayer(root: string): boolean {
  const dir = join(root, TOWNS_DIR);
  return existsSync(dir) && readdirSync(dir).some((f) => f.endsWith(".json"));
}

export function loadPlacement(root: string, world: World): PlacementWorld {
  const { points, issues } = loadPoints(root);
  return { world, points, tree: loadAreaTree(root), pointsIssues: issues, townsLayer: hasTownsLayer(root) };
}

/** The point of a ref: its own row, then the row of the primary ref or of an alias. */
export function ownPointOf(pw: PlacementWorld, ref: string): PointRow | null {
  const direct = pw.points.get(ref);
  if (direct) return direct;
  const primary = pw.world.alias.get(ref) ?? ref;
  if (pw.points.has(primary)) return pw.points.get(primary)!;
  const rec = pw.world.cap.get(primary)?.rec;
  for (const a of rec?.aliases ?? []) if (pw.points.has(a)) return pw.points.get(a)!;
  return null;
}

const derivable = new WeakMap<World, { points: Map<string, PointRow>; towns: boolean }>();

/**
 * Whether `near_town` can be derived for a record: the towns layer exists and the record has a point that is not approximate (its own, or
 * a route's start). The `derived` trigger of the registry reads it, so the property is required exactly where the derive step has an input.
 */
export function canDeriveNearTown(world: World, rec: CaptureRecord): boolean {
  let c = derivable.get(world);
  if (!c) derivable.set(world, (c = { points: loadPoints(world.root).points, towns: hasTownsLayer(world.root) }));
  if (!c.towns || (rec.layer !== "place" && rec.layer !== "route")) return false;
  const hit = pointOf({ world, points: c.points } as PlacementWorld, rec);
  return !!hit && !hit.point.approx;
}

/** The point a record is placed by: its own, or (a route) the point of where it starts. */
export function pointOf(pw: PlacementWorld, rec: CaptureRecord): { point: PointRow; via: string | null } | null {
  const own = ownPointOf(pw, rec.ref);
  if (own) return { point: own, via: null };
  if (rec.layer === "route") for (const s of rec.starts_at ?? []) {
    const p = ownPointOf(pw, s);
    if (p) return { point: p, via: s };
  }
  return null;
}

/** The role a point of this type stands for when the row names none (nearby spec 3.3: a trail asks for the trailhead, a lift for its lower station). */
export function defaultPointRole(type: string, layer: string): PointRole {
  if (layer === "offer" || layer === "event") return "meeting";
  if (layer === "route") return /^(nature\.(trail|trek)|mountain\.ferrata)(\.|$)/.test(type) ? "trailhead" : "route_start";
  if (/^nature\.summit(\.|$)/.test(type)) return "summit";
  if (/^access\.park(\.|$)/.test(type)) return "parking";
  if (/^access\.start(\.|$)/.test(type)) return "trailhead";
  if (/^(culture\.(museum|heritage|under)|play\.(amusement|adventure|farm)|animals\.(see|farm))(\.|$)/.test(type)) return "entrance";
  return "centre";
}

/** Where to look for a missing point, for the gap report and the messages. */
export function pointHint(pw: PlacementWorld, rec: CaptureRecord): string {
  const role = defaultPointRole(rec.type, rec.layer);
  const qid = pw.world.rel.get(rec.ref)?.rec.wikidata;
  const hasQid = !!qid && typeof qid === "object" && (qid as { state?: string }).state === "value";
  if (role === "trailhead") return "track start (data/tracks) or the OSM trailhead node";
  if (hasQid) return "Wikidata P625 of the linked QID, then OSM";
  return "OSM node or way, then the land manager's page (Wikidata QID not linked yet)";
}

/** The kilometres from a point to the nearest edge of a box (0 inside it). */
export function kmOutside(b: Box, lat: number, lon: number): number {
  const cLat = Math.min(Math.max(lat, b.minLat), b.maxLat);
  const cLon = Math.min(Math.max(lon, b.minLon), b.maxLon);
  return cLat === lat && cLon === lon ? 0 : haversineKm({ lat, lon }, { lat: cLat, lon: cLon });
}

/** The box that judges a record's area: the area's own reference points, without the record's own place when it is one of them. */
function boxFor(pw: PlacementWorld, areaId: string, ref: string): Box | null {
  const b = pw.tree.boxes.get(areaId);
  if (!b) return null;
  const own = /^place\/(.+)$/.exec(ref)?.[1];
  if (!own || pw.tree.placeArea.get(own) !== areaId || !pw.tree.placePoint.has(own)) return b;
  // rebuild without the record's own place
  let out: Box | null = null;
  for (const [id, a] of pw.tree.placeArea) {
    if (a !== areaId || id === own) continue;
    const p = pw.tree.placePoint.get(id);
    if (!p) continue;
    out = out ? { minLat: Math.min(out.minLat, p.lat), maxLat: Math.max(out.maxLat, p.lat), minLon: Math.min(out.minLon, p.lon), maxLon: Math.max(out.maxLon, p.lon), n: out.n + 1 } : { minLat: p.lat, maxLat: p.lat, minLon: p.lon, maxLon: p.lon, n: 1 };
  }
  return out;
}

const PLACE_LAYERS = new Set(["place", "route"]);

/** Whether an offer or event's `at`, `on`, `starts_at` (and an event's `part_of`) ends at a place or route, or at anything with a point. */
export function resolvesToPlace(pw: PlacementWorld, rec: CaptureRecord, depth = 0): boolean {
  const targets = [...(rec.at ?? []), ...(rec.on ?? []).map((o) => o.ref), ...(rec.starts_at ?? []), ...(rec.layer === "event" ? rec.part_of ?? [] : [])];
  for (const t of targets) {
    const primary = pw.world.alias.get(t) ?? t;
    const target = pw.world.cap.get(primary)?.rec;
    if (target && PLACE_LAYERS.has(target.layer)) return true;
    if (ownPointOf(pw, t)) return true;
    const loc = /^place\/(.+)$/.exec(primary)?.[1];
    if (loc && pw.tree.placeArea.has(loc)) return true;
    if (target && !PLACE_LAYERS.has(target.layer) && depth < 3 && target.ref !== rec.ref && resolvesToPlace(pw, target, depth + 1)) return true;
  }
  return false;
}

export interface Finding {
  code: PlacementCode;
  /** the key inside the record the finding is about, for the JSON pointer */
  key: string;
  message: string;
  /** where a researcher looks first (the gap report's hint column) */
  hint?: string;
}

/** The placement findings of one record. Severity (warning or error) is the caller's: see gapBudget.ts. */
export function placementFindings(pw: PlacementWorld, rec: CaptureRecord): Finding[] {
  const out: Finding[] = [];
  if (rec.layer === "offer" || rec.layer === "event") {
    if (!resolvesToPlace(pw, rec)) {
      const named = [...(rec.at ?? []), ...(rec.on ?? []).map((o) => o.ref), ...(rec.starts_at ?? []), ...(rec.layer === "event" ? rec.part_of ?? [] : [])];
      const fields = rec.layer === "event" ? "at or part_of" : "at, on or starts_at";
      out.push({
        code: "E_PLACE_ORPHAN",
        key: rec.layer === "event" ? "part_of" : "at",
        message: named.length === 0
          ? `${rec.ref} says nowhere where it happens. An ${rec.layer} inherits its placement: give ${fields} naming the place or route it happens at. Example: "at": ["legacy/<trip>/sights/<place>"].`
          : `${rec.ref} names ${named.join(", ")} in ${fields}, but none of them is a place or route with a placement. Point it at the place or route itself (capture contract 3.7).`,
      });
    }
    return out;
  }
  const role = defaultPointRole(rec.type, rec.layer);
  // area chain
  if (!rec.area_id) out.push({ code: "E_PLACE_AREA", key: "area_id", message: `${rec.ref} has no area_id. Every place and route carries its area, CC/REGION/area-slug from the locations store; country and region are read from it. Run node core/bin/capture.ts derive-area --write first: it takes the parent's area (part_of, at, starts_at), else the area of the nearest labelled point within ${AREA_DERIVATION.radiusKm} km when its region and nearest town agree. If it still has none, no area of the locations store reaches the point: add the area there (the location skill, an owner decision), or set it from the trip. Example: "area_id": "CA/AB/banff-national-park".`, hint: "capture.ts derive-area (parent, then point); else a new area in the locations store" });
  else if (!pw.tree.ids.has(rec.area_id)) out.push({ code: "E_PLACE_AREA", key: "area_id", message: `area_id "${rec.area_id}" is not an area, region or country of data/locations/locations.json. Use an id of its areas list, or add the area there first (python3 tools/locations.py). Example: "CA/AB/banff-national-park".` });
  // point
  const hit = pointOf(pw, rec);
  if (!hit) {
    out.push({ code: "W_PLACE_POINT", key: "point", message: `${rec.ref} has no point. Add its ${role} to data/capture/points.json with coord_src, point_source and point_role "${role}" (never from Google). Look first at: ${pointHint(pw, rec)}.`, hint: pointHint(pw, rec) });
    return out;
  }
  const p = hit.point;
  if (p.approx && !p.approx_note) out.push({ code: "W_PLACE_APPROX", key: "point", message: `the point of ${rec.ref} is marked approximate but says not why. Add approx_note: what the point is (a centroid, a guess from the map) and what would fix it. Approximate points count for Where, never for distances.` });
  // far from its area
  if (rec.area_id && pw.tree.ids.has(rec.area_id)) {
    const box = boxFor(pw, rec.area_id, rec.ref);
    if (box && box.n >= PLACEMENT_RULES.minBoxPoints) {
      const km = kmOutside(box, p.lat, p.lon);
      if (km > PLACEMENT_RULES.farKm) out.push({ code: "E_PLACE_FAR", key: "point", message: `the point of ${rec.ref} (${p.lat}, ${p.lon}) lies ${Math.round(km)} km outside ${rec.area_id}, more than ${PLACEMENT_RULES.farKm} km beyond the places the locations store holds there. Check for a wrong area_id or a swapped lat and lon.` });
    }
  }
  // nearest town (derived): only a non-approximate point can have one
  if (!p.approx) {
    const nt = rec.near_town;
    const answered = nt && (nt.state === "value" || nt.state === "searched_none");
    const kmOk = !nt || nt.state !== "value" || nt.v === NEAR_TOWN_NONE || (rec.near_town_km?.state === "value" && typeof rec.near_town_km.v === "number");
    if (!answered) out.push({ code: "W_PLACE_TOWN", key: "near_town", message: `${rec.ref} has a point but no near_town. It is derived from the towns layer (META-2) by the derive step in capture.ts build; override it only with the town the operator names.` });
    else if (!kmOk) out.push({ code: "W_PLACE_TOWN", key: "near_town_km", message: `${rec.ref} names a nearest town but no near_town_km. The derive step writes both; an override gives both with its source.` });
  }
  return out;
}

/** One line per record for `gaps --placement`. */
export interface PlacementRow {
  ref: string;
  type: string;
  layer: string;
  trip: string;
  area_id: string | null;
  point: { lat: number; lon: number; role: PointRole; role_stated: boolean; approx: boolean; from: string; via: string | null } | null;
  role: PointRole;
  near_town: string | null;
  findings: Finding[];
}

export function placementRow(pw: PlacementWorld, rec: CaptureRecord, trip: string): PlacementRow {
  const hit = rec.layer === "place" || rec.layer === "route" ? pointOf(pw, rec) : null;
  const role = defaultPointRole(rec.type, rec.layer);
  return {
    ref: rec.ref,
    type: rec.type,
    layer: rec.layer,
    trip,
    area_id: rec.area_id ?? null,
    point: hit ? { lat: hit.point.lat, lon: hit.point.lon, role: hit.point.point_role ?? role, role_stated: !!hit.point.point_role, approx: !!hit.point.approx, from: hit.point.from, via: hit.via } : null,
    role,
    near_town: rec.near_town?.state === "value" ? String(rec.near_town.v) : null,
    findings: placementFindings(pw, rec),
  };
}
