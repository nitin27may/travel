// `capture.ts derive-near` (META-2, capture contract 3.7.1): writes `near_town` and `near_town_km` onto every place and route record whose
// point is not approximate, from the towns layer (data/reference/towns, written from the GeoNames dump). Idempotent: a second run finds
// nothing to do, and it runs again when the towns or the points change. Offline.
//
//   - a record with an exact point (its own, or a route's start) gets the nearest town of 1,000 people within 50 km, or the value
//     `none_within_50km` (an answer, never a gap), with provenance: basis `our_inference`, `on` = the date the dump was downloaded, and a
//     note naming this step and the GeoNames id;
//   - a record whose point is approximate gets nothing (T5: an approximate point never counts for a distance);
//   - a `near_town` that this step did not write (an override: the operator names the town, with its own source) is never touched;
//   - the ledger rule holds: the edit only adds the two keys or replaces a block this step wrote earlier. It is inserted after the
//     record's `layer` line, so it never sits next to the `area_id` line META-1 inserts after `ref`. Every other byte of a file is untouched.
import { readFileSync } from "node:fs";
import { deriveNearTown } from "../derive/near.ts";
import { readTownsFiles, hasTownsFiles } from "../derive/townsData.ts";
import { NEAR_TOWN_NONE } from "../schema/capture/points.ts";
import { loadPlacement, PLACEMENT_RULES, pointOf } from "./placementBlock.ts";
import { loadWorld } from "./records.ts";

export interface Write { path: string; text: string }
export interface NearAssignment { ref: string; file: string; town: string; km: number | null; geonamesId: number | null; was: "none" | "derived" | "override" }

type Val = { v: unknown; state: "value"; basis: "our_inference"; src: []; on: string; note: string };
const MARK = "Derived (capture.ts derive-near)";

export function blocks(a: { town: string; km: number | null; geonamesId: number | null }, downloaded: string): { near_town: Val; near_town_km?: Val } {
  const rule = `nearest GeoNames town of ${PLACEMENT_RULES.townMinPopulation}+ people within ${PLACEMENT_RULES.townRadiusKm} km`;
  if (a.town === NEAR_TOWN_NONE) return { near_town: { v: NEAR_TOWN_NONE, state: "value", basis: "our_inference", src: [], on: downloaded, note: `${MARK}: no GeoNames town of ${PLACEMENT_RULES.townMinPopulation}+ people within ${PLACEMENT_RULES.townRadiusKm} km (cities1000 downloaded ${downloaded}).` } };
  return {
    near_town: { v: a.town, state: "value", basis: "our_inference", src: [], on: downloaded, note: `${MARK}: ${rule}, straight line. GeoNames ${a.geonamesId}, cities1000 downloaded ${downloaded}.` },
    near_town_km: { v: a.km, state: "value", basis: "our_inference", src: [], on: downloaded, note: `${MARK}: straight line to that town's GeoNames point.` },
  };
}

/** The text of one block as it sits in a capture file: a field at six spaces, the object two spaces deeper. */
const fieldText = (key: string, v: Val): string => `      ${JSON.stringify(key)}: ${JSON.stringify(v, null, 2).split("\n").map((l, i) => (i === 0 ? l : "      " + l)).join("\n")},`;

/** The lines of the derived blocks in a record's own text, or empty. A block is ours when its note starts with the marker. */
function derivedSpans(lines: string[], from: number, to: number): [number, number][] {
  const spans: [number, number][] = [];
  for (let i = from; i < to; i++) {
    const m = /^ {6}"(near_town|near_town_km)": \{$/.exec(lines[i]!);
    if (!m) continue;
    let j = i + 1;
    while (j < to && !/^ {6}\},?$/.test(lines[j]!)) j++;
    if (lines.slice(i, j + 1).some((l) => l.includes(`"note": "${MARK}`))) spans.push([i, j]);
    i = j;
  }
  return spans;
}

/** Edits one file's text: for each ref in `want`, replaces this step's blocks (or inserts them after the layer line). Throws on an unexpected shape. */
export function editFile(text: string, want: ReadonlyMap<string, ReturnType<typeof blocks> | null>): string {
  const lines = text.split("\n");
  const refAt: { ref: string; line: number }[] = [];
  lines.forEach((l, i) => {
    const m = /^ {6}"ref": ("(?:[^"\\]|\\.)*"),?$/.exec(l);
    if (m) refAt.push({ ref: JSON.parse(m[1]!) as string, line: i });
  });
  const done = new Set<string>();
  // from the last record to the first, so the line numbers of the earlier ones stay valid
  for (let k = refAt.length - 1; k >= 0; k--) {
    const { ref, line } = refAt[k]!;
    if (!want.has(ref)) continue;
    const end = k + 1 < refAt.length ? refAt[k + 1]!.line : lines.length;
    for (const [a, b] of derivedSpans(lines, line, end).reverse()) lines.splice(a, b - a + 1);
    const blk = want.get(ref);
    done.add(ref);
    if (!blk) continue;
    const after = ((): number => {
      for (let i = line + 1; i < Math.min(end, lines.length); i++) if (/^ {6}"layer": "[^"]*",$/.test(lines[i]!)) return i;
      throw new Error(`${ref}: no top-level "layer" line found to insert the nearest town after`);
    })();
    const add = [fieldText("near_town", blk.near_town), ...(blk.near_town_km ? [fieldText("near_town_km", blk.near_town_km)] : [])];
    lines.splice(after + 1, 0, ...add.join("\n").split("\n"));
  }
  for (const r of want.keys()) if (!done.has(r)) throw new Error(`${r}: no top-level ref line found in the file`);
  return lines.join("\n");
}

