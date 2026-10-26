// `capture.ts migrate-placement` (META-1, capture contract 3.7.1): fills the parts of the placement block that held data can answer with
// certainty, and nothing else. Idempotent (a second run finds nothing to do), so it can run again when the locations store grows;
// `--check` exits 1 while there is something to write, `--write` applies it. Offline.
//
//  1. `area_id` on a place or route record, from the first source that answers (never a guess; an ambiguous record stays a gap):
//       a. the locations store: the record is a store place (its `place/<slug>` ref, or an alias, is the public ref pinned to a `loc:`
//          origin key in data/locations/page-keys.json), so the store's own `area_id` is the answer;
//       b. the store by Wikidata: the record's QID is the QID of store places that all sit in one area;
//       c. the parent: a `part/<ref>#x` cut out of <ref>, `part_of`, `starts_at` and `at`, when every parent that has an area names the
//          same one (a parent placed in this run counts, so a chain settles).
//     Not used: the trip (a trip crosses areas), `reaches` (a trail ends where it does not start), and point-in-polygon (the store has
//     no area polygons, only the boxes of its places, which cannot tell one park from its neighbour). Those records stay gaps, each with its
//     reason, until the locations store holds their area (DATA D2).
//  2. trailheads from held tracks: a trail with a stored OSM track (data/tracks, trail-track/1) and no point of its own gets the track's
//     first vertex in data/capture/points.json as `point_role: trailhead`. The point is exact only when the track is confirmed, was cut at
//     the trailhead and starts within TRAILHEAD_MAX_OFFSET_M of the trailhead the record names; any other start is `approx: true` with a note.
//
// The migration ledger rule holds: it only adds leaves (an `area_id` line inserted after the record's `ref`, a row in the points file);
// every other byte of a capture file is untouched.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { CaptureRecord } from "../schema/capture/records.ts";
import { CAPTURE_POINTS_PATH, loadPlacement, ownPointOf } from "./placementBlock.ts";
import { CAPTURE_POINTS_V2_SCHEMA_ID } from "../schema/capture/points.ts";
import { parsePointSource } from "../normalise/points.ts";
import type { PlacementWorld } from "./placementBlock.ts";
import { loadWorld, readJson } from "./records.ts";
import type { World } from "./records.ts";

export const ORIGIN_KEYS_FILE = "data/locations/page-keys.json";
/** A track start this close (metres) to the trailhead the record names, on a confirmed cut track, is the trailhead. */
export const TRAILHEAD_MAX_OFFSET_M = 50;

type Row = Record<string, unknown>;
export type AreaVia = "store" | "store_wikidata" | "parent";
export interface AreaAssignment { ref: string; file: string; area_id: string; via: AreaVia; from: string }
export interface AreaGap { ref: string; trip: string; why: "no_source" | "parents_disagree" }
export interface TrailheadRow { ref: string; place: string; row: Record<string, unknown> }
export interface Write { path: string; text: string }

export interface PlacementMigrationPlan {
  writes: Write[];
  areas: AreaAssignment[];
  gaps: AreaGap[];
  trailheads: TrailheadRow[];
  problems: string[];
  report: {
    place_route_records: number;
    area_id_before: number;
    area_id_assigned: number;
    area_id_by_source: Record<AreaVia, number>;
    area_id_after: number;
    area_gaps: Record<AreaGap["why"], number>;
    trailheads_added: number;
    trailheads_exact: number;
    trailheads_approx: number;
  };
}

interface StorePlace { id: string; area_id: string; wikidata: string | null }

