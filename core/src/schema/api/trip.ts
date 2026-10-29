// Trips: the list row (P8 allowlist), the query, the profile a detail is scheduled for, and the detail (web/lib/public/types.ts
// PublicTrip; web/components/trips/types.ts TripListRow). Public trips are dateless templates: no calendar date in any field.
import { z } from "zod";
import { apiPoint, apiSlug } from "./common.ts";
import { API_LIMITS } from "./limits.ts";
import { HONESTY_IDS, PLACE_CATEGORIES, placeQuery, tripSortSpec } from "./place.ts";
import { BOOK_RULE_KINDS, BOOKING_KINDS } from "../../export/types.ts";
import type { DayTimeline, Profile, ScheduleDayInput } from "../../schedule/types.ts";

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

/** A stop's three suitability chips and its badge (S1; web/lib/public/types.ts `ItemSuit`). */
const itemSuit = z.strictObject({ chips: z.array(chip), kidsFrom: z.number().nullable(), kidsBasis: z.enum(["rule", "advice"]).nullable(), badge: z.string().nullable() });

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
  suit: itemSuit.nullable().optional(),
});

/** The scheduler's own shapes (core/src/schedule/types.ts) are kept open here: the scheduler, not the API, owns them. */
const schedulerShape = z.looseObject({});

/** One version of a day (web/lib/public/types.ts `DayVariantInfo`). */
const dayVariantInfo = z.strictObject({
  key: z.enum(["A", "B", "C", "main"]),
  label: z.string(),
  title: z.string().nullable(),
  audience: z.enum(["adults", "family", "easy", "any"]),
  relation: z.enum(["alternative", "parallel"]),
  notes: z.strictObject({ lead: cleanProse.nullable(), know: z.array(knowGroup) }),
});

/** A time-zone line crossed during a day (web/lib/public/types.ts `DayZone`). */
const dayZone = z.strictObject({
  place: z.string(),
  label: z.string(),
  abbr: z.string(),
  /** The trip's own base zone, never the household's (PRIV-TD; alignment 2.6 S3). */
  home: z.string(),
  /** The abbreviation of `home`: the trip's own base zone, never the household's. */
  homeAbbr: z.string(),
  offsetMin: z.int(),
  items: z.array(z.string()),
});

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
  variants: z.array(dayVariantInfo),
  know: z.array(knowGroup),
  summaryProse: cleanProse.nullable(),
  light: z.string().nullable(),
  zone: dayZone.optional(),
  flight: z.boolean().optional(),
});

const month = z.int().min(1).max(12);
/**
 * One phase of a booking window, dateless (core/src/export/bookings.ts `BookRulePhase`; protected-area-entry 5.2). `kind` absent is
 * `rolling`, so every row written before PA-X parses unchanged. `months` is a yearly band ("usually in March"), never a year.
 */
const bookRulePhase = z.strictObject({
  kind: z.enum(BOOK_RULE_KINDS).optional(),
  daysBefore: z.int(),
  dayN: z.int().nullable(),
  time: z.string().nullable(),
  tz: z.string().nullable(),
  months: z.tuple([month, month]).nullable().optional(),
  monthLeadDays: z.int().min(0).nullable().optional(),
  closes: z.strictObject({ daysBefore: z.int().min(0), time: z.string().nullable() }).nullable().optional(),
  sharePct: z.number().min(0).max(100).nullable().optional(),
});
/** `CategoryItem.bookRule`: a phase and an optional second phase (a launch day, then a rolling release). One level only. */
export const bookRule = bookRulePhase.extend({ then: bookRulePhase.nullable().optional() });

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
  bookRule: bookRule.nullable(),
  bookNote: z.string().nullable(),
  /** The Book ahead row kind when the row knows it (protected-area-entry 6.2); absent reads as before PA-X (`bookingKindOf`). */
  bookKind: z.enum(BOOKING_KINDS).nullable().optional(),
  /** The park or zone name the row is needed for. */
  park: z.string().min(1).nullable().optional(),
  /** The requirement's booking page. */
  link: z.string().min(1).nullable().optional(),
});

const VISIT_MODES = ["day", "overnight_front", "overnight_back", "through"] as const;
export const PARK_KINDS = ["national", "state_provincial", "conservation", "reserve", "forest", "dark_sky", "zone"] as const;

/**
 * A park or zone the trip enters (protected-area-entry 6.1, 6.2, 6.5 `TripPark`), derived from the trip's stops and bases through the
 * graph index (core/src/parks). Dateless: day and night numbers only. Names and slugs, never a record ref. `line` is the park line the
 * Summary and Bookings tabs and the print show; `saving` the "pass is likely cheaper" line, only with comparable price units (QP5).
 */
