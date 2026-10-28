// Maps a scheduled day to planner `items` rows so `checkDays` (core/src/checks) can run on it (spec 2.11), and so a copy
// into the planner carries the day (3.9). Legs become the leg_* columns of the next non-leg row, as in the planner.
import { fmtMin } from "../checks/time.ts";
import { toMin } from "../checks/time.ts";
import { ACTIVE_BUDGET_MIN, PACE_RULES, walkCeiling } from "./rules.ts";
import type { DayTimeline, Profile, TimelineEntry } from "./types.ts";

export type Row = Record<string, unknown>;

const TYPE: Record<TimelineEntry["kind"], string> = {
  start: "buffer", leg: "transfer", visit: "sight", trail: "trail", meal: "meal", break: "break", rest: "rest", checkin: "checkin",
  checkout: "checkout", booking: "activity", sun: "buffer", end: "buffer",
};

/** The planner type for an entry: an activity-like visit is an `activity`. */
function typeOf(e: TimelineEntry): string {
  if (e.kind === "visit" && (e.sub === "activity" || e.sub === "lift-ride" || e.sub === "hot-spring" || e.sub === "boat")) return "activity";
  return TYPE[e.kind];
}

const track = (lane: TimelineEntry["lane"]): string | null => (lane === "all" ? null : lane);

export interface ItemRowOptions {
  /** Drop the generated rows (meals, breaks, rests) when false. A public copy keeps them so the planner can delete them. */
  generated?: boolean;
}

/** Rows for one day. Sun markers, start and end entries are not rows. */
export function toItems(t: DayTimeline, opts: ItemRowOptions = {}): Row[] {
  const rows: Row[] = [];
  const pending: Record<TimelineEntry["lane"], { mode: string; minutes: number; basis: string; km: number | null } | null> = { all: null, A: null, B: null, C: null };
  let seq = 0;
  const seqByLane: Record<string, number> = {};
  for (const e of t.entries) {
    if (e.kind === "sun" || e.kind === "start" || e.kind === "end") continue;
    if (e.kind === "leg") {
      const prev = pending[e.lane];
      // a drive then the walk in to a trailhead (SW-022) is one way to the stop, by car: the drive's mode, basis and km, the walk's minutes added
      const keep = prev?.mode === "drive" && e.leg?.mode === "walk";
      pending[e.lane] = keep
        ? { ...prev!, minutes: prev!.minutes + e.durationMin }
        : { mode: e.leg?.mode ?? "drive", minutes: (prev?.minutes ?? 0) + e.durationMin, basis: e.leg?.basis ?? "estimate", km: e.leg?.km ?? null };
      continue;
    }
    if (opts.generated === false && e.addedBy === "scheduler" && (e.kind === "meal" || e.kind === "break" || e.kind === "rest")) continue;
    const leg = pending[e.lane] ?? pending.all;
    pending[e.lane] = null;
    if (e.lane !== "all") pending.all = null;
    seq = (seqByLane[e.lane] = (seqByLane[e.lane] ?? 0) + 1);
    const w = e.time.window;
    rows.push({
      id: e.id, day: t.day, track: track(e.lane), seq, title: e.title, type: typeOf(e), start: e.start, duration_min: e.durationMin,
      optional: e.optional, pinned: e.time.pinned, needs_daylight: e.kind === "trail", tz: e.tz,
      leg_mode: leg ? leg.mode : null, leg_minutes: leg ? leg.minutes : null, leg_km: leg?.km ?? null, leg_basis: leg ? (leg.basis === "routed" ? "ors" : leg.basis === "plan" ? "plan" : "inference") : null,
      open_from: e.kind === "visit" || e.kind === "trail" ? (w?.from ?? null) : null,
      open_to: e.kind === "visit" || e.kind === "trail" ? (w?.to ?? null) : null,
      window_start: null, window_end: null, closed_weekdays: [],
      lat: e.at?.point?.lat ?? null, lon: e.at?.point?.lon ?? null,
      trail_id: e.kind === "trail" ? (e.sourceItemId ?? e.id) : null,
      override: e.kind === "trail" ? { km: e.stats?.distanceKm ?? null, gain_m: e.stats?.gainM ?? null } : null,
      booking_id: null, activity_id: null, eatery_id: null, custom_item_id: null, place_id: null, base_id: null, leg_id: null,
      notes: e.time.note ?? "", links: [],
    });
  }
  return rows;
}

/** A minimal trip document `checkDays` accepts, for the party's lanes of a set of days. */
export function toTrip(timelines: DayTimeline[], profile: Profile): Row {
  const pace = { relaxed: 2, standard: 3, full: 4 }[profile.pace];
  const ceil = walkCeiling(profile);
  return {
    trip: { origin_tz: timelines[0]?.entries[0]?.tz ?? "UTC" },
    profile: {
      pace, daily_max_drive_min: PACE_RULES[profile.pace].driveLimitMin, early_starts: "never", hiking_ceiling_km: ceil.km,
      hiking_ceiling_gain_m: ceil.gainM, max_house_grade: null,
    },
    days: timelines.map((t) => ({ n: t.day, kind: "mixed", base_id: null, accepted_warnings: [] })),
    items: timelines.flatMap((t) => toItems(t)),
    bases: [], trip_bookings: [], travellers: [], editions: [], custom_items: [],
  };
}

export const paceBudget = (profile: Profile): number => ACTIVE_BUDGET_MIN[profile.pace];
export { fmtMin, toMin };
