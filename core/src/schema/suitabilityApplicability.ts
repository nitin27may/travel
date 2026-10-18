// data/schema/suitability-applicability.json: which suitability field applies to which kind
// (docs/v2/research/suitability-applicability.md). One row per profile, every field path listed, so N is stated.
//
// Subset rule (meta.ts): plain shapes only. That a profile list is complete, that each (kind, subkind) pair maps to one
// profile and that every path of the schema appears live in core/src/validate/applicability.ts.
import { z } from "zod";
import * as E from "./enums.ts";
import { date, int, json, table, text } from "./meta.ts";

const profile = z.strictObject({
  match: z.array(z.strictObject({ kind: z.enum(E.SUIT_KIND), subkind: z.enum(E.SUIT_SUBKIND) })),
  operated: z.enum(["always", "never", "flag"]),
  ext: z.string().min(1).nullable(),
  fields: z.record(z.string(), z.enum(E.APPLICABILITY)),
});

export const suitability_applicability = table("suitability_applicability", {
  schema_version: int({ min: 1, max: 1 }),
  updated: date(),
  note: text({ min: 1 }),
  f_labels: json(z.record(z.string(), z.string())),
  profiles: json(z.record(z.string(), profile)),
}, { family: "sidecar", pk: [], single: true, ui: { label: "Suitability applicability" } });

export type ApplicabilityFile = {
  schema_version: 1;
  updated: string;
  note: string;
  f_labels: Record<string, string>;
  profiles: Record<string, z.infer<typeof profile>>;
};
