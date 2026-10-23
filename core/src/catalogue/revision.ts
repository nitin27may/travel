// `revision()` (D-B6; schema diff 13.1 item 6): the SHA-256 of the canonical JSON of what a store serves, the dataset plus the slug
// registry. Content only: never a file's mtime, never a build time, never a process id, so the same data in two processes (or in
// JsonStore and SupabaseStore, which reads it from `catalogue_meta`) gives the same revision, and every ETag follows the data.
import { createHash } from "node:crypto";
import { compareCodePoints } from "./sortKey.ts";

/**
 * JSON with object keys sorted by code point at every depth, no white space. Arrays keep their order (order is data). `undefined`
 * members are dropped as JSON.stringify drops them; a non-finite number or a value JSON cannot hold (a function, a symbol, a bigint,
 * a Map) is an error, so a store cannot hash something it would not serve.
 */
export function canonicalJson(value: unknown): string {
  return encode(value, "$");
}

function encode(v: unknown, path: string): string {
  if (v === null) return "null";
  switch (typeof v) {
    case "string":
      return JSON.stringify(v);
    case "boolean":
      return v ? "true" : "false";
    case "number":
      if (!Number.isFinite(v)) throw new Error(`canonicalJson: ${path} is not a finite number`);
      return JSON.stringify(v);
    case "object": {
      if (Array.isArray(v)) return `[${v.map((x, i) => (x === undefined ? "null" : encode(x, `${path}[${i}]`))).join(",")}]`;
      const proto = Object.getPrototypeOf(v);
      if (proto !== Object.prototype && proto !== null) throw new Error(`canonicalJson: ${path} is not a plain object`);
      const keys = Object.keys(v as object).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort(compareCodePoints);
      return `{${keys.map((k) => `${JSON.stringify(k)}:${encode((v as Record<string, unknown>)[k], `${path}.${k}`)}`).join(",")}}`;
    }
    default:
      throw new Error(`canonicalJson: ${path} is a ${typeof v}, which JSON cannot hold`);
  }
}

/**
 * Everything a store serves, as one object (review R-7). The revision hashes THIS, so an edit to any input moves every ETag:
 *   dataset    the public dataset (places, trips, their pages; for JsonStore the object createPublicData() builds)
 *   slugs      the slug registry (data/catalogue/slugs.json)
 *   globe      every globe file the store reads for globeTree/Pins/Card/Feature/Line/City (index, pins, cards, gazetteer, lines)
 *   towns      the towns layer (data/reference/towns/*.json), null until META-2
 *   vocab      the parser vocabulary (search-vocab/1), the search index parts
 *   citations  the source-registry entries the details cite (data/sources/registry.json, as served)
 * JsonStore builds it once per load from what it holds in memory (parsed JSON, not file bytes, so no mtime or whitespace moves it).
 * SupabaseStore's loader builds the same object from the same files, writes `revisionOf()` to `catalogue_meta` in the SAME transaction
 * as the projections, and the store reads it in the same snapshot as the data (review R-8, store.ts).
 */
export interface ServedSnapshot {
  dataset: unknown;
  slugs: unknown;
  globe: unknown;
  towns: unknown;
  vocab: unknown;
  citations: unknown;
}

/** A snapshot with every input named; a missing layer is null, never absent, so adding it later visibly changes the hash. */
export function servedSnapshot(parts: Partial<ServedSnapshot> & Pick<ServedSnapshot, "dataset" | "slugs">): ServedSnapshot {
  return { dataset: parts.dataset, slugs: parts.slugs, globe: parts.globe ?? null, towns: parts.towns ?? null, vocab: parts.vocab ?? null, citations: parts.citations ?? null };
}

/** The revision of a served snapshot: SHA-256 hex of its canonical JSON. */
export function revisionOf(served: ServedSnapshot): string {
  return createHash("sha256").update(canonicalJson(served)).digest("hex");
}

// ---- the revision from inputs (D-E4, API-3; store.ts A30) ---------------------------------------------------------------------
//
// Hashing what a store SERVES costs one pass over every built detail (2.9 s on the first call at 10,000 places, verify-GB 16). The
// revision is instead the hash of what the store is BUILT FROM: the build id (which changes with any code change, so a code change that
// moves an output moves the ETag) and the content hash of every input file the store reads. Same build, same files: same revision in
// any process. Content only, never an mtime (case K10).

/** One input file of a store: a repository-relative path with forward slashes, and the SHA-256 hex of its bytes. */
export interface RevisionInput {
  path: string;
  sha256: string;
}

/** What a JSON-backed store's revision is computed from (A30). */
export interface RevisionInputs {
  /** the build's id: Next's BUILD_ID, or `TRAVEL_BUILD_ID`, or the fixed `dev` outside a build (A30) */
  buildId: string;
  files: RevisionInput[];
}

/** SHA-256 hex of a file's bytes, the `sha256` of a RevisionInput. */
export function fileSha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * The revision of a build and its inputs: SHA-256 of the canonical JSON `{buildId, files}` with the files sorted by path in code-point
 * order. A path listed twice, a non-relative path or a malformed hash is an error, so a loader cannot hash an input set it did not mean.
 */
export function inputRevision(inputs: RevisionInputs): string {
  const seen = new Set<string>();
  for (const f of inputs.files) {
    if (seen.has(f.path)) throw new Error(`inputRevision: ${f.path} is listed twice`);
    if (f.path.startsWith("/") || f.path.includes("\\") || f.path.split("/").includes("..")) throw new Error(`inputRevision: ${f.path} is not a repository-relative path`);
    if (!/^[0-9a-f]{64}$/.test(f.sha256)) throw new Error(`inputRevision: ${f.path} has no SHA-256`);
    seen.add(f.path);
  }
  const files = [...inputs.files].sort((a, b) => compareCodePoints(a.path, b.path)).map((f) => ({ path: f.path, sha256: f.sha256 }));
  return createHash("sha256").update(canonicalJson({ buildId: inputs.buildId, files })).digest("hex");
}
