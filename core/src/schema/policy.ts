// data/catalog/policy.json: the auto-accept rules of plan 0A.2. The owner switches each off here.
import { z } from "zod";
import * as E from "./enums.ts";
import { date, int, json, table } from "./meta.ts";

const rule = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  change: z.string().min(1),
  mode: z.enum(["auto", "auto-with-question", "owner-review"]),
  min_source_kind: z.enum(E.SOURCE_KIND).nullable(),
  requires: z.array(z.string()),
  lands_as: z.strictObject({
    review_status: z.enum(E.REVIEW_STATUS),
    confidence: z.enum(E.CONFIDENCE),
    contributed_by: z.string(),
  }).nullable(),
  enabled: z.boolean(),
  note: z.string(),
});

export const policy = table("policy", {
  schema_version: int({ min: 1, max: 1 }),
  updated: date(),
  source_rank: json(z.array(z.enum(E.SOURCE_KIND))),
  rules: json(z.array(rule)),
  promotion: json(z.strictObject({
    owner_verify: z.boolean(),
    independent_official_sources: z.number().int().min(1),
    distinct_hosts: z.boolean(),
  })),
  price_change_question_pct: int({ min: 1 }),
}, { family: "sidecar", pk: [], single: true, ui: { label: "Catalog policy" } });

