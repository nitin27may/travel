// Derives data/sources/registry.json from the `sources` arrays of every suitability and relevance lane file. Offline and
// deterministic: the same lane files and links.json always give the same bytes. The registry is never edited by hand.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { LinkStatus, SourceEntry, SourceRegistry, SourceUsedBy } from "../schema/sources.ts";
import { recheckOf } from "./cadence.ts";
import { isWebUrl, normaliseUrl, sourceId } from "./normalize.ts";
import { notesFor } from "./notes.ts";

export const REGISTRY_PATH = "data/sources/registry.json";
export const LINKS_PATH = "data/sources/links.json";

/** The lane-file kind in the data, mapped to the registry kind. */
export const KIND_MAP: Record<string, SourceEntry["kind"]> = {
  official: "official",
  operator: "operator",
  reseller: "agency",
  press: "editorial",
  blog: "editorial",
  community: "community",
  video: "community",
  computed: "reference",
};

interface LaneSource { id: string; url: string; title: string; publisher: string; kind: string; read: string }
interface LaneDoc { sources?: LaneSource[]; records?: { ref?: string }[] }

export interface LinkRecord { url: string; status: LinkStatus; http: number | null; final: string | null; checked: string }
export interface LinksFile { schema: "source-links/1"; links: Record<string, LinkRecord> }

/** Lane files: every data/suitability/<trip>/*.json and data/relevance/<trip>/*.json (not derived, signals or inputs). */
export function laneFiles(root: string): string[] {
  const out: string[] = [];
  for (const [base, skip] of [["suitability", []], ["relevance", ["derived", "signals", "inputs"]]] as [string, string[]][]) {
    const dir = join(root, "data", base);
    if (!existsSync(dir)) continue;
    for (const trip of readdirSync(dir).sort()) {
      const tdir = join(dir, trip);
      if (skip.includes(trip) || !statSync(tdir).isDirectory()) continue;
      for (const n of readdirSync(tdir).filter((x) => x.endsWith(".json")).sort()) out.push(join(tdir, n));
    }
  }
  return out;
}

/** Every [path, srcIds] pair in a record: the field is the dotted path to the value, ".conflicts" folded into its value. */
export function srcUses(record: unknown): { field: string; ids: string[] }[] {
  const uses: { field: string; ids: string[] }[] = [];
  const walk = (o: unknown, path: string): void => {
    if (Array.isArray(o)) {
      for (const v of o) walk(v, path);
      return;
    }
    if (o === null || typeof o !== "object") return;
    const rec = o as Record<string, unknown>;
    if (Array.isArray(rec.src) && rec.src.every((s) => typeof s === "string")) {
      uses.push({ field: path.replace(/\.conflicts$/, "") || "(record)", ids: rec.src as string[] });
    }
    for (const [k, v] of Object.entries(rec)) {
      if (k === "src" || k === "ref") continue;
      walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(record, "");
  return uses;
}

export interface Problem { file: string; message: string }

export interface BuildResult { registry: SourceRegistry; problems: Problem[]; lanes: number; rows: number }

const mostCommon = (xs: string[]): string => {
  const n = new Map<string, number>();
  for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]![0];
};
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Removes link results whose source id is not in `liveIds` (a source no lane file uses any more); returns the ids dropped. */
export function pruneOrphanLinks(file: LinksFile, liveIds: Iterable<string>): string[] {
  const live = new Set(liveIds);
  const dropped = Object.keys(file.links).filter((id) => !live.has(id));
  for (const id of dropped) delete file.links[id];
  return dropped.sort();
}

export function readLinks(root: string): LinksFile {
  const p = join(root, LINKS_PATH);
  if (!existsSync(p)) return { schema: "source-links/1", links: {} };
  return JSON.parse(readFileSync(p, "utf8")) as LinksFile;
}

export function buildRegistry(root: string, links: LinksFile = readLinks(root)): BuildResult {
  const problems: Problem[] = [];
  interface Acc { url: string; rows: LaneSource[]; used: Map<string, SourceUsedBy> }
  const acc = new Map<string, Acc>();
  const files = laneFiles(root);
  let rows = 0;
  for (const f of files) {
    const rel = relative(root, f).split("\\").join("/");
    let doc: LaneDoc;
    try {
      doc = JSON.parse(readFileSync(f, "utf8")) as LaneDoc;
    } catch (e) {
      problems.push({ file: rel, message: `not valid JSON: ${(e as Error).message}` });
      continue;
    }
    const byLocal = new Map<string, string>(); // lane src id -> registry id
    const seen = new Set<string>();
    for (const s of doc.sources ?? []) {
      rows++;
      if (seen.has(s.id)) problems.push({ file: rel, message: `source id ${s.id} is declared twice` });
      seen.add(s.id);
      const url = normaliseUrl(s.url);
      const id = sourceId(url);
      byLocal.set(s.id, id);
      const a: Acc = acc.get(id) ?? { url, rows: [], used: new Map<string, SourceUsedBy>() };
      a.rows.push(s);
      acc.set(id, a);
    }
    for (const r of doc.records ?? []) {
      for (const { field, ids } of srcUses(r)) {
        for (const lid of ids) {
          const rid = byLocal.get(lid);
          if (!rid) {
            problems.push({ file: rel, message: `${r.ref ?? "(record)"} ${field} names ${lid}, which is not in this file's sources` });
            continue;
          }
          const u = { file: rel, ref: r.ref ?? "(record)", field };
          acc.get(rid)!.used.set(`${u.file}\u0000${u.ref}\u0000${u.field}`, u);
        }
      }
    }
  }
  const entries: SourceEntry[] = [];
  for (const [id, a] of acc) {
    const reads = a.rows.map((r) => r.read).sort();
    const used = [...a.used.values()].sort((x, y) => cmp(x.file, y.file) || cmp(x.ref, y.ref) || cmp(x.field, y.field));
    const kinds = a.rows.map((r) => KIND_MAP[r.kind] ?? "reference");
    const link = links.links[id];
    const local = !isWebUrl(a.url);
    entries.push({
      id,
      url: a.url,
      title: mostCommon(a.rows.map((r) => r.title)),
      publisher: mostCommon(a.rows.map((r) => r.publisher)),
      kind: mostCommon(kinds) as SourceEntry["kind"],
      first_read: reads[0]!,
      last_read: reads[reads.length - 1]!,
      used_by: used,
      ...notesFor(a.url),
      recheck: recheckOf(used.map((u) => u.field)),
      link: local ? { status: "local", checked: null } : link ? { status: link.status, checked: link.checked } : { status: "unchecked", checked: null },
    });
  }
  entries.sort((x, y) => cmp(x.url, y.url));
  return { registry: { schema: "sources/1", entries }, problems, lanes: files.length, rows };
}

export const registryText = (r: SourceRegistry): string => JSON.stringify(r, null, 2) + "\n";
