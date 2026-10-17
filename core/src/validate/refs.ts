// Cross-file reference index. Targets are resolved by loading the referenced files under `root`,
// never by $ref across files (plan 2.5).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

type Doc = Record<string, unknown>;

/** sqlName.column -> where its values come from */
const LOCATION_KEYS: Record<string, [string, string]> = {
  "countries.code": ["countries", "code"],
  "regions.id": ["regions", "id"],
  "areas.id": ["areas", "id"],
  "places.id": ["places", "id"],
  "collections.id": ["collections", "id"],
};
const CATALOG_DIRS: Record<string, string> = {
  "trails.id": "trails",
  "activities.id": "activities",
  "stays.id": "stays",
  "eateries.id": "eateries",
  "offers.id": "offers",
  "legs.id": "legs",
};
const CATALOG_TABLE: Record<string, string> = {
  "trails.id": "trails",
  "activities.id": "activities",
  "stays.id": "stays",
  "eateries.id": "eateries",
  "offers.id": "offers",
  "legs.id": "legs",
};

function readJson(path: string): Doc | null {
  try {
    const v = JSON.parse(readFileSync(path, "utf8"));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Doc) : null;
  } catch {
    return null;
  }
}

function jsonFiles(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir).filter((n) => n.endsWith(".json")).sort().map((n) => join(dir, n));
}

export class Refs {
  readonly root: string;
  private excluded = new Set<string>();
  private extra: { kind: "locations" | "catalog"; doc: Doc }[] = [];
  private cache = new Map<string, Set<string>>();
  private tagAlias: Map<string, string | null> | null = null;

  constructor(root: string) {
    this.root = resolve(root);
  }

  /** Treat the file at `abs` as replaced by the in-memory document passed to addDoc. */
  exclude(abs: string): void {
    this.excluded.add(resolve(abs));
    this.cache.clear();
    this.tagAlias = null;
  }

  addDoc(kind: "locations" | "catalog", doc: Doc): void {
    this.extra.push({ kind, doc });
    this.cache.clear();
    this.tagAlias = null;
  }

  exists(rel: string): boolean {
    return existsSync(join(this.root, rel));
  }

  private locationDocs(): Doc[] {
    const dir = join(this.root, "data", "locations");
    const files = jsonFiles(dir).filter((f) => !this.excluded.has(f));
    const docs = files.map(readJson).filter((d): d is Doc => d !== null);
    for (const e of this.extra) if (e.kind === "locations") docs.push(e.doc);
    return docs;
  }

  private catalogDocs(dirName: string): Doc[] {
    const dir = join(this.root, "data", "catalog", dirName);
    const files = jsonFiles(dir).filter((f) => !this.excluded.has(f));
    const docs = files.map(readJson).filter((d): d is Doc => d !== null);
    for (const e of this.extra) if (e.kind === "catalog") docs.push(e.doc);
    return docs;
  }

  private collect(docs: Doc[], table: string, col: string): Set<string> {
    const out = new Set<string>();
    for (const d of docs) {
      const rows = d[table];
      if (!Array.isArray(rows)) continue;
      for (const r of rows) if (r && typeof r === "object" && typeof (r as Doc)[col] === "string") out.add((r as Doc)[col] as string);
    }
    return out;
  }

  private loadTagAlias(): Map<string, string | null> {
    if (this.tagAlias) return this.tagAlias;
    const map = new Map<string, string | null>();
    const vocab = readJson(join(this.root, "data", "vocab", "tags.json"));
    let rows: unknown[] = [];
    if (vocab && !this.excluded.has(join(this.root, "data", "vocab", "tags.json"))) {
      rows = Array.isArray(vocab.tags) ? vocab.tags : [];
    } else {
      for (const d of this.locationDocs()) if (Array.isArray(d.tags)) rows.push(...d.tags);
    }
    for (const r of rows) {
      if (r && typeof r === "object" && typeof (r as Doc).id === "string") {
        const a = (r as Doc).alias_of;
        map.set((r as Doc).id as string, typeof a === "string" ? a : null);
      }
    }
    this.tagAlias = map;
    return map;
  }

  /** Is `value` a row of `table.col` somewhere under root (plus in-memory documents)? */
  has(table: string, col: string, value: string): boolean {
    const key = `${table}.${col}`;
    if (key === "tags.id") return this.loadTagAlias().has(value);
    let set = this.cache.get(key);
    if (!set) {
      if (LOCATION_KEYS[key]) {
        const [t, c] = LOCATION_KEYS[key]!;
        set = this.collect(this.locationDocs(), t, c);
      } else if (CATALOG_DIRS[key]) {
        set = this.collect(this.catalogDocs(CATALOG_DIRS[key]!), CATALOG_TABLE[key]!, "id");
      } else {
        throw new Error(`no reference source for ${key}`);
      }
      this.cache.set(key, set);
    }
    return set.has(value);
  }

  /** Alias target of a tag, or null for a canonical tag, or undefined for an unknown tag. */
  tagAliasOf(id: string): string | null | undefined {
    return this.loadTagAlias().get(id);
  }

  knows(table: string, col: string): boolean {
    const key = `${table}.${col}`;
    return key === "tags.id" || key in LOCATION_KEYS || key in CATALOG_DIRS;
  }
}
