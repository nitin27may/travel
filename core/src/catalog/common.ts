// Shared pieces of the catalog pipeline (plan 0A.2): entity names, files, ids, text and geo helpers, the catalog loader
// and the writer. One implementation: the CLI, the operations, the local API and the tests all call these.
import { createHash } from "node:crypto";
import { tableOf } from "../schema/index.ts";
import type { Table } from "../schema/meta.ts";
import { toText } from "../store/index.ts";
import type { Store } from "../store/index.ts";

export type Row = Record<string, any>;

/** the tables a catalog row can belong to (offer_prices ride in the offers file) */
export const ENTITIES = ["trails", "activities", "stays", "eateries", "offers", "offer_prices", "legs", "area_guides"] as const;
export type Entity = (typeof ENTITIES)[number];
export const isEntity = (s: string): s is Entity => (ENTITIES as readonly string[]).includes(s);

/** the folder a table's file lives in */
export const FOLDER: Record<Entity, string> = {
  trails: "trails", activities: "activities", stays: "stays", eateries: "eateries", offers: "offers", offer_prices: "offers", legs: "legs", area_guides: "areas",
};
/** files hold these tables, in this order */
export const FILE_TABLES: Record<string, Entity[]> = {
  trails: ["trails"], activities: ["activities"], stays: ["stays"], eateries: ["eateries"], offers: ["offers", "offer_prices"], legs: ["legs"], areas: ["area_guides"],
};

export const filePath = (folder: string, cc: string): string => `data/catalog/${folder}/${cc}.json`;
export const proposalPath = (id: string): string => `data/catalog/proposals/${id}.json`;
export const changesPath = (at: string): string => `data/catalog/changes/${at.slice(0, 7)}.jsonl`;
export const BACKLOG_PATH = "data/catalog/backlog.json";
export const COVERAGE_PATH = "data/catalog/coverage.json";

export const countryOfArea = (areaId: string): string => areaId.split("/")[0]!;

/** the country file a row belongs to */
export function countryOfRow(entity: Entity, row: Row): string {
  if (entity === "legs") return countryOfArea(String(row.from_id));
  if (entity === "area_guides") return countryOfArea(String(row.id));
  if (entity === "offer_prices") throw new Error("an offer price lives in the file of its offer; look the offer up");
  return countryOfArea(String(row.area_id));
}

export const sha256hex = (s: string): string => createHash("sha256").update(s).digest("hex");

/** lg- plus the first 10 hex digits of the SHA-256 of from|to|mode (plan 2.3A) */
export const legId = (from: string, to: string, mode: string): string => "lg-" + sha256hex(`${from}|${to}|${mode}`).slice(0, 10);

// ----------------------------------------------------------------------------- text
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function slugify(s: string): string {
  return fold(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** names compared by the matcher: folded, lower case, punctuation as spaces */
export function nameKey(s: string): string {
  return fold(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (const w of nameKey(s).split(" ").filter(Boolean)) {
    const p = `  ${w} `;
    for (let i = 0; i + 3 <= p.length; i++) out.add(p.slice(i, i + 3));
  }
  return out;
}

/** pg_trgm style similarity: shared trigrams over all trigrams, 0 to 1 */
export function similarity(a: string, b: string): number {
  const x = trigrams(a);
  const y = trigrams(b);
  if (x.size === 0 || y.size === 0) return 0;
  let inter = 0;
  for (const t of x) if (y.has(t)) inter++;
  return inter / (x.size + y.size - inter);
}

// ----------------------------------------------------------------------------- geo
export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371008.8;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// ----------------------------------------------------------------------------- values
const isObj = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);

/** key-sorted JSON, for comparing values */
export function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
  if (typeof v === "number") return String(Math.round(v * 1e9) / 1e9);
  return JSON.stringify(v ?? null);
}
export const same = (a: unknown, b: unknown): boolean => canon(a) === canon(b);
export const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));
export const isEmpty = (v: unknown): boolean => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0) || (isObj(v) && Object.keys(v).length === 0);

// ----------------------------------------------------------------------------- source evidence
export interface Evidence {
  url: string;
  kind: string;
  read: string;
  title: string;
  publisher: string;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** host + path of a URL without query, fragment, "www." or a trailing slash: the key external ids match on */
export function urlKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "").toLowerCase()}${u.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return url.toLowerCase();
  }
}

export function rankOf(rank: readonly string[], kind: string): number {
  const i = rank.indexOf(kind);
  return i < 0 ? rank.length : i;
}

