// Content hashes, record ids and run ids of a seed row (spec 6.3). Pure.
//
// The content hash of a row is the sha256 of its canonical JSON: keys sorted by code point at every depth, no white space (the
// catalogue revision's canonicalJson), set-like arrays sorted, geometry as WKT with SEED_COORD_DECIMALS, and the STAMP paths
// removed. The engine hashes the row it would write and the row it reads back over THE SAME COLUMNS (the columns the seed writes),
// so a column the database fills on its own (created_at defaults) is never in either side.
//
// Numbers: JSON.parse reads `6.0` and `6` as the same number, so they hash the same; the seed is compared as values, not as bytes.
import { createHash } from "node:crypto";
import { SEED_COORD_DECIMALS } from "../config/database.ts";
import { canonicalJson } from "../catalogue/revision.ts";
import { RUN_ID_RE } from "../schema/rowMeta.ts";
import { stampImportedFrom } from "../normalise/stamp.ts";
import { SeedContractError, assertSeedTable, isStampedTable, type SeedTableSpec } from "./contract.ts";

/**
 * Paths that change on every write and are never part of the content hash. `meta.run_id`, `meta.imported_at` and `updated_at` are
 * the spec's three. `meta.imported_from` and `meta.first_run_id` are stamps too: a file's sha256 moves when ANY record in it
 * changes, and hashing it would show every row of an edited file as updated (one town edit must be one update). So imported_from
 * means "the file version that last changed this row". `version` and `dataset_file.loaded_at` are counters the engine writes.
 */
export const HASH_EXCLUDED_PATHS: readonly string[] = [
  "updated_at", "version", "loaded_at", "meta.run_id", "meta.first_run_id", "meta.imported_at", "meta.imported_from",
];

export const sha256Hex = (text: string): string => createHash("sha256").update(text).digest("hex");

type Row = Record<string, unknown>;

function specOf(table: string | SeedTableSpec): SeedTableSpec {
  return typeof table === "string" ? assertSeedTable(table) : table;
}

/** A coordinate as fixed decimals with trailing zeros removed: deterministic, never an exponent, never `-0`. */
export function formatCoord(n: number, decimals = SEED_COORD_DECIMALS): string {
  if (!Number.isFinite(n)) throw new Error("seed hash: a coordinate is not a finite number");
  let s = n.toFixed(decimals);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s === "-0" ? "0" : s;
}

type Pos = readonly number[];
const pos = (p: Pos): string => p.map((n) => formatCoord(n)).join(" ");
const ring = (r: readonly Pos[]): string => `(${r.map(pos).join(",")})`;
const poly = (p: readonly (readonly Pos[])[]): string => `(${p.map(ring).join(",")})`;

/**
 * The canonical WKT of a geometry: a GeoJSON geometry object, or a WKT string (its numbers are reformatted). Null stays null.
 * Supports what the schema stores: Point, LineString, Polygon, MultiPolygon.
 */
export function geometryWkt(g: unknown): string | null {
  if (g === null || g === undefined) return null;
  if (typeof g === "string") {
    return g.trim().replace(/^SRID=\d+;/i, "").replace(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi, (m) => formatCoord(Number(m))).replace(/\s+/g, " ").toUpperCase();
  }
  const o = g as { type?: string; coordinates?: unknown };
  switch (o.type) {
    case "Point":
      return `POINT(${pos(o.coordinates as Pos)})`;
    case "LineString":
      return `LINESTRING(${(o.coordinates as Pos[]).map(pos).join(",")})`;
    case "Polygon":
      return `POLYGON${poly(o.coordinates as Pos[][])}`;
    case "MultiPolygon":
      return `MULTIPOLYGON(${(o.coordinates as Pos[][][]).map(poly).join(",")})`;
    default:
      throw new Error(`seed hash: unsupported geometry type ${String(o.type)}`);
  }
}

function dropPath(row: Row, path: string): void {
  const [head, ...rest] = path.split(".");
  if (!head || !(head in row)) return;
  if (rest.length === 0) {
    delete row[head];
    return;
  }
  const child = row[head];
  if (child && typeof child === "object" && !Array.isArray(child)) {
    const copy = { ...(child as Row) };
    dropPath(copy, rest.join("."));
    row[head] = copy;
  }
}

/** The row as it is hashed: stamps removed, set columns sorted, geometry as canonical WKT. Never mutates the input. */
export function canonicalRow(table: string | SeedTableSpec, row: Row): Row {
  const spec = specOf(table);
  const out: Row = { ...row };
  for (const p of HASH_EXCLUDED_PATHS) dropPath(out, p);
  for (const c of spec.setColumns ?? []) {
    const v = out[c];
    if (Array.isArray(v)) out[c] = [...v].map((x) => [canonicalJson(x), x] as const).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, x]) => x);
  }
  for (const c of spec.geometryColumns ?? []) if (c in out) out[c] = geometryWkt(out[c]);
  return out;
}

/** The content hash of one row (hex sha256). The same row built twice hashes the same; stamps never move it. */
export function contentHash(table: string | SeedTableSpec, row: Row): string {
  return sha256Hex(canonicalJson(canonicalRow(table, row)));
}

/** The record id the plan and the drift report print: the key value, or the canonical JSON array of a composite key. */
export function rowId(table: string | SeedTableSpec, row: Row): string {
  const spec = specOf(table);
  const values = spec.key.map((k) => {
    const v = row[k];
    if (v === undefined || v === null) throw new Error(`seed: ${spec.table} row has no ${k}`);
    return v;
  });
  return values.length === 1 ? String(values[0]) : canonicalJson(values);
}

/** A stable id from natural parts, for tables whose key is not in the JSON (links, media, gaps, changes): `<prefix>-<16 hex>`. */
export function derivedId(prefix: string, parts: readonly unknown[]): string {
  if (!/^[a-z]{2,8}$/.test(prefix)) throw new Error("seed: derivedId prefix must be 2 to 8 lowercase letters");
  return `${prefix}-${sha256Hex(canonicalJson(parts)).slice(0, 16)}`;
}

/**
 * The hash of a whole table: the sha256 of `<record id>\t<content hash>\n` lines sorted by record id. Two tables with the same
 * rows hash the same whatever order they were read in.
 */
export function tableHash(entries: Iterable<readonly [string, string]>): string {
  const lines = [...entries].map(([id, h]) => `${id}\t${h}\n`).sort();
  return sha256Hex(lines.join(""));
}

const SHA_RE = /^[0-9a-f]{40}$/;

/** The run id of a seed or sync: `seed-<UTC yyyymmddThhmmssZ>-<first 12 of the commit>`; it satisfies RowMeta's RUN_ID_RE. */
export function seedRunId(commit: string, at: Date): string {
  if (!SHA_RE.test(commit)) throw new Error("seed: the commit must be a full 40-hex sha");
  const stamp = at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const id = `seed-${stamp}-${commit.slice(0, 12)}`;
  if (!RUN_ID_RE.test(id)) throw new Error("seed: run id does not match RUN_ID_RE");
  return id;
}

/**
 * The meta block of a row the engine writes: the row's own meta (from the JSON) plus run_id, imported_from {file, sha256} and
 * imported_at. The normaliser's stampImportedFrom, so there is one stamping rule. Only for tables that carry meta.
 */
export function stampSeedMeta(table: string, meta: Row | undefined, file: string, fileText: string, runId: string, at: Date): Row {
  assertSeedTable(table);
  if (!isStampedTable(table)) throw new SeedContractError("E_SEED_NO_META", `${table} has no meta column; its run is recorded in the run record only`);
  return stampImportedFrom(meta, file, fileText, runId, at);
}
