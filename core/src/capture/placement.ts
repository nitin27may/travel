// Capture contract 2.7.2, applied after the first migration: facts and draw go to the layer that causes them.
// Reviewed input: data/capture/placement.json. Runs once (`applied`); the migration ledger stays true because a field moves between
// records of one lane file and a relevance record changes ref, and what was dropped as a duplicate is kept verbatim in the file.
import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { CaptureDoc } from "../schema/capture/records.ts";
import { readJson, sidecarFiles } from "./records.ts";
import { loadTypes, treeOf } from "./tree.ts";
import { serializeLike } from "./migrate.ts";

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export const PLACEMENT_PATH = "data/capture/placement.json";

export interface PlacementFile {
  schema: "capture-placement/1";
  reviewed: string;
  note: string;
  applied: boolean;
  field_moves: { from: string; to: string; fields: string[]; reason: string }[];
  draw_moves: { from: string; to: string; kind: string; reason: string }[];
  route_is_attraction: { ref: string; reason: string }[];
  at: { ref: string; at: string; reason: string }[];
  removed_duplicates: { ref: string; file: string; reason: string; fields: Record<string, Any> }[];
  review: { ref: string; field: string; why: string }[];
}

export interface PlacementPlan { writes: { path: string; text: string }[]; problems: string[]; report: Record<string, number> }

/** Why a route that keeps its relevance record carries the draw. */
export function attractionReason(classKey: string): string {
  const head = classKey.split("/")[0];
  if (head === "trail") return `The lane judged the walk itself (class ${classKey}); no payoff place is recorded yet, so the route carries the draw until research adds one.`;
  if (head === "drive") return `A scenic drive is the experience (class ${classKey}).`;
  if (head === "lift") return `The ride is the experience (class ${classKey}).`;
  return `The lane judged this route as the thing visited (class ${classKey}); no place for it is recorded yet.`;
}

