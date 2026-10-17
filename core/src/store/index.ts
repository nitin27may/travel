// Storage adapters (plan 5.2). Operations never touch the file system: the runner reads and writes through a Store.
//   FileStore    data/** in a working tree (Phase 1, the ops CLI and the local API)
//   MemoryStore  tests and the browser draft
// D1Store or GitStore arrive in Phase 2 (decision D28).
import { createHash } from "node:crypto";

export interface Store {
  /** repository root that holds data/locations, data/catalog and research/, used to resolve references while validating */
  readonly refRoot: string;
  read(path: string): Promise<Uint8Array | null>;
  /** write the bytes; with expectedRev, fail with StaleError unless the file's current rev equals it (null = must not exist) */
  write(path: string, bytes: Uint8Array, expectedRev?: string | null): Promise<void>;
  /** delete a file; no error when it is already gone */
  remove(path: string): Promise<void>;
  /** sha256 hex of the bytes, null when the file does not exist */
  rev(path: string): Promise<string | null>;
  /** every file whose path starts with the prefix, sorted */
  list(prefix: string): Promise<string[]>;
  /** read-only access to reference files outside data/ (research/**), for research.add_ref; absent in stores that cannot reach them */
  readRef?(path: string): Promise<Uint8Array | null>;
}

/** research/ paths only, no climbing out */
export function checkRefPath(path: string): string {
  const norm = path.replace(/\\/g, "/");
  if (!norm.startsWith("research/") || norm.split("/").some((p) => p === ".." || p === "." || p === "")) {
    throw new StoreError(`reference files live under research/, got "${path}"`);
  }
  return norm;
}

export class StaleError extends Error {
  readonly path: string;
  readonly rev: string | null;
  constructor(path: string, rev: string | null) {
    super(`${path} changed since it was read (rev ${rev ?? "none"})`);
    this.path = path;
    this.rev = rev;
  }
}

export class StoreError extends Error {}

const enc = new TextEncoder();
const dec = new TextDecoder();
export const toBytes = (s: string): Uint8Array => enc.encode(s);
export const toText = (b: Uint8Array): string => dec.decode(b);
export const sha256 = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex");

/** Paths are repository-relative with forward slashes, under data/. Anything else is refused. */
export function checkPath(path: string): string {
  const norm = path.replace(/\\/g, "/");
  const parts = norm.split("/");
  if (norm.startsWith("/") || parts.some((p) => p === ".." || p === "." || p === "") || parts[0] !== "data" || parts.length < 2) {
    throw new StoreError(`the store only reads and writes paths under data/, got "${path}"`);
  }
  return norm;
}

export { FileStore } from "./file.ts";
export { MemoryStore } from "./memory.ts";
export { serializeTrip, serializeJson } from "./tripWriter.ts";
