// Trips: the list row (P8 allowlist), the query, the profile a detail is scheduled for, and the detail (web/lib/public/types.ts
// PublicTrip; web/components/trips/types.ts TripListRow). Public trips are dateless templates: no calendar date in any field.
import { z } from "zod";
import { apiPoint, apiSlug } from "./common.ts";
import { API_LIMITS } from "./limits.ts";
import { HONESTY_IDS, PLACE_CATEGORIES, placeQuery, tripSortSpec } from "./place.ts";

export const TRIP_DEPTHS = ["full", "summary", "overview"] as const;

/**
 * A trip's `ref` (D-B2 for trips): `trip/<trip id>`, where the trip id is the capture and trip-file id (`dolomites-2027`; research
 * formats README, trip file `id`), which is also the public slug. Trip-scoped refs already read `trip/<id>/<item key>`.
 */
export const TRIP_REF_RE = /^trip\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const tripRefId = z.string().regex(TRIP_REF_RE);

const photo = z.strictObject({
  file: z.string(),
  url: z.string(),
  width: z.int().min(1),
  caption: z.string(),
  author: z.string(),
  licence: z.string(),
  licenceUrl: z.string().nullable(),
  sourceUrl: z.string(),
  group: z.string().nullable(),
});
const honesty = z.strictObject({ id: z.enum(HONESTY_IDS), label: z.string(), reason: z.string() });
const idLabel = z.strictObject({ id: z.string(), label: z.string() });

/** `TripRow`: the 36 keys of web TRIP_LIST_KEYS plus `ref`, and nothing else (the allowlist of case K2). No key derived from the household's
 * real trip dates (PRIV-TD: `isDone` left the contract; PLAN 1 Privacy, P9). */
