// trip-season-basic/1: data/seasons/<trip>.json, the season of a trip that has no seed season (D6a). Plain zod, not a registered table:
// it is read by the web adapter at build time and validated by core/src/validate/seasons.ts. The `windows` list follows trip-windows/1
// (overview spec 2.2) and is checked there when OVR-C lands; this schema only requires it to be a list.
//
// Two shapes validate (SEASONS-C), so a file moves from one to the other without a schema bump:
//   - the first shape: a field is `{value, basis, src?, on?, note?}` with SEASON_BASIS (`plan`, `official`, `computed` ...);
//   - the research contract (catalogue-intake-and-storage.md 4.2, written by `normalise.ts --write`): a field is the sidecars' Val
//     `{v, state, basis, src, read?, note?}` with SUIT_BASIS, and a weather note is a claim whose basis is a SUIT_BASIS value (or null
//     with state `searched_none`) and may name its `method`.
// In the Val shape `plan` is gone (it maps to our_inference), so the file-level `months_basis: "plan_months"` is what says the months
// are only the plan's own window. A file may mix the two shapes field by field; the adapter reads each field by its shape.
import { z } from "zod";
import { SOURCE_METHOD, SUIT_BASIS, SUIT_STATE } from "./enums.ts";
import { rowMetaSlot } from "./rowMeta.ts";
import { val } from "./suitability.ts";

export const SEASON_SCHEMA_ID = "trip-season-basic/1";
/** The first shape's vocabulary. `plan` means the value is only the plan's own window, never a researched season: pages must say so. */
export const SEASON_BASIS = ["plan", "official", "computed", "operator", "searched_none"] as const;
/** `months_basis` values. `plan_months`: the months are the plan's own window, not a researched season (the Val shape's `plan`). */
export const SEASON_MONTHS_BASIS = ["plan_months"] as const;

const isoDate = z.iso.date();
const text = z.string().trim().min(1);
const months = z.array(z.number().int().min(1).max(12)).min(1);

/** The first shape: `{value, basis}` with SEASON_BASIS. */
function legacyField<T extends z.ZodType>(value: T) {
  return z.strictObject({ value, basis: z.enum(SEASON_BASIS), note: z.string().optional(), src: z.array(z.string()).optional(), on: isoDate.optional() });
}

/** A field the page must show (months, label, why): the Val with state `value` and a non-null `v`. */
function shownVal<T extends z.ZodType>(inner: T) {
  return val(inner).extend({ v: inner, state: z.literal("value") });
}

/** Either shape. The validator reports the branch that matches the field's keys (`v` present: the Val). */
function field<T extends z.ZodType>(inner: T, shown: boolean) {
  return z.union([legacyField(inner), shown ? shownVal(inner) : val(inner)]);
}

export const seasonNote = z.strictObject({
  text,
  basis: z.union([z.enum(SEASON_BASIS), z.enum(SUIT_BASIS)]).nullable(),
  /** the Val shape's `searched_none` claim: basis null, the search date in `on` */
  state: z.enum(SUIT_STATE).optional(),
  method: z.enum(SOURCE_METHOD).optional(),
  note: z.string().optional(),
  src: z.array(z.string()).optional(),
  on: isoDate.optional(),
});

export const tripSeason = z.strictObject({
  months: field(months, true),
  label: field(text, true),
  why: field(text, true),
  weather: z.strictObject({
    tempC: field(text, false),
    rain: field(text, false),
    daylight: field(text, false),
    notes: z.array(seasonNote),
  }),
});

export const tripSeasonFile = z.looseObject({
  schema: z.literal(SEASON_SCHEMA_ID),
  trip: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  months_basis: z.enum(SEASON_MONTHS_BASIS).optional(),
  season: tripSeason,
  windows: z.array(z.unknown()),
  /** the file-level RowMeta block (FAMILY_META "."), checked by the keep pass */
  meta: rowMetaSlot.optional(),
});

export type TripSeasonFile = z.infer<typeof tripSeasonFile>;
export type TripSeason = z.infer<typeof tripSeason>;

/** The value of a field in either shape (null for a Val that holds none). */
export function seasonValue<T>(f: { value: T } | { v: T | null }): T | null {
  return "v" in f ? f.v : f.value;
}

/** Whether the months are only the plan's own window: `basis: "plan"` in the first shape, `months_basis: "plan_months"` in the Val shape. */
export function monthsArePlan(file: Pick<TripSeasonFile, "months_basis" | "season">): boolean {
  const m = file.season.months;
  return "v" in m ? file.months_basis === "plan_months" : m.basis === "plan";
}
