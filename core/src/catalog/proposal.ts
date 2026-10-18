// The catalog proposal document (catalog-proposal/1): what a research sidecar would change in the catalog, one change
// per row, each with its before and after, the sources behind it and whether policy lets it through without review.
// Stored at data/catalog/proposals/<id>.json and read by /review/. (The trip proposals of 5.4 are proposal/1.)
import { z } from "zod";
import * as E from "../schema/enums.ts";

const evidence = z.strictObject({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  publisher: z.string(),
  kind: z.enum(E.SOURCE_KIND),
  read: z.string(),
});

const fieldChange = z.strictObject({
  field: z.string(),
  kind: z.enum(["fill", "replace", "alternative", "conflict", "corroborate", "link", "gap"]),
  before: z.unknown(),
  after: z.unknown(),
  incoming: z.unknown(),
  against: z.strictObject({ kind: z.string(), read: z.string() }).optional(),
});

const matchInfo = z.strictObject({
  kind: z.enum(["same", "possible", "new"]),
  by: z.string().nullable(),
  similarity: z.number().nullable(),
  distance_m: z.number().nullable(),
  candidates: z.array(z.strictObject({ id: z.string(), by: z.string(), similarity: z.number(), distance_m: z.number().nullable(), kind: z.enum(["same", "possible"]) })),
});

export const catalogChange = z.strictObject({
  change_id: z.string().regex(/^ch-\d{3,}$/),
  op: z.enum(["add", "edit"]),
  entity: z.enum(["trails", "activities", "stays", "eateries", "offers", "offer_prices", "legs", "area_guides"]),
  id: z.string().min(1),
  area_id: z.string().nullable(),
  /** what to call it in the review: the row's name */
  name: z.string(),
  /** add: null. edit: the old value of each changed field */
  before: z.record(z.string(), z.unknown()).nullable(),
  /** add: the row as research supplied it (defaults are filled when it is written). edit: the new value of each changed field */
  after: z.record(z.string(), z.unknown()),
  fields: z.array(fieldChange),
  sources: z.array(evidence),
  fact_keys: z.array(z.string()),
  auto: z.boolean(),
  reason: z.string(),
  /** what to look at first: duplicate, conflict, sensitive, price-jump, incomplete, retired, low */
  flags: z.array(z.string()),
  status: z.enum(["open", "applied", "rejected", "superseded"]),
  match: matchInfo.nullable(),
  duplicate_of: z.string().nullable(),
  /** applying one of these supersedes the others (add as new versus treat as the same row) */
  excludes: z.array(z.string()),
  depends_on: z.array(z.string()),
  missing: z.array(z.string()),
  question: z.string().nullable(),
  warnings: z.array(z.string()),
  /** edit: the lifecycle of the row today, so the review can show raw, proposed, verified or stale. add: null (it will land proposed, stated). */
  current: z.strictObject({ review_status: z.string(), confidence: z.string(), last_verified: z.string().nullable() }).nullable(),
  applied: z.strictObject({ at: z.string(), actor: z.string(), seq: z.array(z.number().int()) }).nullable(),
});

export const catalogProposal = z.strictObject({
  schema: z.literal("catalog-proposal/1"),
  id: z.string().min(1),
  created: z.string(),
  actor: z.string(),
  source: z.strictObject({ sidecar: z.string(), lane: z.string(), researched: z.string() }),
  status: z.enum(["open", "partial", "applied", "rejected"]),
  notes: z.array(z.string()),
  changes: z.array(catalogChange),
});

export type CatalogChange = z.infer<typeof catalogChange>;
export type CatalogProposal = z.infer<typeof catalogProposal>;
export type ProposalFieldChange = z.infer<typeof fieldChange>;

export function settle(p: CatalogProposal): void {
  const st = p.changes.map((c) => c.status);
  p.status = st.every((s) => s === "open") ? "open"
    : st.every((s) => s === "rejected" || s === "superseded") ? "rejected"
    : st.every((s) => s !== "open") ? "applied" : "partial";
}
