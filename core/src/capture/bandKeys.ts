// The values of the list-row bands (capture contract 7.3). No imports and no I/O, so the browser may import it too.
// Bands are labels the lists filter on, never facts with a source (principle P8).

export const EFFORT_NAMES = ["Stroll", "Easy", "Moderate", "Hard", "Technical"] as const;
export type EffortName = (typeof EFFORT_NAMES)[number];

export const TIME_BANDS = ["<1h", "1-2h", "2-4h", "half-day", "full-day", "multi-day"] as const;
export type TimeBand = (typeof TIME_BANDS)[number];
export const PRICE_BANDS = ["free", "$", "$$", "$$$"] as const;
export type PriceBand = (typeof PRICE_BANDS)[number];
export const BOOKING_BANDS = ["none", "recommended", "required"] as const;
export type BookingBand = (typeof BOOKING_BANDS)[number];

/** Metres from the car or the stop to the place, in four steps. */
export const WALK_BANDS = ["lt200", "200-600", "600-1500", "1500+"] as const;
export type WalkBand = (typeof WALK_BANDS)[number];
/** The shape of a trail. */
export const SHAPES = ["loop", "out-and-back", "point-to-point", "network"] as const;
export type Shape = (typeof SHAPES)[number];
/** The best time of day (the first row of `best_time`). */
export const BEST_TIMES = ["sunrise", "golden_am", "morning", "midday", "afternoon", "golden_pm", "sunset", "night"] as const;
export type BestTime = (typeof BEST_TIMES)[number];

/** The bool facets a record can answer. A leading "!" on a stored flag means "known not to": a gap stores neither. */
export const FLAG_IDS = ["swim", "lifeguard", "indoor", "stroller", "stroller_part", "step_free", "dogs", "guided", "toilets", "change_rooms", "fenced"] as const;
export type FlagId = (typeof FLAG_IDS)[number];

/** The registry property each bool facet reads, and the flag that carries its answer in a list row. */
export const FLAG_OF_PROPERTY: Record<string, FlagId> = {
  "ext.water.swimming": "swim",
  "water_safety.lifeguard": "lifeguard",
  indoor: "indoor",
  stroller: "stroller",
  wheelchair: "step_free",
  "ext.trail.dogs": "dogs",
  "participation.guide": "guided",
  toilets: "toilets",
  change_rooms: "change_rooms",
  exposure: "fenced",
};

/** At most this many flag ids ride in a row (contract 7.3). */
export const MAX_FLAGS = 6;

export interface ListBands {
  effort: EffortName | null;
  kids_from: number | null;
  /** `rule` hides a place from a younger child, `advice` only fades it. */
  kids_basis: "rule" | "advice" | null;
  time_band: TimeBand | null;
  price_band: PriceBand | null;
  booking: BookingBand | null;
  flags: string[];
  walk_band: WalkBand | null;
  shape: Shape | null;
  best_time: BestTime | null;
}

export const BAND_KEYS = ["effort", "kids_from", "kids_basis", "time_band", "price_band", "booking", "flags", "walk_band", "shape", "best_time"] as const satisfies readonly (keyof ListBands)[];

export const NO_BANDS: ListBands = { effort: null, kids_from: null, kids_basis: null, time_band: null, price_band: null, booking: null, flags: [], walk_band: null, shape: null, best_time: null };
