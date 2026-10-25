// What the LOADER stamps on a row (spec 3.3): `imported_from` is the repository path and the sha256 of the file read, `imported_at`
// the time. The normaliser does not write them into the JSON files: a hash of a file cannot sit inside the file it hashes without
// changing at once. These helpers are for the loader (RIS-L) and for tests; they return a new meta block and never mutate.
import { createHash } from "node:crypto";
import type { Obj } from "./common.ts";

export const sha256 = (text: string | Uint8Array): string => createHash("sha256").update(text).digest("hex");

/** `meta` with `run_id` and `imported_from` set to the file the loader read. A key already in `meta` is replaced (the loader owns these). */
export function stampImportedFrom(meta: Obj | undefined, file: string, text: string, runId: string, at?: Date): Obj {
  return { schema_version: 1, ...(meta ?? {}), run_id: runId, imported_from: { file, sha256: sha256(text) }, ...(at ? { imported_at: at.toISOString() } : {}) };
}
