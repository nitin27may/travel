// Refs of suitability/1 (spec 5.2) and the scope manifest.
//
// data/suitability/scope.json lists the 207 in-scope items of spec section 7 and every place slug. It is dumped from
// the public adapter by tools/suitability-scope/dump-scope.test.ts, because core/ cannot import web/.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface ScopeSource {
  protoId?: string;
  locationId?: string;
  legacy?: { folder: string; dataset: string; id: string };
}
export interface ScopeItem {
  ref: string;
  key: string | null;
  trip: string;
  kind: string;
  name: string;
  days: number[];
  source: ScopeSource;
}
export interface Scope {
  schema: "suitability-scope/1";
  places: string[];
  items: ScopeItem[];
}

export function scopePath(root: string): string {
  return join(root, "data", "suitability", "scope.json");
}

export function loadScope(root: string): Scope | null {
  const p = scopePath(root);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Scope;
  } catch {
    return null;
  }
}

const LEGACY_DATASETS = ["trails", "sights", "adventures"];

export class RefResolver {
  private scope: Scope | null;
  private places: Set<string>;
  private refs: Set<string>;
  private legacy = new Map<string, Set<string>>();

  private root: string;

  constructor(root: string, scope?: Scope | null) {
    this.root = root;
    this.scope = scope === undefined ? loadScope(root) : scope;
    this.places = new Set(this.scope?.places ?? []);
    this.refs = new Set((this.scope?.items ?? []).map((i) => i.ref));
  }

  private legacyIds(folder: string, dataset: string): Set<string> | null {
    const key = `${folder}/${dataset}`;
    const hit = this.legacy.get(key);
    if (hit) return hit;
    const p = join(this.root, "legacy", folder, "data", `${dataset}.json`);
    if (!existsSync(p)) return null;
    try {
      const rows = JSON.parse(readFileSync(p, "utf8")) as { id?: unknown }[];
      const ids = new Set(rows.map((r) => String(r.id)));
      this.legacy.set(key, ids);
      return ids;
    } catch {
      return null;
    }
  }

  /** null when the ref resolves, else the reason it does not. */
  why(ref: string): string | null {
    const m = /^([a-z]+)\/(.+)$/.exec(ref);
    if (!m) return "it does not start with place/, legacy/, trip/ or offer/";
    const [, form, rest] = m as unknown as [string, string, string];
    if (form === "place") {
      if (!this.scope) return "data/suitability/scope.json is missing (run the scope dump)";
      return this.places.has(rest) ? null : `no place page has the slug "${rest}"`;
    }
    if (form === "legacy") {
      const parts = rest.split("/");
      if (parts.length !== 3) return "a legacy ref is legacy/<folder>/<dataset>/<id>";
      const [folder, dataset, id] = parts as [string, string, string];
      if (!LEGACY_DATASETS.includes(dataset)) return `the dataset must be one of ${LEGACY_DATASETS.join(", ")}`;
      const ids = this.legacyIds(folder, dataset);
      if (!ids) return `legacy/${folder}/data/${dataset}.json does not exist`;
      return ids.has(id) ? null : `${dataset}.json has no row with id "${id}"`;
    }
    if (form === "trip") {
      if (!this.scope) return "data/suitability/scope.json is missing (run the scope dump)";
      return this.refs.has(ref) ? null : "that trip has no such item in scope.json";
    }
    if (form === "offer") {
      const parent = rest.split("#")[0] ?? "";
      if (!rest.includes("#")) return "an offer ref is offer/<parent ref>#<product>";
      return this.why(parent);
    }
    return `unknown ref form "${form}"`;
  }
}

/** Every suitability file of a trip, parsed. */
export function tripFiles(root: string, trip: string): { path: string; doc: { records?: { ref: string }[] } }[] {
  const dir = join(root, "data", "suitability", trip);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith(".json"))
    .sort()
    .map((n) => ({ path: join(dir, n), doc: JSON.parse(readFileSync(join(dir, n), "utf8")) as { records?: { ref: string }[] } }));
}

/** Scope refs of a trip that no file of the trip covers. */
export function missingCoverage(root: string, trip: string): string[] {
  const scope = loadScope(root);
  if (!scope) return [];
  const have = new Set(tripFiles(root, trip).flatMap((f) => (f.doc.records ?? []).map((r) => r.ref)));
  return scope.items.filter((i) => i.trip === trip && !have.has(i.ref)).map((i) => i.ref);
}

/** A migrated*.json file holds what S0 moved out of the old fields; any lane file for the same ref supersedes it. */
export const isMigratedFile = (path: string): boolean => /(^|\/)migrated[^/]*\.json$/.test(path);

/**
 * Refs that appear in more than one file of a trip: ref -> files. A record in a migrated file is overridden by a lane
 * file that carries the same ref, so that pair is not a duplicate; two lane files with one ref are.
 */
export function duplicateRefsAcrossFiles(root: string, trip: string): Map<string, string[]> {
  const seen = new Map<string, string[]>();
  for (const f of tripFiles(root, trip)) {
    if (isMigratedFile(f.path)) continue;
    for (const ref of new Set((f.doc.records ?? []).map((r) => r.ref))) seen.set(ref, [...(seen.get(ref) ?? []), f.path]);
  }
  return new Map([...seen].filter(([, files]) => files.length > 1));
}
