// research-sidecar/1 (plan 10.1): the machine-readable twin of a lane's Markdown file.
import { z } from "zod";
import * as E from "./enums.ts";
import { date, json, pattern, strList, table, text } from "./meta.ts";

const subject = z.strictObject({ kind: z.enum(["trip", "place", "area", "country"]), id: z.string().min(1) });
const geo = z.strictObject({ countries: z.array(z.string()), regions: z.array(z.string()), areas: z.array(z.string()) });
const tripType = z.strictObject({
  duration_shape: z.enum(E.DURATION_SHAPE),
  movement_shape: z.enum(E.MOVEMENT_SHAPE),
  styles: z.array(z.string()),
});
const source = z.strictObject({
  id: z.string().regex(/^src-\d{4,}$/),
  url: z.string().min(1),
  title: z.string(),
  publisher: z.string(),
  kind: z.enum(E.SOURCE_KIND),
  read: z.iso.date(),
});
const fact = z.strictObject({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  unit: z.string().nullable(),
  confidence: z.enum(E.CONFIDENCE),
  src: z.array(z.string()),
  gap_reason: z.string().nullable(),
  subject_ref: z.string().nullable(),
});
// A record is a catalog-shaped row (2.3A) plus the keys that let the matcher find an existing row.
// Rows are partial while they are raw captures, so only `match` and `src` are fixed here.
const record = z.looseObject({ match: z.record(z.string(), z.unknown()), src: z.array(z.string()) });
const records = z.strictObject({
  places: z.array(record).optional(),
  trails: z.array(record).optional(),
  activities: z.array(record).optional(),
  stays: z.array(record).optional(),
  eateries: z.array(record).optional(),
  offers: z.array(record).optional(),
  offer_prices: z.array(record).optional(),
  legs: z.array(record).optional(),
  area_facts: z.array(record).optional(),
  items: z.array(record).optional(),
});

export const research_sidecar = table("research_sidecar", {
  schema: pattern(/^research-sidecar\/1$/),
  lane: text({ min: 1 }),
  subject: json(subject),
  researched: date(),
  agent: text({ min: 1 }),
  model: text({ min: 1 }),
  md: text({ min: 1 }),
  geo: json(geo),
  trip_type: json(tripType, { null: true }),
  tags: strList(),
  sources: json(z.array(source)),
  facts: json(z.array(fact)),
  records: json(records),
}, { family: "sidecar", pk: [], single: true, ui: { label: "Research sidecar" } });