export const tripRow = z.strictObject({
  ref: tripRefId,
  id: apiSlug,
  slug: apiSlug,
  title: z.string(),
  depth: z.enum(TRIP_DEPTHS),
  nights: z.int().min(0).nullable(),
  days: z.int().min(0).nullable(),
  seasonNotSet: z.boolean(),
  region: z.string(),
  cover: z.string().nullable(),
  seasonLabel: z.string().nullable(),
  /** "plan": the label is only the window the plan was written for (other months and opening dates not checked). */
  seasonBasis: z.enum(["plan", "researched"]).nullable().optional(),
  seasonMonths: z.array(z.int().min(1).max(12)),
  country: z.string().regex(/^(?:[A-Z]{2})?$/),
  countryName: z.string(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  approx: z.boolean(),
  ageFit: z.number().nullable(),
  kidsBasis: z.enum(["computed", "floor", "plan"]).nullable(),
  effort: z.string().nullable(),
  firstBase: z.string().nullable(),
  countries: z.array(z.strictObject({ code: z.string(), name: z.string() })),
  continents: z.array(z.string()),
  length: z.string().nullable(),
  lengthClass: z.string().nullable(),
  hike: z.enum(["easy", "moderate", "strenuous"]).nullable(),
  hikeBasis: z.enum(["computed", "plan"]).nullable(),
  strollerDays: z.union([z.literal("friendly"), z.strictObject({ n: z.int().min(0), of: z.int().min(0) })]).nullable(),
  activities: z.array(idLabel),
  highlights: z.array(z.string()),
  around: z.array(z.string()),
  perDay: z.string().nullable(),
  perDayApprox: z.boolean(),
  shape: z.string().nullable(),
  fromHubMin: z.number().nullable(),
  fromHubApprox: z.boolean(),
});
export const TRIP_ROW_KEYS = Object.keys(tripRow.shape) as (keyof typeof tripRow.shape)[];

/** `TripQuery`: the Trips list's URL state, the same keys as Places (EXECUTION-PLAN 4.3 rule 3). */
export const tripQuery = placeQuery.extend({ sort: z.array(tripSortSpec).max(API_LIMITS.query.sortKeys).optional() });

/**
 * The profile a trip detail is scheduled for: the timeline's URL keys (core/src/schedule/profileCodec.ts PROFILE_KEYS), as strings.
 * The codec owns their grammar and falls back to the default on an unknown value, so a bad value is never an error.
 */
export const tripProfile = z.strictObject({
  p: z.string().max(20).optional(),
  pace: z.string().max(20).optional(),
  a: z.string().max(2).optional(),
  walk: z.string().max(3).optional(),
  split: z.string().max(2).optional(),
  d: z.string().max(200).optional(),
  add: z.string().max(400).optional(),
});

const proseChip = z.enum(["estimate", "not_known", "sources_disagree", "low_confidence", "pattern_2026"]);
const cleanProse = z.strictObject({ plain: z.string(), chips: z.array(proseChip) });
const knowGroup = z.strictObject({ group: z.string(), bullets: z.array(cleanProse) });
const chip = z.strictObject({
  kind: z.string(),
  text: z.string(),
  glyph: z.string(),
  label: z.string(),
  field: z.string().nullable(),
  extra: z.int().min(0),
  textNoTime: z.string().optional(),
});

const dayItem = z.strictObject({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  subkind: z.string().nullable(),
  category: z.enum(PLACE_CATEGORIES).nullable(),
  foldedInto: z.string().nullable(),
  placeSlug: apiSlug.nullable(),
  time: z.string().nullable(),
  variant: z.string().nullable(),
  durationMin: z.number().nullable(),
  note: z.string().nullable(),
  stats: z.strictObject({ distanceKm: z.number().nullable(), gainM: z.number().nullable(), hours: z.string().nullable() }).nullable(),
  access: z.string().nullable(),
  suit: z.strictObject({ chips: z.array(chip), kidsFrom: z.number().nullable(), kidsBasis: z.enum(["rule", "advice"]).nullable(), badge: z.string().nullable() }).nullable().optional(),
});

/** The scheduler's own shapes (core/src/schedule/types.ts) are kept open here: the scheduler, not the API, owns them. */
const schedulerShape = z.looseObject({});

const publicDay = z.strictObject({
  n: z.int().min(0),
  title: z.string(),
  baseId: z.string().nullable(),
  base: z.string().nullable(),
  driveMin: z.number().nullable(),
  driveIsEstimate: z.boolean(),
  summary: z.string().nullable(),
  items: z.array(dayItem),
  tracks: z.array(z.strictObject({ id: z.enum(["A", "B", "C"]), label: z.string(), title: z.string(), items: z.array(dayItem), notes: z.string().nullable() })).nullable(),
  scheduleInput: schedulerShape.nullable(),
  variants: z.array(z.strictObject({
    key: z.enum(["A", "B", "C", "main"]),
    label: z.string(),
    title: z.string().nullable(),
    audience: z.enum(["adults", "family", "easy", "any"]),
    relation: z.enum(["alternative", "parallel"]),
    notes: z.strictObject({ lead: cleanProse.nullable(), know: z.array(knowGroup) }),
  })),
  know: z.array(knowGroup),
  summaryProse: cleanProse.nullable(),
  light: z.string().nullable(),
  zone: z.strictObject({
    place: z.string(),
    label: z.string(),
    abbr: z.string(),
    /** The trip's own base zone, never the household's (PRIV-TD; alignment 2.6 S3). */
    home: z.string(),
    /** The abbreviation of `home`: the trip's own base zone, never the household's. */
    homeAbbr: z.string(),
    offsetMin: z.int(),
    items: z.array(z.string()),
  }).optional(),
  flight: z.boolean().optional(),
});

const categoryItem = z.strictObject({
  key: z.string(),
  category: z.enum(PLACE_CATEGORIES),
  name: z.string(),
  kind: z.string(),
  placeSlug: apiSlug.nullable(),
  days: z.array(z.int().min(0)),
  time: z.string().nullable(),
  areaLabel: z.string().nullable(),
  detail: z.string().nullable(),
  nights: z.int().min(0).nullable(),
  bookRule: z.strictObject({ daysBefore: z.int(), dayN: z.int().nullable(), time: z.string().nullable(), tz: z.string().nullable() }).nullable(),
  bookNote: z.string().nullable(),
});

const tripTags = z.strictObject({
  countries: z.array(z.string()),
  continents: z.array(z.string()),
  length: z.string().nullable(),
  when: z.array(z.int().min(1).max(12)),
  kidsFrom: z.number().nullable(),
  kidsBasis: z.enum(["computed", "floor", "plan"]).nullable(),
  hike: z.enum(["easy", "moderate", "strenuous"]).nullable(),
  hikeBasis: z.enum(["computed", "plan"]).nullable(),
  stroller: z.union([z.strictObject({ all: z.literal(true) }), z.strictObject({ all: z.literal(false), n: z.int().min(0), of: z.int().min(0) })]).nullable(),
  activities: z.array(idLabel),
  highlights: z.array(z.string()),
  around: z.array(z.string()),
  perDay: z.string().nullable(),
  perDayApprox: z.boolean(),
  shape: z.string().nullable(),
});

/**
 * `TripDetail` (getTrip): the public trip with its days scheduled for the asked profile (EXECUTION-PLAN 4.2: one item; dateless), plus
 * the card fields (`tags`, `lengthClass`, `fromHubs`) and `ref`. Base points are `apiPoint`s (role and approx, as on a place).
 */
export const tripDetail = z.strictObject({
  ref: tripRefId,
  slug: apiSlug,
  title: z.string(),
  subtitle: z.string(),
  depth: z.enum(TRIP_DEPTHS),
  visibility: z.enum(["public", "unlisted"]),
  nights: z.int().min(0).nullable(),
  daysCount: z.int().min(0).nullable(),
  seasonNotSet: z.boolean(),
  region: z.string(),
  cover: photo.nullable(),
  season: z.strictObject({
    basis: z.enum(["plan", "researched"]).optional(),
    months: z.array(z.int().min(1).max(12)),
    label: z.string(),
    why: z.string(),
    weather: z.strictObject({ tempC: z.string(), rain: z.string(), daylight: z.string(), notes: z.array(z.string()) }),
  }).nullable(),
  firstBase: z.string().nullable(),
  legacyUrl: z.string(),
  honesty: z.array(honesty),
  tags: tripTags,
  lengthClass: z.string().nullable(),
  fromHubs: z.array(z.strictObject({ hub: z.string(), minutes: z.number(), km: z.number(), basis: z.enum(["routed", "estimate"]), fetched: z.string() })),
  schedule: z.strictObject({
    defaultProfile: schedulerShape,
    writtenFor: z.string(),
    timelines: z.array(schedulerShape),
    condensed: z.boolean(),
    hasSplit: z.boolean(),
    hasVariants: z.boolean(),
  }).nullable(),
  bases: z.array(z.strictObject({ id: z.string(), name: z.string(), nights: z.int().min(0), days: z.array(z.int().min(0)), point: apiPoint.nullable() })),
  days: z.array(publicDay),
  categories: z.strictObject(Object.fromEntries(PLACE_CATEGORIES.map((c) => [c, z.array(categoryItem)])) as Record<(typeof PLACE_CATEGORIES)[number], z.ZodArray<typeof categoryItem>>),
  gallery: z.array(photo),
  effort: z.string().nullable(),
  ageFit: z.number().nullable(),
  driveAvgMin: z.number().nullable(),
});

export const tripSlugInput = z.strictObject({ slug: apiSlug, profile: tripProfile.optional() });

/** A retired trip slug (review R-18): getTrip answers the current one, and the handler answers 308. */
export const movedTrip = z.strictObject({ moved: apiSlug, ref: tripRefId });
/** What getTrip returns: the trip, or where it moved. */
export const tripLookup = z.union([tripDetail, movedTrip]);

export type TripRow = z.infer<typeof tripRow>;
export type TripQuery = z.infer<typeof tripQuery>;
export type TripProfile = z.infer<typeof tripProfile>;
export type TripDetail = z.infer<typeof tripDetail>;
export type TripLookup = z.infer<typeof tripLookup>;
