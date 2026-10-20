// Trip timeline types (docs/v2/features/trip-timeline.md 1.2, 3.2, 3.12). Everything here is plain JSON: the
// scheduler runs on the server at build time and again in the browser, so nothing holds a Map, a Date or a function.
// Clock values are local "HH:MM" strings; the scheduler works in minutes after local midnight.

export type EntryKind = "start" | "leg" | "visit" | "trail" | "meal" | "break" | "rest" | "checkin" | "checkout" | "booking" | "sun" | "end";
export type Lane = "all" | "A" | "B" | "C";
export type Confidence = "fixed" | "anchored" | "suggested";
/** Who said it. Shown as the source label. */
export type TimeSource = "operator" | "plan" | "sun" | "data" | "rule" | "visitor";
export type LegBasis = "routed" | "plan" | "matrix" | "estimate";
export type LegMode = "drive" | "walk" | "shuttle" | "bus" | "train" | "ferry" | "boat" | "lift" | "flight";
export type SunEventId = "sunrise" | "golden-am" | "golden-pm" | "sunset" | "civil-dusk" | "nautical-dusk" | "no-sunset";
/** Honesty chips the scheduler can attach to an entry. The web adapter maps them to its own chip ids. */
export type ScheduleHonesty = "drive_estimated" | "estimate" | "not_known" | "pattern_2026";

export interface Point {
  lat: number;
  lon: number;
}

export interface PlaceRef {
  name: string;
  placeSlug: string | null;
  point: Point | null;
}

export interface TimelineEntry {
  /** Stable: the source item id, or `${day}-${lane}-${kind}-${sub}-${next stop id}` for generated entries, so adding a stop elsewhere keeps their ids. */
  id: string;
  day: number;
  lane: Lane;
  kind: EntryKind;
  sub: string | null;
  title: string;
  start: string;
  durationMin: number;
  /** Derived; never past 23:59 (see S_MIDNIGHT). */
  end: string;
  tz: string;
  at: PlaceRef | null;
  from: PlaceRef | null;
  to: PlaceRef | null;
  time: {
    confidence: Confidence;
    source: TimeSource;
    /** The scheduler may not move it (fixed, or an authored time). */
    pinned: boolean;
    anchor?: { to: SunEventId; offsetMin: number; range: [string, string] };
    window?: { from: string | null; to: string | null; why: string };
    note: string | null;
  };
  duration: { source: TimeSource | "pace"; basis: string };
  leg?: { mode: LegMode; km: number | null; basis: LegBasis; breaks: number };
  stats?: { distanceKm: number | null; gainM: number | null };
  optional: boolean;
  addedBy: "author" | "scheduler" | "visitor";
  sourceItemId: string | null;
  bookingOf?: string;
  insideOf?: string;
  /** Condensed plans only: the part of the day instead of a time ("Morning"). */
  block?: "Morning" | "Afternoon" | "Evening" | "After dark";
  /** Meals only: how it is eaten (spec 1.1). */
  style?: "sit-down" | "picnic" | "on-trail" | "at-base";
  honesty: ScheduleHonesty[];
  /** A "moved" note for the add-to-day diff is computed by the UI from two timelines; the scheduler does not set it. */
}

export type WarnCode =
  | "W_OVERLAP" | "W_HOURS" | "W_DAYLIGHT" | "W_PACE" | "W_DRIVE_LIMIT" | "W_EARLY" | "W_CEILING" | "W_FIT"
  | "S_LAST_RIDE" | "S_DAY_CAP" | "S_FIXED_MISSED" | "S_MIDNIGHT" | "S_NO_FIT" | "S_HOME_BY" | "S_DINNER_LATE";

export interface ScheduleWarning {
  code: WarnCode;
  message: string;
  /** The entry the warning belongs to, when it is about one. */
  entryId: string | null;
  lane: Lane;
}

export interface DayTimeline {
  day: number;
  variant: { key: string; label: string; chosenBy: "profile" | "override"; reason: string };
  lanes: Lane[];
  entries: TimelineEntry[];
  span: { start: string; end: string; minutes: number };
  totals: { activeMin: number; driveMin: number; walkKm: number; gainM: number };
  warnings: ScheduleWarning[];
  /** False when no variant fits the profile (3.5). */
  fits: boolean;
  /** A condensed plan: entries carry a part of the day, not a time, and no legs or meals are invented. */
  blocks: boolean;
  /** Shown first on a no-fit day (3.5) or for a split option (6). */
  notes: { kind: "no-fit" | "split-option"; text: string }[];
}

// ---- the profile (3.1, 3.8) ----

export type Party = "adults" | "family";
export type Pace = "relaxed" | "standard" | "full";

export interface Profile {
  party: Party;
  /** The youngest child's age, 0 to 17. null for adults. */
  youngest: number | null;
  pace: Pace;
  /** 1, or 2 and more (stored as 2). Only matters for split days. */
  adults: number;
  /** Longest single walk in km; null means from the age (2.4). */
  walkKm: number | null;
  split: boolean;
}

export const DEFAULT_PROFILE: Profile = { party: "adults", youngest: null, pace: "standard", adults: 2, walkKm: null, split: false };

// ---- the scheduler input (2.1) ----

export type ItemKind = "visit" | "trail" | "meal" | "break" | "rest" | "checkin" | "checkout" | "transfer";

