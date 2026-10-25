// trip-season-basic/1: data/seasons/<trip>.json, the season of a trip that has no seed season (D6a). Plain zod, not a registered table:
// it is read by the web adapter at build time and validated by core/src/validate/seasons.ts. The `windows` list follows trip-windows/1
// (overview spec 2.2) and is checked there when OVR-C lands; this schema only requires it to be a list.
import { z } from "zod";

export const SEASON_SCHEMA_ID = "trip-season-basic/1";
/** `plan` means the value is only the plan's own window, never a researched season: pages must say so. */
export const SEASON_BASIS = ["plan", "official", "computed", "operator", "searched_none"] as const;

const isoDate = z.iso.date();
const text = z.string().trim().min(1);
const basis = z.enum(SEASON_BASIS);

function field<T extends z.ZodType>(value: T) {
  return z.strictObject({ value, basis, note: z.string().optional(), src: z.array(z.string()).optional(), on: isoDate.optional() });
}

export const seasonNote = z.strictObject({ text, basis, note: z.string().optional(), src: z.array(z.string()).optional(), on: isoDate.optional() });

export const tripSeason = z.strictObject({
  months: field(z.array(z.number().int().min(1).max(12)).min(1)),
  label: field(text),
  why: field(text),
  weather: z.strictObject({
    tempC: field(text),
    rain: field(text),
    daylight: field(text),
    notes: z.array(seasonNote),
  }),
});

export const tripSeasonFile = z.looseObject({
  schema: z.literal(SEASON_SCHEMA_ID),
  trip: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  season: tripSeason,
  windows: z.array(z.unknown()),
});

export type TripSeasonFile = z.infer<typeof tripSeasonFile>;
export type TripSeason = z.infer<typeof tripSeason>;
