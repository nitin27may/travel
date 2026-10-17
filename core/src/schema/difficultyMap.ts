// data/schema/difficulty-map.json: local grade to house grade (plan 3A), extendable without code changes.
import { z } from "zod";
import * as E from "./enums.ts";
import { date, int, json, table } from "./meta.ts";

const mapping = z.strictObject({ local: z.string().min(1), house: z.number().int().min(1).max(5), note: z.string() });
const system = z.strictObject({
  id: z.enum(E.LOCAL_SYSTEM),
  label: z.string().min(1),
  mappings: z.array(mapping),
  note: z.string(),
});
const scale = z.strictObject({ house: z.number().int().min(1).max(5), label: z.string(), technical: z.string() });
const band = z.strictObject({ below: z.number().nullable(), grade: z.number().int().min(1).max(5) });

export const difficulty_map = table("difficulty_map", {
  schema_version: int({ min: 1, max: 1 }),
  updated: date(),
  scale: json(z.array(scale)),
  systems: json(z.array(system)),
  effort: json(z.strictObject({ formula: z.string(), bands: z.array(band), note: z.string() })),
  rule: json(z.strictObject({ house_grade: z.string(), no_local_grade: z.string() })),
}, { family: "sidecar", pk: [], single: true, ui: { label: "Difficulty map" } });