/** The store's places with their area and QID; the by-country layout is merged like the placement block does. */
function storePlaces(root: string): StorePlace[] {
  const dir = join(root, "data", "locations");
  const store = readJson<Row>(join(dir, "locations.json")) ?? {};
  const own = Array.isArray(store.places) ? (store.places as Row[]) : [];
  const parts = store.layout === "by-country" && Array.isArray(store.parts) ? (store.parts as string[]).flatMap((cc) => {
    const part = readJson<Row>(join(dir, `${cc}.json`));
    return part && Array.isArray(part.places) ? (part.places as Row[]) : [];
  }) : [];
  return [...own, ...parts].flatMap((p) => typeof p.id === "string" && typeof p.area_id === "string" ? [{ id: p.id, area_id: p.area_id, wikidata: typeof p.wikidata === "string" ? p.wikidata : null }] : []);
}

/** `place/<slug>` ref -> locations place id, from the private origin keys (never printed). */
function originRefs(root: string): Map<string, string> {
  const doc = readJson<{ keys?: Record<string, string> }>(join(root, ORIGIN_KEYS_FILE));
  const out = new Map<string, string>();
  for (const [origin, ref] of Object.entries(doc?.keys ?? {})) if (origin.startsWith("loc:")) out.set(ref, origin.slice(4));
  return out;
}

const qidOf = (w: World, ref: string): string | null => {
  const v = w.rel.get(ref)?.rec.wikidata as { state?: string; v?: unknown } | undefined;
  return v?.state === "value" && typeof v.v === "string" ? v.v : null;
};