export const tripPark = z.strictObject({
  slug: apiSlug.nullable(),
  name: z.string().min(1),
  kind: z.enum(PARK_KINDS),
  parent: z.strictObject({ slug: apiSlug.nullable(), name: z.string().min(1) }).nullable(),
  days: z.array(z.int().min(0)),
  nights: z.array(z.int().min(0)),
  modes: z.array(z.enum(VISIT_MODES)),
  state: z.enum(["requirements", "none_needed", "not_checked"]),
  needs: z.array(z.strictObject({ name: z.string().min(1), kind: z.enum(BOOKING_KINDS), text: z.string() })),
  coveredBy: z.string().min(1).nullable(),
  line: z.string().min(1),
  saving: z.string().min(1).nullable(),
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
  // `legacyUrl` left the contract (PA-X, the PRIV-TD2 follow-up): it served the old folder names, which encode real travel months.
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
  /** The parks and zones the trip enters, in the order first entered (PA-X contract; PA-W fills it). Absent until wired. */
  parks: z.array(tripPark).optional(),
});

export const tripSlugInput = z.strictObject({ slug: apiSlug, profile: tripProfile.optional() });

/** A retired trip slug (review R-18): getTrip answers the current one, and the handler answers 308. */
export const movedTrip = z.strictObject({ moved: apiSlug, ref: tripRefId });
/** What getTrip returns: the trip, or where it moved. */
export const tripLookup = z.union([tripDetail, movedTrip]);

// ---- the plan model (STEP2-M; build-plan 3, gap-analysis D6, D7) ------------------------------------------------------------------
//
// `GET /api/v1/trips/{slug}/plan-model`: the model the public trip page builds on the server and hands its client components
// (web/components/trips/model.ts `TripPageModel`), so `/t/<id>/` renders a copy from the same model with the person's delta applied on
// the device (P9: one boundary; nothing private goes to the server). Public data only: the trip, its places' points and photos, and
// the pre-filtered places a visitor may add to a day (never the catalogue, P8). `tripPageModelForBuilt` (core/src/plan/pageModel.ts)
// maps a builder draft's last build onto the same shape. The scheduler's own shapes stay open, as on `tripDetail`, but typed.

/** A scheduler shape (core/src/schedule/types.ts): checked as an object at run time, typed as the scheduler's own interface. */
const scheduled = <T>() => schedulerShape as unknown as z.ZodType<T>;

const stopStats = z.strictObject({ distanceKm: z.number().nullable(), gainM: z.number().nullable(), hours: z.string().nullable() });

/** One stop row of a day (`StopModel`). */
export const planStop = z.strictObject({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  time: z.string().nullable(),
  stats: stopStats.nullable(),
  note: z.string().nullable(),
  access: z.string().nullable(),
  variant: z.string().nullable(),
  placeSlug: apiSlug.nullable(),
});

const trackId = z.enum(["A", "B", "C"]);

/** One day row (`DayRowModel`): the Days list and the print read these. */
export const planDayRow = z.strictObject({
  n: z.int().min(0),
  title: z.string(),
  base: z.string().nullable(),
  /** "≈1 h 10", or null when the day has no drive */
  drive: z.string().nullable(),
  driveIsEstimate: z.boolean(),
  thumb: z.strictObject({ url: z.string(), alt: z.string() }).nullable(),
  glyph: z.string(),
  summary: z.string().nullable(),
  stops: z.array(planStop),
  tracks: z.array(z.strictObject({ id: trackId, label: z.string(), title: z.string(), stops: z.array(planStop), notes: z.string().nullable() })).nullable(),
  defaultTrack: trackId.nullable(),
});

/** The Stops tab's sections (`CategorySectionModel`), in the six categories' order. */
export const planSection = z.strictObject({
  id: z.enum(PLACE_CATEGORIES),
  label: z.string(),
  count: z.int().min(0),
  rows: z.array(z.strictObject({
    key: z.string(),
    name: z.string(),
    kind: z.string(),
    placeSlug: apiSlug.nullable(),
    days: z.array(z.int().min(0)),
    time: z.string().nullable(),
    area: z.string().nullable(),
    detail: z.string().nullable(),
    nights: z.int().min(0).nullable(),
    bookRule: z.string().nullable(),
    bookNote: z.string().nullable(),
  })),
});

