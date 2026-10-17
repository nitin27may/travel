// research.index (plan 10.2): research/INDEX.json lists every research sidecar once: where it is, which lane wrote it, what
// it is about, how much it holds and how many holes (GAP) it admits to. Committed and deterministic: no clock, rows sorted
// by path, so the same files always give the same bytes.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

type Row = Record<string, any>;

export const INDEX_PATH = "research/INDEX.json";

export interface IndexRow {
  path: string;
  lane: string;
  subject: { kind: string; id: string };
  researched: string;
  geo: { countries: string[]; regions: string[]; areas: string[] };
  styles: string[];
  tags: string[];
  counts: { sources: number; facts: number; records: Record<string, number> };
  gaps: number;
  md: string;
}

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".json")) out.push(p);
  }
}

/** a gap is a fact marked gap, or a record that lists a gap of its own */
export function countGaps(sidecar: Row): number {
  const facts = ((sidecar.facts ?? []) as Row[]).filter((f) => f.confidence === "gap").length;
  let records = 0;
  for (const list of Object.values(sidecar.records ?? {})) {
    for (const r of list as Row[]) records += ((r.gaps ?? []) as unknown[]).length + (r.confidence === "gap" ? 1 : 0);
  }
  return facts + records;
}

export function indexRow(path: string, s: Row): IndexRow {
  const records: Record<string, number> = {};
  for (const [k, v] of Object.entries(s.records ?? {})) if ((v as unknown[]).length) records[k] = (v as unknown[]).length;
  return {
    path, lane: s.lane, subject: s.subject, researched: s.researched,
    geo: { countries: [...(s.geo?.countries ?? [])].sort(), regions: [...(s.geo?.regions ?? [])].sort(), areas: [...(s.geo?.areas ?? [])].sort() },
    styles: [...(s.trip_type?.styles ?? [])].sort(), tags: [...(s.tags ?? [])].sort(),
    counts: { sources: (s.sources ?? []).length, facts: (s.facts ?? []).length, records: Object.fromEntries(Object.entries(records).sort(([a], [b]) => a.localeCompare(b))) },
    gaps: countGaps(s), md: s.md,
  };
}

/** every research-sidecar/1 file under research/, as repository-relative paths with their documents */
export function findSidecars(root: string): { path: string; doc: Row }[] {
  const files: string[] = [];
  walk(join(root, "research"), files);
  const out: { path: string; doc: Row }[] = [];
  for (const f of files) {
    const rel = relative(root, f).split(sep).join("/");
    if (rel === INDEX_PATH || rel.startsWith("research/inbox/")) continue;
    let doc: Row;
    try {
      doc = JSON.parse(readFileSync(f, "utf8"));
    } catch {
      continue;
    }
    if (doc && doc.schema === "research-sidecar/1") out.push({ path: rel, doc });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export function buildIndex(root: string): Row {
  return { schema_version: 1, sidecars: findSidecars(root).map((s) => indexRow(s.path, s.doc)) };
}

export function indexText(root: string): string {
  const doc = buildIndex(root);
  const rows = doc.sidecars as IndexRow[];
  const lines = ["{", `"schema_version": 1,`];
  if (rows.length) {
    lines.push(`"sidecars": [`);
    rows.forEach((r, i) => lines.push(JSON.stringify(r) + (i < rows.length - 1 ? "," : "")));
    lines.push("]");
  } else lines.push(`"sidecars": []`);
  lines.push("}");
  return lines.join("\n") + "\n";
}

/** write research/INDEX.json; returns true when the bytes changed */
export function writeIndex(root: string): boolean {
  const text = indexText(root);
  const path = join(root, INDEX_PATH);
  if (existsSync(path) && readFileSync(path, "utf8") === text) return false;
  writeFileSync(path, text);
  return true;
}
