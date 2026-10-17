// data/schema/freshness.json: the freshness policy of plan 0A.1.
import { z } from "zod";
import { date, int, json, table } from "./meta.ts";

const klass = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  label: z.string().min(1),
  fields: z.array(z.string().min(1)),
  stale_after_days: z.number().int().min(1).nullable(),
  also_stale_when: z.string().nullable(),
  on_stale: z.array(z.enum(["badge", "backlog", "review-prompt", "untrusted", "none"])),
  detail: z.string(),
});

export const freshness = table("freshness", {
  schema_version: int({ min: 1, max: 1 }),
  updated: date(),
  classes: json(z.array(klass)),
}, { family: "sidecar", pk: [], single: true, ui: { label: "Freshness policy" } });