/** the strongest evidence: best kind first, then the newest read */
export function bestEvidence(rank: readonly string[], ev: Evidence[]): Evidence | null {
  if (ev.length === 0) return null;
  return [...ev].sort((a, b) => rankOf(rank, a.kind) - rankOf(rank, b.kind) || b.read.localeCompare(a.read) || a.url.localeCompare(b.url))[0]!;
}

// ----------------------------------------------------------------------------- loading
export interface CatalogFile {
  path: string;
  folder: string;
  cc: string;
  doc: Row;
}

/** every catalog row, loaded once. `files` is keyed by path; tables are views over the same docs. */
export class CatalogData {
  files = new Map<string, CatalogFile>();

  rows(entity: Entity): Row[] {
    const out: Row[] = [];
    for (const f of this.files.values()) if (FILE_TABLES[f.folder]!.includes(entity) && Array.isArray(f.doc[entity])) out.push(...f.doc[entity]);
    return out.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }

  fileOf(entity: Entity, cc: string): CatalogFile | undefined {
    return this.files.get(filePath(FOLDER[entity], cc));
  }

  /** the file a row lives in, found by its id */
  findRow(entity: Entity, id: string): { row: Row; file: CatalogFile } | null {
    for (const f of this.files.values()) {
      if (!FILE_TABLES[f.folder]!.includes(entity)) continue;
      const row = (f.doc[entity] as Row[] | undefined)?.find((r) => r.id === id);
      if (row) return { row, file: f };
    }
    return null;
  }

  /** the source rows of the file that holds a row */
  sourceOf(file: CatalogFile, id: string): Row | undefined {
    return (file.doc.sources as Row[]).find((s) => s.id === id);
  }
}

export async function readJson(store: Store, path: string): Promise<Row | null> {
  const b = await store.read(path);
  return b ? (JSON.parse(toText(b)) as Row) : null;
}

export async function loadCatalog(store: Store): Promise<CatalogData> {
  const data = new CatalogData();
  for (const p of await store.list("data/catalog/")) {
    const m = /^data\/catalog\/([a-z]+)\/([A-Z]{2})\.json$/.exec(p);
    if (!m || !(m[1]! in FILE_TABLES)) continue;
    data.files.set(p, { path: p, folder: m[1]!, cc: m[2]!, doc: JSON.parse(toText((await store.read(p))!)) });
  }
  return data;
}

export interface PlaceRef {
  id: string;
  area_id: string;
  name: string;
  kind: string;
  lat: number | null;
  lon: number | null;
  wikidata: string | null;
}

export interface Locations {
  areas: Row[];
  places: PlaceRef[];
}

/** places and areas from the laundry list (read only: tools/locations.py owns the writes) */
export async function loadLocations(store: Store): Promise<Locations> {
  const doc = await readJson(store, "data/locations/locations.json");
  if (!doc) return { areas: [], places: [] };
  return {
    areas: doc.areas ?? [],
    places: (doc.places ?? []).map((p: Row) => ({
      id: p.id, area_id: p.area_id, name: p.name, kind: p.kind, lat: p.lat ?? null, lon: p.lon ?? null, wikidata: p.wikidata ?? null,
    })),
  };
}

// ----------------------------------------------------------------------------- policy files
export interface Deps {
  /** tag id or alias -> canonical tag id */
  tags: Map<string, string>;
  difficulty: Row;
  policy: Row;
  freshness: Row;
  rank: string[];
}

export async function loadDeps(store: Store): Promise<Deps> {
  const tagDoc = (await readJson(store, "data/vocab/tags.json")) ?? { tags: [] };
  const tags = new Map<string, string>();
  for (const t of tagDoc.tags as Row[]) tags.set(t.id, t.alias_of ?? t.id);
  const difficulty = (await readJson(store, "data/schema/difficulty-map.json")) ?? { systems: [], effort: { bands: [] } };
  const policy = (await readJson(store, "data/catalog/policy.json")) ?? { rules: [], source_rank: [], promotion: {}, price_change_question_pct: 20 };
  const freshness = (await readJson(store, "data/schema/freshness.json")) ?? { classes: [] };
  return { tags, difficulty, policy, freshness, rank: policy.source_rank };
}

/** is a policy rule on? A missing rule counts as off, so a stripped policy never auto-accepts. */
export function ruleOn(policy: Row, id: string): boolean {
  const r = (policy.rules as Row[]).find((x) => x.id === id);
  return !!r && r.enabled === true && r.mode !== "owner-review";
}