export function planPlacement(root: string): PlacementPlan {
  const plan = readJson<PlacementFile>(join(root, PLACEMENT_PATH));
  const problems: string[] = [];
  const report: Record<string, number> = { fields_moved: 0, places_given_a_record: 0, draw_moved: 0, flags: 0, duplicates_removed: 0, at_set: 0 };
  if (!plan) return { writes: [], problems: ["data/capture/placement.json is missing"], report };
  const tree = treeOf(loadTypes(root));
  const suit = sidecarFiles(root, "suitability").map((path) => ({ path, text: readFileSync(path, "utf8") }));
  const rel = sidecarFiles(root, "relevance").map((path) => ({ path, text: readFileSync(path, "utf8") }));
  const cap = sidecarFiles(root, "capture").map((path) => ({ path, text: readFileSync(path, "utf8") }));
  const sdocs = new Map(suit.map((f) => [f.path, JSON.parse(f.text) as Any]));
  const rdocs = new Map(rel.map((f) => [f.path, JSON.parse(f.text) as Any]));
  const cdocs = new Map(cap.map((f) => [f.path, JSON.parse(f.text) as CaptureDoc]));
  const changed = new Set<string>();
  const capOf = (ref: string): { rec: CaptureDoc["records"][number]; path: string } | null => {
    for (const [path, d] of cdocs) { const rec = d.records.find((r) => r.ref === ref); if (rec) return { rec, path }; }
    return null;
  };
  const isMig = (p: string): boolean => /(^|\/)migrated[^/]*\.json$/.test(p);

  // 1. facts move to the place that causes them, inside the lane file that holds their sources
  for (const m of plan.field_moves) {
    const file = suit.find((f) => !isMig(f.path) && (sdocs.get(f.path)!.records as Any[]).some((r) => r.ref === m.from));
    if (!file) { problems.push(`${m.from}: no lane record`); continue; }
    const doc = sdocs.get(file.path)!;
    const src = (doc.records as Any[]).find((r) => r.ref === m.from)!;
    const to = capOf(m.to);
    const node = to ? tree.byId.get(to.rec.type) : null;
    const pair = node?.legacy?.[0];
    if (!pair) { problems.push(`${m.to}: its type has no legacy kind and subkind for a suitability record`); continue; }
    let dst = (doc.records as Any[]).find((r) => r.ref === m.to);
    if (!dst) {
      dst = { ref: m.to, kind: pair.kind, subkind: pair.subkind, suitability: {} };
      (doc.records as Any[]).splice((doc.records as Any[]).indexOf(src) + 1, 0, dst);
      report.places_given_a_record++;
    }
    for (const f of m.fields) {
      if (src.suitability?.[f] === undefined) { problems.push(`${m.from}: has no ${f}`); continue; }
      if (dst.suitability[f] !== undefined) { problems.push(`${m.to}: already has ${f}`); continue; }
      dst.suitability[f] = src.suitability[f];
      delete src.suitability[f];
      report.fields_moved++;
    }
    changed.add(file.path);
  }
  // 2. duplicates dropped, kept verbatim in the placement file
  for (const d of plan.removed_duplicates) {
    const p = join(root, d.file.startsWith("/") ? d.file.slice(root.length + 1) : d.file);
    const doc = sdocs.get(p) ?? sdocs.get(d.file);
    const rec = doc && (doc.records as Any[]).find((r) => r.ref === d.ref);
    if (!rec) { problems.push(`${d.ref}: no record to remove duplicates from`); continue; }
    for (const k of Object.keys(d.fields)) {
      if (JSON.stringify(rec.suitability?.[k]) !== JSON.stringify(d.fields[k])) { problems.push(`${d.ref}.${k} differs from the copy kept in placement.json`); continue; }
      delete rec.suitability[k];
      report.duplicates_removed++;
    }
    changed.add(sdocs.has(p) ? p : d.file);
  }
  // 3. draw and class move to the place a visitor comes to see
  for (const m of plan.draw_moves) {
    for (const [path, doc] of rdocs) {
      const r = (doc.records as Any[]).find((x) => x.ref === m.from);
      if (!r) continue;
      r.ref = m.to;
      r.kind = m.kind;
      delete r.subkind;
      changed.add(path);
      report.draw_moved++;
    }
  }
  // 4. capture: a route that keeps a relevance record says why
  const relRefs = new Set([...rdocs.values()].flatMap((d) => (d.records as Any[]).map((r) => r.ref as string)));
  const classOf = new Map([...rdocs.values()].flatMap((d) => (d.records as Any[]).map((r) => [r.ref as string, r.class_key as string] as const)));
  const custom = new Map(plan.route_is_attraction.map((x) => [x.ref, x.reason]));
  for (const [path, d] of cdocs) {
    for (const r of d.records) {
      if (r.layer === "route" && relRefs.has(r.ref)) {
        r.route_is_attraction = true;
        r.attraction_reason = custom.get(r.ref) ?? attractionReason(classOf.get(r.ref)!);
        changed.add(path);
        report.flags++;
      }
    }
  }
  for (const a of plan.at) {
    const c = capOf(a.ref);
    if (!c) { problems.push(`${a.ref}: no capture record`); continue; }
    c.rec.at = [a.at];
    changed.add(c.path);
    report.at_set++;
  }
  const writes: { path: string; text: string }[] = [];
  const texts = new Map<string, string>([...suit, ...rel, ...cap].map((f) => [f.path, f.text]));
  for (const p of [...changed].sort()) {
    const doc = sdocs.get(p) ?? rdocs.get(p) ?? cdocs.get(p);
    writes.push({ path: p, text: serializeLike(texts.get(p) ?? "", doc) });
  }
  writes.push({ path: join(root, PLACEMENT_PATH), text: JSON.stringify({ ...plan, applied: true }, null, 2) + "\n" });
  void basename; void dirname;
  return { writes, problems, report };
}
