// capture-changeset/1 (docs/v2/features/catalogue-intake-and-storage.md 5.3, R-133; RIS-C): a proposed patch to records in lane
// files another lane owns. A research batch that may not edit a file (one record per ref across lane files, E_SUIT_DUP_REF) writes
// its proposal here, under data/capture/changesets/<run>.json; the coordinator applies or rejects each change in the owning file,
// and the loader writes the file into the `changeset` and `change` tables.
//
// Subset rule (../meta.ts): no refine, transform or lazy schemas. Cross-field rules (the target file is a lane file, a value is given
// for set and add and absent for remove, every src id resolves) are core/src/validate/changeset.ts.
import { z } from "zod";
import { json, pattern, table, text, date } from "../meta.ts";
import { sourceRow } from "../suitability.ts";

export const CAPTURE_CHANGESET_SCHEMA_ID = "capture-changeset/1";
/** set: replace the value at path; add: append to the list at path (a link, a hazard); remove: delete the value at path. */
export const CHANGE_OP = ["set", "add", "remove"] as const;
/** The lane files a change may target: capture, suitability and relevance lane files (never the ledger, budget, points or registry). */
export const CHANGE_TARGET_RE = /^data\/(?:capture|suitability|relevance)\/(?!changesets\/|runs\/|splits\/)[a-z0-9]+(?:-[a-z0-9]+)*\/[A-Za-z0-9._-]+\.json$/;

export const change = z.strictObject({
  /** the lane file that holds the record, repository-relative */
  file: z.string().min(1),
  ref: z.string().min(1),
  op: z.enum(CHANGE_OP),
  /** a dot path into the record, as the migration ledger walks it (`suitability.access_season`) */
  path: z.string().min(1),
  /** the new value (a Val for a value path); absent for remove */
  value: z.unknown().optional(),
  /** one sentence: why the change is right, in our own words */
  why: z.string().min(1).max(280),
});

export const changesetDoc = z.strictObject({
  schema: z.literal(CAPTURE_CHANGESET_SCHEMA_ID),
  /** the run or batch that proposed it (a capture-run/1 id or DATA-D3a) */
  run: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/),
  by: z.string().min(1),
  on: z.iso.date(),
  sources: z.array(sourceRow),
  changes: z.array(change).min(1),
});

export const capture_changeset = table("capture_changeset", {
  schema: pattern(/^capture-changeset\/1$/),
  run: text({ pattern: /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/ }),
  by: text({ min: 1 }),
  on: date(),
  sources: json(z.array(sourceRow)),
  changes: json(z.array(change).min(1)),
}, { family: "sidecar", pk: [], single: true, ui: { label: "Capture changeset" } });

export type Change = z.infer<typeof change>;
export type ChangesetDoc = z.infer<typeof changesetDoc>;
