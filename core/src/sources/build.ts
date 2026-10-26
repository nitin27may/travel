// Derives data/sources/registry.json from the `sources` arrays of every suitability, relevance and capture lane file and of the trip-level windows, base-plans and seasons files. Offline and
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

// title and kind are optional in the trip-level files (base plans carry only publisher and read)
interface LaneSource { id: string; url: string; title?: string; publisher: string; kind?: string; read: string }
interface LaneDoc { sources?: LaneSource[]; records?: { ref?: string }[]; entries?: { ref?: string }[] }

/** The trip-level folders (RIS-J): one file per trip, `sources` at the top and the sourced values under other keys. */
export const TRIP_LEVEL_FOLDERS = ["windows", "base-plans", "seasons"] as const;

/** The weather links reference file (UXB-WL): no `sources` array; each link, fallback and publisher home is a source of kind official. */
export const WEATHER_LINKS_PATH = "data/reference/weather-links.json";

interface WxDoc {
  researched?: string;
  publishers?: Record<string, { name: string; short?: string; home: string | null }>;
  trips?: { trip: string; links: { kind: string; label: string; publisher: string; url: string; check: { read: string } }[]; fallback: { url: string; check: { read: string } } }[];
}

export interface LinkRecord { url: string; status: LinkStatus; http: number | null; final: string | null; checked: string }
export interface LinksFile { schema: "source-links/1"; links: Record<string, LinkRecord> }

/** Lane files: every data/suitability/<trip>/*.json, data/relevance/<trip>/*.json and data/capture/<trip>/*.json (not derived, signals, inputs, splits or runs). */
export function laneFiles(root: string): string[] {
  const out: string[] = [];
  for (const [base, skip] of [["suitability", []], ["relevance", ["derived", "signals", "inputs"]], ["capture", ["splits", "runs"]]] as [string, string[]][]) {
    const dir = join(root, "data", base);
    if (!existsSync(dir)) continue;
    for (const trip of readdirSync(dir).sort()) {
      const tdir = join(dir, trip);
      if (skip.includes(trip) || !statSync(tdir).isDirectory()) continue;
      for (const n of readdirSync(tdir).filter((x) => x.endsWith(".json")).sort()) out.push(join(tdir, n));
    }
  }
  // the trip-level folders: data/<folder>/<trip>.json
  for (const base of TRIP_LEVEL_FOLDERS) {
    const dir = join(root, "data", base);
    if (!existsSync(dir)) continue;
    for (const n of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) out.push(join(dir, n));
  }
  // the trips' base points: one file, with its own sources array and a record per trip (data/trips/base-points.json)
  const bp = join(root, "data", "trips", "base-points.json");
  if (existsSync(bp)) out.push(bp);
  // the supersede overrides (capture contract 9.7): a sources array and entries that carry refs and src ids
  const sup = join(root, "data", "capture", "supersedes.json");
  if (existsSync(sup)) out.push(sup);
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
  let lanesRead = files.length;
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
    // a trip-level file has no records: its other top-level keys are the records, the field starts with the key
    const tripLevel = TRIP_LEVEL_FOLDERS.some((b) => rel.startsWith(`data/${b}/`));
    const recs: { ref?: string }[] = tripLevel
      ? Object.entries(doc as Record<string, unknown>)
          .filter(([k, v]) => k !== "sources" && v !== null && typeof v === "object")
          .map(([k, v]) => ({ ref: rel.replace(/^data\//, "").replace(/\.json$/, ""), [k]: v }))
      : (doc.records ?? doc.entries ?? []);
    for (const r of recs) {
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
  const wxPath = join(root, WEATHER_LINKS_PATH);
  if (existsSync(wxPath)) {
    lanesRead++;
    try {
      const wx = JSON.parse(readFileSync(wxPath, "utf8")) as WxDoc;
      const add = (url: string, title: string, publisher: string, read: string, ref: string, field: string): void => {
        const n = normaliseUrl(url);
        const id = sourceId(n);
        const a: Acc = acc.get(id) ?? { url: n, rows: [], used: new Map<string, SourceUsedBy>() };
        a.rows.push({ id, url: n, title, publisher, kind: "official", read });
        a.used.set(`${WEATHER_LINKS_PATH}\u0000${ref}\u0000${field}`, { file: WEATHER_LINKS_PATH, ref, field });
        acc.set(id, a);
        rows++;
      };
      const pub = (k: string): string => wx.publishers?.[k]?.name ?? k;
      for (const t of wx.trips ?? []) {
        for (const l of t.links) add(l.url, `${l.label} (${wx.publishers?.[l.publisher]?.short ?? l.publisher})`, pub(l.publisher), l.check.read, `weather-links/${t.trip}`, `weather.${l.kind}`);
        const fp = t.links[0]?.publisher;
        add(t.fallback.url, `Weather (${wx.publishers?.[fp ?? ""]?.short ?? fp ?? "official"})`, pub(fp ?? ""), t.fallback.check.read, `weather-links/${t.trip}`, "weather.fallback");
      }
      for (const [k, p] of Object.entries(wx.publishers ?? {})) if (p.home) add(p.home, p.name, p.name, wx.researched ?? "2026-10-26", `weather-links/publishers/${k}`, "weather.home");
    } catch (e) {
      problems.push({ file: WEATHER_LINKS_PATH, message: `not valid JSON or not weather-links/1: ${(e as Error).message}` });
    }
  }
  const entries: SourceEntry[] = [];
  for (const [id, a] of acc) {
    const reads = a.rows.map((r) => r.read).sort();
    const used = [...a.used.values()].sort((x, y) => cmp(x.file, y.file) || cmp(x.ref, y.ref) || cmp(x.field, y.field));
    const kinds = a.rows.map((r) => KIND_MAP[r.kind ?? ""] ?? "reference");
    const link = links.links[id];
    const local = !isWebUrl(a.url);
    entries.push({
      id,
      url: a.url,
      title: mostCommon(a.rows.map((r) => r.title ?? r.publisher ?? a.url)),
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
  return { registry: { schema: "sources/1", entries }, problems, lanes: lanesRead, rows };
}

export const registryText = (r: SourceRegistry): string => JSON.stringify(r, null, 2) + "\n";