const routePoint = z.strictObject({ key: z.string(), name: z.string(), lng: z.number(), lat: z.number(), placeSlug: apiSlug.nullable() });
/** The map's model (`RouteModel`): bases and each day's placed stops; a stop with no point is counted, never drawn. */
export const planRoute = z.strictObject({
  bases: z.array(z.strictObject({ id: z.string(), name: z.string(), lng: z.number(), lat: z.number(), days: z.array(z.int().min(0)) })),
  days: z.array(z.strictObject({ n: z.int().min(0), title: z.string(), base: z.string().nullable(), points: z.array(routePoint), unplaced: z.int().min(0).optional() })),
  unplaced: z.int().min(0),
});

/** A photo credit (`CreditModel`). */
export const planCredit = z.strictObject({ title: z.string().optional(), author: z.string(), licence: z.string(), licenceUrl: z.string().optional(), sourceUrl: z.string().optional() });

/** A place a visitor may add to a day (`AddCandidate`); `key` is what `add=<day>.<key>` carries. */
export const planAddCandidate = z.strictObject({
  key: z.string(),
  name: z.string(),
  kind: z.enum(["visit", "trail", "meal", "break", "rest", "checkin", "checkout", "transfer"]),
  sub: z.string().nullable(),
  placeSlug: apiSlug.nullable(),
  point: z.strictObject({ lat: z.number(), lon: z.number() }).nullable(),
  durationMin: z.number().nullable(),
  durationRange: z.tuple([z.number(), z.number()]).nullable(),
  stats: z.strictObject({ distanceKm: z.number().nullable(), gainM: z.number().nullable() }).nullable(),
  label: z.string(),
  km: z.number().nullable(),
  group: z.enum(["variant", "trip", "nearby"]),
  /** indoor or under cover (DG-01): present only when true */
  indoor: z.literal(true).optional(),
});

/** One day of the timeline (`TimelineDayModel`): the scheduler's input for the day and the words around it. */
export const planTimelineDay = z.strictObject({
  n: z.int().min(0),
  title: z.string(),
  base: z.string().nullable(),
  thumb: z.strictObject({ url: z.string() }).nullable(),
  glyph: z.string(),
  summary: z.string().nullable(),
  light: z.string().nullable(),
  input: scheduled<ScheduleDayInput>(),
  variants: z.array(dayVariantInfo),
  know: z.array(knowGroup),
  zone: dayZone.optional(),
  flight: z.boolean().optional(),
});

/** The timeline (`TimelineModel`): the default profile without the adults count, the default timelines, and the addables by day. */
export const planTimeline = z.strictObject({
  slug: z.string(),
  defaultProfile: scheduled<Omit<Profile, "adults">>(),
  writtenFor: z.string(),
  condensed: z.boolean(),
  hasSplit: z.boolean(),
  hasVariants: z.boolean(),
  days: z.array(planTimelineDay),
  defaultTimelines: z.array(scheduled<DayTimeline>()),
  addables: z.record(z.string(), planAddCandidate),
  /** day number (as a JSON key) -> the addable keys offered on that day */
  addByDay: z.record(z.string().regex(/^\d{1,3}$/), z.array(z.string())),
  /** place slug, or `n:<normalised name>` -> the stop's chips */
  suit: z.record(z.string(), itemSuit),
});

/** `TripPlanModel`: everything the trip details page renders from the plan (web `TripPageModel`), as JSON. */
export const tripPlanModel = z.strictObject({
  /** null for an overview trip, or a build with no schedule files */
  timeline: planTimeline.nullable(),
  days: z.array(planDayRow),
  sections: z.array(planSection),
  route: planRoute,
  gallery: z.array(photo),
  credits: z.array(planCredit),
});

/** What the plan-model endpoint returns: the model, or where the trip moved (308, like getTrip). */
export const tripPlanModelLookup = z.union([tripPlanModel, movedTrip]);

export type TripRow = z.infer<typeof tripRow>;
export type TripQuery = z.infer<typeof tripQuery>;
export type TripProfile = z.infer<typeof tripProfile>;
export type TripDetail = z.infer<typeof tripDetail>;
export type TripLookup = z.infer<typeof tripLookup>;
export type TripPark = z.infer<typeof tripPark>;
export type BookRule = z.infer<typeof bookRule>;
export type TripPlanModel = z.infer<typeof tripPlanModel>;
export type TripPlanModelLookup = z.infer<typeof tripPlanModelLookup>;
export type PlanTimeline = z.infer<typeof planTimeline>;
export type PlanTimelineDay = z.infer<typeof planTimelineDay>;
export type PlanDayRow = z.infer<typeof planDayRow>;
export type PlanStop = z.infer<typeof planStop>;
export type PlanSection = z.infer<typeof planSection>;
export type PlanAddCandidate = z.infer<typeof planAddCandidate>;