/** The parents of a record, as primary refs: the ref a `part/` was cut out of, `part_of`, `starts_at`, `at`. */
function parentsOf(w: World, rec: CaptureRecord): string[] {
  const cut = rec.ref.startsWith("part/") ? [rec.ref.slice(5).replace(/#.*$/, "")] : [];
  return [...cut, ...(rec.part_of ?? []), ...(rec.starts_at ?? []), ...(rec.at ?? [])].map((r) => w.alias.get(r) ?? r).filter((r) => r !== rec.ref);
}

/** Inserts `"area_id"` after the `ref` line of each assigned record, in the file's own text. Throws when the text is not shaped as expected. */
export function insertAreaIds(text: string, assign: ReadonlyMap<string, string>): string {
  const lines = text.split("\n");
  const out: string[] = [];
  const done = new Set<string>();
  for (const line of lines) {
    out.push(line);
    const m = /^( {6})"ref": ("(?:[^"\\]|\\.)*")(,?)$/.exec(line);
    if (!m) continue;
    const ref = JSON.parse(m[2]!) as string;
    const area = assign.get(ref);
    if (area === undefined) continue;
    if (m[3] !== ",") throw new Error(`the ref line of ${ref} has no trailing comma, so an area_id cannot follow it`);
    out.push(`      "area_id": ${JSON.stringify(area)},`);
    done.add(ref);
  }
  for (const ref of assign.keys()) if (!done.has(ref)) throw new Error(`${ref}: no top-level ref line found in the file to insert the area_id after`);
  return out.join("\n");
}

function deriveAreas(root: string, w: World, pw: PlacementWorld): { areas: AreaAssignment[]; gaps: AreaGap[]; before: number; total: number } {
  const places = storePlaces(root);
  const areaOfStore = new Map(places.map((p) => [p.id, p.area_id]));
  const byQid = new Map<string, Set<string>>();
  for (const p of places) if (p.wikidata) byQid.set(p.wikidata, new Set([...(byQid.get(p.wikidata) ?? []), p.area_id]));
  const refToLoc = originRefs(root);
  const known = (a: string): boolean => pw.tree.ids.has(a);

  const records = [...w.cap.values()].filter(({ rec }) => rec.layer === "place" || rec.layer === "route");
  const area = new Map<string, string>(records.flatMap(({ rec }) => (rec.area_id ? [[rec.ref, rec.area_id] as [string, string]] : [])));
  const before = area.size;
  const todo = records.filter(({ rec }) => !rec.area_id).sort((a, b) => a.rec.ref.localeCompare(b.rec.ref));
  const out: AreaAssignment[] = [];
  const set = (r: (typeof todo)[number], area_id: string, via: AreaVia, from: string): void => {
    area.set(r.rec.ref, area_id);
    out.push({ ref: r.rec.ref, file: r.file, area_id, via, from });
  };

  for (const r of todo) {
    for (const ref of [r.rec.ref, ...(r.rec.aliases ?? [])]) {
      const loc = refToLoc.get(ref);
      const a = loc ? areaOfStore.get(loc) : undefined;
      if (a && known(a)) { set(r, a, "store", "locations store"); break; }
    }
    if (area.has(r.rec.ref)) continue;
    const q = qidOf(w, r.rec.ref);
    const areas = q ? byQid.get(q) : undefined;
    if (q && areas?.size === 1) {
      const a = [...areas][0]!;
      if (known(a)) set(r, a, "store_wikidata", q);
    }
  }
  // the parent chain, to a fixed point; a disagreement is remembered so the report can say why
  const disagree = new Set<string>();
  for (let changed = true; changed;) {
    changed = false;
    for (const r of todo) {
      if (area.has(r.rec.ref)) continue;
      const found = new Map<string, string>();
      for (const p of parentsOf(w, r.rec)) {
        const a = area.get(p);
        if (a) found.set(p, a);
      }
      const distinct = new Set(found.values());
      if (distinct.size === 1) {
        const [parent, a] = [...found][0]!;
        if (known(a!)) { set(r, a!, "parent", parent!); changed = true; }
      } else if (distinct.size > 1) disagree.add(r.rec.ref);
    }
  }
  const gaps = todo.filter((r) => !area.has(r.rec.ref)).map((r): AreaGap => ({ ref: r.rec.ref, trip: r.trip, why: disagree.has(r.rec.ref) ? "parents_disagree" : "no_source" }));
  return { areas: out, gaps, before, total: records.length };
}

interface TrackDoc { schema?: string; place?: string; refs?: string[]; osm?: string[]; fetched?: string; stitched?: boolean; confirmed?: boolean; held_back?: string[]; start_offset_m?: number | null; cut?: string | null; geometry?: [number, number][] }

/** A trailhead row in the capture-points/2 shape: the v1 text parsed by the normaliser's own rule into point_src and meta. */
function trailheadRowV2(row: Record<string, unknown>): Record<string, unknown> {
  const { point_source, ...rest } = row;
  const parsed = parsePointSource(String(point_source), "osm", { pinned: false, readDefault: new Date().toISOString().slice(0, 10), run: "META-1" });
  const { point_role, approx, approx_note, ...head } = rest;
  return { ...head, point_src: parsed.point_src, point_role, ...(approx === undefined ? {} : { approx }), ...(approx_note === undefined ? {} : { approx_note }), meta: parsed.meta };
}

function deriveTrailheads(root: string, w: World, pw: PlacementWorld): TrailheadRow[] {
  const dir = join(root, "data", "tracks");
  if (!existsSync(dir)) return [];
  const rows: TrailheadRow[] = [];
  const taken = new Set<string>();
  for (const n of readdirSync(dir).filter((x) => x.endsWith(".json") && x !== "inputs.json").sort()) {
    const t = readJson<TrackDoc>(join(dir, n));
    if (!t || t.schema !== "trail-track/1" || !t.stitched || !t.geometry?.length) continue;
    const first = t.geometry[0]!;
    const rel = (t.osm ?? [])[0];
    const m = rel ? /^(relation|way):(\d+)$/.exec(rel) : null;
    if (!m) continue;
    const exact = t.confirmed === true && !!t.cut && typeof t.start_offset_m === "number" && t.start_offset_m <= TRAILHEAD_MAX_OFFSET_M;
    for (const raw of t.refs ?? []) {
      const ref = w.alias.get(raw) ?? raw;
      const rec = w.cap.get(ref)?.rec;
      if (!rec || rec.layer !== "route" || taken.has(ref) || ownPointOf(pw, ref)) continue;
      taken.add(ref);
      const row: Record<string, unknown> = {
        lat: Math.round(first[1] * 1e6) / 1e6,
        lon: Math.round(first[0] * 1e6) / 1e6,
        coord_src: "osm",
        point_source: `OSM ${m[1]} ${m[2]}, first vertex of the stored track data/tracks/${n} (ODbL), read ${t.fetched ?? "date not recorded"}; the track starts ${t.start_offset_m ?? "an unmeasured distance"} m from the trailhead the record names (lane META-1)`,
        point_role: "trailhead",
      };
      if (!exact) {
        row.approx = true;
        row.approx_note = `The stored track is ${t.confirmed ? "confirmed" : `not confirmed (${(t.held_back ?? ["held back"]).join("; ")})`}${t.cut ? "" : " and was not cut at the trailhead"}, so its first vertex is where the relation was cut, not a surveyed trailhead. Fix: confirm the route, or read the trailhead node (OSM highway=trailhead).`;
      }
      rows.push({ ref, place: t.place ?? n.replace(/\.json$/, ""), row });
    }
  }
  return rows;
}

export function planPlacementMigration(root: string): PlacementMigrationPlan {
  const w = loadWorld(root);
  const pw = loadPlacement(root, w);
  const { areas, gaps, before, total } = deriveAreas(root, w, pw);
  const trailheads = deriveTrailheads(root, w, pw);
  const problems: string[] = [];
  const writes: Write[] = [];

  const byFile = new Map<string, Map<string, string>>();
  for (const a of areas) byFile.set(a.file, new Map([...(byFile.get(a.file) ?? []), [a.ref, a.area_id]]));
  for (const [file, assign] of [...byFile].sort(([x], [y]) => x.localeCompare(y))) {
    try {
      const original = readFileSync(file, "utf8");
      const text = insertAreaIds(original, assign);
      const was = JSON.parse(original) as { records: Row[] };
      const now = JSON.parse(text) as { records: Row[] };
      const same = was.records.length === now.records.length && was.records.every((r, i) => {
        const n = now.records[i]!;
        const add = assign.get(String(r.ref));
        if (add === undefined) return JSON.stringify(n) === JSON.stringify(r);
        const { area_id, ...rest } = n;
        return area_id === add && JSON.stringify(rest) === JSON.stringify(r);
      });
      if (!same) problems.push(`${file}: the edited file differs from the original by more than the area_id lines`);
      else writes.push({ path: file, text });
    } catch (e) {
      problems.push(String(e instanceof Error ? e.message : e));
    }
  }

  if (trailheads.length > 0) {
    const path = join(root, CAPTURE_POINTS_PATH);
    const original = readFileSync(path, "utf8");
    const doc = JSON.parse(original) as { schema?: string; points: Record<string, unknown> };
    if (JSON.stringify(doc, null, 2) + "\n" !== original) problems.push(`${CAPTURE_POINTS_PATH} is not in the two-space style the migration writes; format it first`);
    else {
      for (const t of trailheads) doc.points[t.ref] = doc.schema === CAPTURE_POINTS_V2_SCHEMA_ID ? trailheadRowV2(t.row) : t.row;
      writes.push({ path, text: JSON.stringify(doc, null, 2) + "\n" });
    }
  }

  const by: Record<AreaVia, number> = { store: 0, store_wikidata: 0, parent: 0 };
  for (const a of areas) by[a.via]++;
  const gapCount: Record<AreaGap["why"], number> = { no_source: 0, parents_disagree: 0 };
  for (const g of gaps) gapCount[g.why]++;
  return {
    writes, areas, gaps, trailheads, problems,
    report: {
      place_route_records: total,
      area_id_before: before,
      area_id_assigned: areas.length,
      area_id_by_source: by,
      area_id_after: before + areas.length,
      area_gaps: gapCount,
      trailheads_added: trailheads.length,
      trailheads_exact: trailheads.filter((t) => !t.row.approx).length,
      trailheads_approx: trailheads.filter((t) => t.row.approx).length,
    },
  };
}