/** What an item needs from the sun, relative to the day's sun reference. */
export interface SunNeed {
  sun: "sunrise" | "sunset" | "golden-pm" | "civil-dusk" | "nautical-dusk";
  offsetMin: number;
}

export interface ScheduleItem {
  id: string;
  kind: ItemKind;
  sub: string | null;
  title: string;
  placeSlug: string | null;
  point: Point | null;
  /** Rule id to use for the duration when no data duration is given (rules.ts). */
  rule: string | null;
  /** Authored or data duration in minutes. */
  durationMin: number | null;
  /** A range from the data, e.g. "4-5 h" as [240, 300]. Resolved by pace (2.3). */
  durationRange: [number, number] | null;
  durationSource: "plan" | "data" | "operator" | null;
  stats: { distanceKm: number | null; gainM: number | null } | null;
  /** An authored time. `fixed` is an operator slot. */
  start: { time: string; confidence: "fixed" | "suggested"; source: TimeSource; note?: string | null } | null;
  needs: SunNeed | null;
  /** Opening hours, last rides. Read for the season window. */
  window: { from: string | null; to: string | null; lastUp: string | null; lastDown: string | null; why: string } | null;
  /** A slot that needs arrival ahead: a `booking` entry this many minutes before the start. */
  checkinMin: number | null;
  optional: boolean;
  note: string | null;
  /** Suitability facts the profile uses. */
  minAge: number | null;
  /** A hard age limit is an operator rule; the plan's own audience ("an adults' walk") also excludes; advice does not. */
  minAgeRule: "hard" | "plan" | "advice" | null;
  needsDaylight: boolean;
  /** Stays outside the walk ceiling (a ticketed ride, a cruise). */
  honesty: ScheduleHonesty[];
  /** The day-level lane this item belongs to for a family, used when a variant merges items. */
  lunchOnTrail?: boolean;
}

export interface DayVariant {
  key: "A" | "B" | "C" | "main";
  label: string;
  audience: "adults" | "family" | "easy" | "any";
  relation: "alternative" | "parallel";
  items: ScheduleItem[];
  rank: number;
  /** After this item the party rejoins (split days). */
  rejoin?: { time: string; place: string; afterItem: string | null } | null;
  /** The split is a quiet option ("if Track A is taken") rather than the plan's own split day. */
  optionalSplit?: boolean;
}

export interface StoredLeg {
  /** An item id, a place slug, or "base" / "next-base" / "origin". */
  from: string;
  to: string;
  mode: LegMode;
  minutes: number;
  km: number | null;
  basis: "routed" | "plan" | "matrix";
  /** True when the source marked the value an estimate. Routed legs are never estimates. */
  estimate: boolean;
  /** Both directions use the same value unless a reverse row exists. */
  symmetric?: boolean;
}

export interface BaseRef {
  name: string;
  placeSlug: string | null;
  point: Point | null;
}

export interface SunWindow {
  /** Month-day pairs of the season window, dateless. */
  from: [number, number];
  to: [number, number];
}

export type DayKind = "normal" | "arrival" | "departure" | "transfer";

export interface ScheduleDayInput {
  day: number;
  kind: DayKind;
  tz: string;
  base: BaseRef | null;
  nextBase: BaseRef | null;
  /** The point sun times are computed for. */
  sunPoint: Point | null;
  sunWindow: SunWindow | null;
  variants: DayVariant[];
  legs: StoredLeg[];
  /** An authored start of the day. */
  start: { time: string; source: TimeSource; label: string | null } | null;
  /** Where the day begins and ends for a short trip (3.12). */
  origin: PlaceRef | null;
  homeBy: string | null;
  /** The day is one of the trip's days with a parallel option. */
  splitNote: string | null;
  /** A condensed plan (summary trip): parts of the day, no generated legs, meals or rests. */
  blocks?: boolean;
  /** Arrival days: check in before the first outing (default) or after the outings on the way. */
  checkin?: "first" | "last";
}

// ---- overrides and additions (3.6, 3.7) ----

export interface ScheduleOptions {
  /** A variant key picked for this day (d=5C). */
  variant?: string | null;
  /** Visitor additions, in insertion order; each is placed by cheapest insertion. */
  added?: ScheduleItem[];
}

/** Resolved legs, exposed for the UI. */
export interface ResolvedLeg {
  mode: LegMode;
  minutes: number;
  km: number | null;
  basis: LegBasis;
  /** "≈" when not routed. */
  estimate: boolean;
  /** The way runs through the day's base (a stop with no point): the title says "via Jasper". */
  via?: boolean;
}

export interface Suitability {
  minAge: number | null;
  maxAge: number | null;
  minHeightCm: number | null;
  maxHeightCm: number | null;
  minWeightKg: number | null;
  maxWeightKg: number | null;
  rule: "hard" | "advice" | null;
  stroller: "yes" | "partly" | "no" | null;
  wheelchair: "yes" | "partly" | "no" | null;
  carrierOk: boolean | null;
  familyEffort: 1 | 2 | 3 | 4 | 5 | null;
  sourceGrade: { system: "SAC" | "CAI" | "IMBA" | "whitewater" | "operator" | "local"; value: string } | null;
  childTime: { byAge: { fromAge: number; minutes: number }[]; source: string } | null;
  adultTime: { min: number; max: number; source: string } | null;
  distanceKm: number | null;
  gainM: number | null;
  lossM: number | null;
  provenance: string;
}