export interface NearPlan {
  writes: Write[];
  assignments: NearAssignment[];
  problems: string[];
  report: {
    place_route_records: number;
    with_exact_point: number;
    approx_point_skipped: number;
    no_point_skipped: number;
    derived_town: number;
    derived_none_within_50km: number;
    overrides_kept: number;
    files_changed: number;
    towns_layer: { rows: number; downloaded: string } | null;
  };
}

export function planNearDerivation(root: string): NearPlan {
  const empty = (problem: string): NearPlan => ({ writes: [], assignments: [], problems: [problem], report: { place_route_records: 0, with_exact_point: 0, approx_point_skipped: 0, no_point_skipped: 0, derived_town: 0, derived_none_within_50km: 0, overrides_kept: 0, files_changed: 0, towns_layer: null } });
  if (!hasTownsFiles(root)) return empty("data/reference/towns is missing; run: python3 tools/towns.py build");
  const layer = readTownsFiles(root);
  const towns = layer.rows.map((r) => ({ id: r.id, lat: r.lat, lon: r.lon, pop: r.pop, geonamesId: r.geonamesId }));
  const downloaded = layer.manifest.source.downloaded;
  const w = loadWorld(root);
  const pw = loadPlacement(root, w);
  const problems: string[] = [];
  const assignments: NearAssignment[] = [];
  const byFile = new Map<string, Map<string, ReturnType<typeof blocks>>>();
  let records = 0, exact = 0, approx = 0, none = 0, tn = 0, nn = 0, overrides = 0;
  for (const { rec, file } of [...w.cap.values()].sort((a, b) => a.rec.ref.localeCompare(b.rec.ref))) {
    if (rec.layer !== "place" && rec.layer !== "route") continue;
    records++;
    const hit = pointOf(pw, rec);
    if (!hit) { none++; continue; }
    if (hit.point.approx) { approx++; continue; }
    exact++;
    const mine = rec.near_town?.note?.startsWith(MARK) ?? false;
    if (rec.near_town && !mine) { overrides++; assignments.push({ ref: rec.ref, file, town: String(rec.near_town.v), km: typeof rec.near_town_km?.v === "number" ? rec.near_town_km.v : null, geonamesId: null, was: "override" }); continue; }
    const d = deriveNearTown(hit.point, towns);
    if (d.town === NEAR_TOWN_NONE) nn++; else tn++;
    assignments.push({ ref: rec.ref, file, town: d.town, km: d.km, geonamesId: d.geonamesId, was: mine ? "derived" : "none" });
    byFile.set(file, new Map([...(byFile.get(file) ?? []), [rec.ref, blocks(d, downloaded)]]));
  }
  const writes: Write[] = [];
  for (const [file, want] of [...byFile].sort(([x], [y]) => x.localeCompare(y))) {
    try {
      const original = readFileSync(file, "utf8");
      const text = editFile(original, want);
      if (text === original) continue;
      const was = JSON.parse(original) as { records: Record<string, unknown>[] };
      const now = JSON.parse(text) as { records: Record<string, unknown>[] };
      // the ledger rule: every leaf the file held before is still there, unchanged; the only new keys are ours
      const same = was.records.length === now.records.length && was.records.every((r, i) => {
        const n = { ...now.records[i]! };
        if (want.has(String(r.ref))) { delete n.near_town; delete n.near_town_km; }
        const o = { ...r };
        if (want.has(String(r.ref)) && (r.near_town as { note?: string } | undefined)?.note?.startsWith(MARK)) { delete o.near_town; delete o.near_town_km; }
        return JSON.stringify(n) === JSON.stringify(o);
      });
      if (!same) problems.push(`${file}: the edited file differs from the original by more than the near_town blocks`);
      else writes.push({ path: file, text });
    } catch (e) {
      problems.push(String(e instanceof Error ? e.message : e));
    }
  }
  return {
    writes, assignments, problems,
    report: { place_route_records: records, with_exact_point: exact, approx_point_skipped: approx, no_point_skipped: none, derived_town: tn, derived_none_within_50km: nn, overrides_kept: overrides, files_changed: writes.length, towns_layer: { rows: layer.rows.length, downloaded } },
  };
}
