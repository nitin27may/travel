// research.dedupe (plan 10.2): which records in different sidecars are the same thing, and which facts disagree. Records are
// grouped with the matcher of the catalog pipeline (same thresholds), so the report and the proposal never disagree about
// what counts as a duplicate. Conflicting facts are kept side by side, not resolved.
import { normaliseSidecar } from "../catalog/normalise.ts";
import type { NormRecord } from "../catalog/normalise.ts";
import { matchRecord } from "../catalog/match.ts";
import type { Deps, Row } from "../catalog/common.ts";
import { same } from "../catalog/common.ts";
import { findSidecars } from "./index.ts";

export interface Member {
  path: string;
  id: string;
  name: string;
}

export interface Group {
  entity: string;
  /** same: confident; possible: the matcher would send it to review */
  kind: "same" | "possible";
  by: string;
  members: Member[];
}

export interface FactConflict {
  key: string;
  subject_ref: string | null;
  values: { path: string; value: unknown; unit: string | null; confidence: string; src: string[] }[];
}

export interface DedupeReport {
  groups: Group[];
  conflicts: FactConflict[];
}

export function dedupeSidecars(sidecars: { path: string; doc: Row }[], deps: Deps): DedupeReport {
  const recs: { path: string; rec: NormRecord }[] = [];
  for (const s of sidecars) for (const rec of normaliseSidecar(s.doc, s.path, deps).records) recs.push({ path: s.path, rec });

  // union-find over records that match an earlier record of the same entity
  const parent = recs.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const link = new Map<number, { kind: "same" | "possible"; by: string }>();
  recs.forEach((r, i) => {
    const pool: Row[] = [];
    const owners: number[] = [];
    recs.forEach((q, j) => {
      if (j < i && q.rec.entity === r.rec.entity && q.rec.id) {
        pool.push({ ...q.rec.row, id: `#${j}` });
        owners.push(j);
      }
    });
    if (pool.length === 0) return;
    const m = matchRecord({ entity: r.rec.entity, id: r.rec.id, row: r.rec.row, match: r.rec.match }, pool.map((p) => ({ ...p, id: String(p.id) })));
    // a record that shares its id with an earlier one is the same record seen twice
    const sameId = r.rec.id ? owners.find((j) => recs[j]!.rec.id === r.rec.id) : undefined;
    const target = sameId !== undefined ? sameId : m.kind !== "new" && m.id ? Number(m.id.slice(1)) : undefined;
    if (target === undefined) return;
    parent[find(i)] = find(target);
    const prev = link.get(find(i));
    const kind = sameId !== undefined || m.kind === "same" ? "same" : "possible";
    if (!prev || (prev.kind === "same" && kind === "possible")) link.set(find(i), { kind: prev?.kind === "same" ? "same" : kind, by: sameId !== undefined ? "id" : (m.by ?? "name") });
  });
  const buckets = new Map<number, number[]>();
  recs.forEach((_, i) => (buckets.get(find(i)) ?? buckets.set(find(i), []).get(find(i))!).push(i));
  const groups: Group[] = [];
  for (const [root, members] of buckets) {
    if (members.length < 2) continue;
    // a group is only "same" when every link is
    const kinds = members.slice(1).map((i) => {
      const r = recs[i]!;
      const sameId = members.some((j) => j < i && recs[j]!.rec.id === r.rec.id);
      return sameId ? "same" : (link.get(root)?.kind ?? "possible");
    });
    groups.push({
      entity: recs[members[0]!]!.rec.entity,
      kind: kinds.every((k) => k === "same") ? "same" : "possible",
      by: link.get(root)?.by ?? "id",
      members: members.map((i) => ({ path: recs[i]!.path, id: recs[i]!.rec.id ?? "", name: String(recs[i]!.rec.row.name ?? recs[i]!.rec.row.provider ?? "") })),
    });
  }
  groups.sort((a, b) => a.entity.localeCompare(b.entity) || a.members[0]!.id.localeCompare(b.members[0]!.id));

  // facts on the same key (and subject) with different values stay side by side, marked as a conflict
  const byKey = new Map<string, FactConflict["values"]>();
  const meta = new Map<string, { key: string; subject_ref: string | null }>();
  for (const s of sidecars) {
    for (const f of (s.doc.facts ?? []) as Row[]) {
      if (f.confidence === "gap") continue;
      const k = `${f.key}|${f.subject_ref ?? ""}`;
      meta.set(k, { key: f.key, subject_ref: f.subject_ref ?? null });
      (byKey.get(k) ?? byKey.set(k, []).get(k)!).push({ path: s.path, value: f.value, unit: f.unit ?? null, confidence: f.confidence, src: f.src });
    }
  }
  const conflicts: FactConflict[] = [];
  for (const [k, values] of byKey) {
    if (values.length > 1 && values.some((v) => !same(v.value, values[0]!.value))) conflicts.push({ ...meta.get(k)!, values });
  }
  conflicts.sort((a, b) => a.key.localeCompare(b.key));
  return { groups, conflicts };
}

export function dedupe(root: string, deps: Deps): DedupeReport {
  return dedupeSidecars(findSidecars(root), deps);
}
