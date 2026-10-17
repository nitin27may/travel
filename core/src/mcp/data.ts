// Read-only access to the repository data for the MCP server and the operation handlers: trips, catalog files and the
// locations store, loaded from disk on each call (the files are small and the server is a local process).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export type Row = Record<string, any>;
export type Doc = Record<string, any>;

export function readJson(path: string): Doc | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Doc;
  } catch {
    return null;
  }
}

function listJson(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir).filter((n) => n.endsWith(".json")).sort().map((n) => join(dir, n));
}

export function tripSlugs(root: string): string[] {
  const dir = join(root, "data", "trips");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => existsSync(join(dir, n, "trip.json"))).sort();
}

export function loadTrip(root: string, slug: string): Doc | null {
  return readJson(join(root, "data", "trips", slug, "trip.json"));
}

/** the locations store as one document: parts merged for the by-country layout, the tag vocabulary attached */
export function loadLocations(root: string): Doc {
  const dir = join(root, "data", "locations");
  const store = readJson(join(dir, "locations.json")) ?? {};
  if (store.layout === "by-country" && Array.isArray(store.parts)) {
    for (const cc of store.parts) {
      const part = readJson(join(dir, `${cc}.json`));
      if (!part) continue;
      for (const [k, v] of Object.entries(part)) if (Array.isArray(v)) store[k] = [...(store[k] ?? []), ...v];
    }
  }
  const vocab = readJson(join(root, "data", "vocab", "tags.json"));
  if (!store.tags && vocab && Array.isArray(vocab.tags)) store.tags = vocab.tags;
  return store;
}

/** catalog entity folder -> the tables found in its files */
const CATALOG_DIRS: Record<string, string[]> = {
  trails: ["trails"], activities: ["activities"], stays: ["stays"], eateries: ["eateries"],
  offers: ["offers", "offer_prices"], legs: ["legs"], areas: ["area_guides"],
};
export const CATALOG_TABLE_DIR: Record<string, string> = Object.fromEntries(
  Object.entries(CATALOG_DIRS).flatMap(([dir, tables]) => tables.map((t) => [t, dir])),
);

export function loadCatalogRows(root: string, table: string): Row[] {
  if (table === "backlog") {
    const doc = readJson(join(root, "data", "catalog", "backlog.json"));
    return Array.isArray(doc?.backlog) ? doc!.backlog : [];
  }
  if (table === "catalog_changes") {
    const dir = join(root, "data", "catalog", "changes");
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter((n) => n.endsWith(".jsonl")).sort().flatMap((n) =>
      readFileSync(join(dir, n), "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as Row));
  }
  const dirName = CATALOG_TABLE_DIR[table];
  if (!dirName) return [];
  const out: Row[] = [];
  for (const f of listJson(join(root, "data", "catalog", dirName))) {
    const rows = readJson(f)?.[table];
    if (Array.isArray(rows)) out.push(...rows);
  }
  return out;
}

/** rows of "<family>.<table>"; trip rows across all trips carry `trip_id` */
export function loadRows(root: string, family: string, table: string): Row[] {
  if (family === "locations") {
    const rows = loadLocations(root)[table];
    return Array.isArray(rows) ? rows : [];
  }
  if (family === "catalog") return loadCatalogRows(root, table);
  if (family === "trip") {
    const out: Row[] = [];
    for (const slug of tripSlugs(root)) {
      const v = loadTrip(root, slug)?.[table];
      if (Array.isArray(v)) out.push(...v.map((r) => ({ trip_id: slug, ...r })));
      else if (v && typeof v === "object") out.push({ trip_id: slug, ...v });
    }
    return out;
  }
  return [];
}