// ----------------------------------------------------------------------------- writing
function tableFor(entity: Entity): Table {
  return tableOf("catalog", entity);
}

function orderRow(t: Table, row: Row): Row {
  const out: Row = {};
  for (const col of Object.keys(t.shape)) if (col in row) out[col] = row[col];
  for (const k of Object.keys(row)) if (!(k in out) && !k.startsWith("__")) out[k] = row[k];
  return out;
}

const idCmp = (a: Row, b: Row): number => {
  // offer prices: offer id, then the numeric suffix
  const [oa, na] = String(a.id).split("#");
  const [ob, nb] = String(b.id).split("#");
  if (oa !== ob) return oa! < ob! ? -1 : 1;
  return Number(na ?? 0) - Number(nb ?? 0) || (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);
};

/** canonical bytes of a catalog file: root keys in schema order, rows sorted by id, one row per line */
export function serializeCatalogFile(folder: string, doc: Row): string {
  const names = FILE_TABLES[folder]!;
  const entries: [string, unknown][] = [["schema_version", 1], ["country", doc.country]];
  for (const n of names) entries.push([n, ((doc[n] ?? []) as Row[]).map((r) => orderRow(tableFor(n), r)).sort(idCmp)]);
  const srcT = tableOf("catalog", "sources");
  entries.push(["sources", ((doc.sources ?? []) as Row[]).map((r) => orderRow(srcT, r)).sort((a, b) => String(a.id).localeCompare(String(b.id)))]);
  const lines = ["{"];
  entries.forEach(([k, v], i) => {
    const comma = i < entries.length - 1 ? "," : "";
    if (Array.isArray(v) && v.length > 0) {
      lines.push(`${JSON.stringify(k)}: [`);
      v.forEach((r, j) => lines.push(JSON.stringify(r) + (j < v.length - 1 ? "," : "")));
      lines.push(`]${comma}`);
    } else lines.push(`${JSON.stringify(k)}: ${JSON.stringify(v)}${comma}`);
  });
  lines.push("}");
  return lines.join("\n") + "\n";
}

export function emptyFile(folder: string, cc: string): Row {
  const doc: Row = { schema_version: 1, country: cc };
  for (const n of FILE_TABLES[folder]!) doc[n] = [];
  doc.sources = [];
  return doc;
}

/** the id of a source row in a file for this evidence, added when the URL is new */
export function ensureSource(doc: Row, ev: Evidence): string {
  const list: Row[] = doc.sources ?? (doc.sources = []);
  const hit = list.find((s) => s.url === ev.url);
  if (hit) return hit.id;
  const n = list.reduce((m, s) => Math.max(m, Number(String(s.id).slice(4))), 0) + 1;
  const id = `src-${String(n).padStart(4, "0")}`;
  list.push({ id, url: ev.url, title: ev.title, publisher: ev.publisher, kind: ev.kind, read: ev.read });
  return id;
}

/** a blank row of an entity: every column present, the safe default for each */
export function blankRow(entity: Entity, today: string): Row {
  const t = tableFor(entity);
  const enumDefaults: Row = {
    review_status: "proposed", confidence: "stated", licence: "own-words", accessibility: "unknown", kid_fit: "unknown", updated: today,
    limits_status: "gap", opens_kind: "unknown", sellout_kind: "unknown", same_day: "unknown",
  };
  const out: Row = {};
  for (const [col, schema] of Object.entries(t.shape)) {
    if (col in enumDefaults && !schema.safeParse(null).success) {
      out[col] = enumDefaults[col];
      continue;
    }
    if (schema.safeParse(null).success) out[col] = null;
    else {
      const guess = [[], {}, "", false, 0].find((g) => schema.safeParse(g).success);
      out[col] = guess === undefined ? null : clone(guess);
    }
  }
  if (entity === "legs") out.symmetric = false;
  return out;
}

/** the raw locations document (areas, regions, countries, full place rows with the common block) */
export async function loadLocationDoc(store: Store): Promise<Row> {
  return (await readJson(store, "data/locations/locations.json")) ?? { areas: [], regions: [], countries: [], places: [] };
}

/** every trip document under data/trips */
export async function loadTrips(store: Store): Promise<Row[]> {
  const out: Row[] = [];
  for (const p of await store.list("data/trips/")) {
    if (/^data\/trips\/[^/]+\/trip\.json$/.test(p)) out.push(JSON.parse(toText((await store.read(p))!)));
  }
  return out;
}
