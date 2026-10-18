// data/schema/difficulty-map.json: local grade to terrain grade (plan 3A, extended to every kind by
// docs/v2/research/suitability.md section 2), extendable without code changes.
//
// v1 had no per-row source. v2 rows carry `source` (a URL, or a docs/ path for rows kept from plan 3A) and `read`;
// the validator requires both when schema_version is 2. v1 files still validate: documents.ts fills the columns
// v1 does not have before the table check.
import { z } from "zod";
import * as E from "./enums.ts";
import { date, int, json, table } from "./meta.ts";

const mapping = z.strictObject({
  local: z.string().min(1),
  house: z.number().int().min(1).max(5),
  note: z.string(),
  /** "flat" rows apply only to a made, level, unexposed surface; the same `local` has another row without it */
  when: z.literal("flat").optional(),
  source: z.string().min(1).optional(),
  read: z.iso.date().optional(),
});
const system = z.strictObject({
  id: z.enum(E.GRADE_SYSTEM),
  label: z.string().min(1),
  mappings: z.array(mapping),
  note: z.string(),
});
const scale = z.strictObject({ house: z.number().int().min(1).max(5), label: z.string(), technical: z.string() });
const band = z.strictObject({ below: z.number().nullable(), grade: z.number().int().min(1).max(5) });
const modes = z.strictObject({ walk: z.number().positive(), ride: z.number().positive(), note: z.string() });

export const difficulty_map = table("difficulty_map", {
  schema_version: int({ min: 1, max: 2 }),
  updated: date(),
  scale: json(z.array(scale)),
  systems: json(z.array(system)),
  effort: json(z.strictObject({ formula: z.string(), bands: z.array(band), note: z.string() })),
  /** v2: the factor on km by travel mode in effort_km = km * factor + gain_m / 100. Null in a v1 file. */
  modes: json(modes, { null: true }),
  rule: json(z.strictObject({ house_grade: z.string(), no_local_grade: z.string() })),
}, { family: "sidecar", pk: [], single: true, ui: { label: "Difficulty map" } });
