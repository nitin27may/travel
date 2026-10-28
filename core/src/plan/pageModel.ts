// The built adapter (STEP2-M; gap-analysis D7, build-plan 3): a builder draft's last build as the trip details page's model
// (core/src/schema/api/trip.ts `TripPlanModel`, the shape the public page builds and `GET /api/v1/trips/{slug}/plan-model` serves), so
// `/t/<id>/` renders a built plan with the same components as a copy (README 4; edit-mode-spec 13). Pure: the engine's numbers come
// from `lastBuild` (bases, days, items with `startMin`, `visitMin`, `driveMin`), names and kinds from `resolveRefs` rows for the picks
// only (48 a call, P8), nothing from a file or the network. Household data stays out: the party, dates and origin are never read.
//
// Tolerant of keys a later document adds (STEP2-C1): the input is a `Pick` of the draft, so any other key is ignored.
import type { PlanDayOut, PlanDraft, PlanItemOut } from "../schema/plan-draft.ts";
import type { ResolveRow } from "../schema/favourites.ts";
import type { PlanDayRow, PlanSection, PlanStop, PlanTimelineDay, TripPlanModel } from "../schema/api/trip.ts";
import type { DayTimeline, ItemKind, ScheduleDayInput, ScheduleItem, StoredLeg, TimelineEntry } from "../schedule/types.ts";
import { fmtHM } from "../schedule/rules.ts";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "../export/publicTypes.ts";

/** What the adapter reads of a draft: its id (the timeline's key), pace, picks (the snapshot names) and last build. */
export type BuiltDraftInput = Pick<PlanDraft, "id" | "pace" | "picks" | "lastBuild">;

export interface BuiltModelOptions {
  /** The short zone label the entries show beside a time (`MT`); the draft does not know it, so none by default. */
  tz?: string;
}

/** The words of the one version a built day has. */
export const BUILT_VARIANT_LABEL = "Your plan";

const DAY_MIN = 24 * 60;
/** The last minute an entry may end on (the scheduler's S_MIDNIGHT rule). */
const LAST_MIN = DAY_MIN - 1;

/** "HH:MM" of minutes after midnight; past 1440 is the next morning's clock. */
export const clockOf = (min: number): string => {
  const m = ((Math.round(min) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** The scheduler's kind and sub for a catalogue kind word (the public page's own mapping, web/components/trips/timeline/model.ts). */
function itemKindOf(kind: string): { kind: ItemKind; sub: string | null } {
  if (kind === "trail") return { kind: "trail", sub: "hike" };
  if (kind === "eatery") return { kind: "meal", sub: "lunch" };
  if (kind === "lift") return { kind: "visit", sub: "lift-ride" };
  if (kind === "activity") return { kind: "visit", sub: "activity" };
  if (kind === "lake" || kind === "viewpoint" || kind === "waterfall" || kind === "town") return { kind: "visit", sub: kind };
  return { kind: "visit", sub: "sight" };
}

/** The Stops tab category of a kind word (web/lib/public/taxonomy.ts CATEGORY_OF_KIND). */
function categoryOfKind(kind: string): Category {
  if (kind === "trail") return "trails";
  if (kind === "stay") return "stays";
  if (kind === "eatery") return "food";
  if (kind === "activity" || kind === "lift") return "activities";
  return "sights";
}

/** The icons a day without a photo may show (web/components/trips/model.ts `dayGlyph`); any other kind reads as a mountain. */
const GLYPHS: ReadonlySet<string> = new Set(["trail", "lake", "viewpoint", "waterfall", "sight", "town", "lift", "hut", "eatery", "activity", "valley", "canyon", "island", "park", "scenic", "event"]);

interface Resolved {
  name: string;
  kind: string;
  slug: string;
}

/** Each pick's name, kind and current slug: the resolve row when it is current or moved, else the draft's own snapshot. */
function resolverOf(draft: BuiltDraftInput, rows: readonly ResolveRow[]): (item: Pick<PlanItemOut, "ref" | "slug" | "name">) => Resolved {
  const byAsked = new Map<string, ResolveRow>();
  for (const r of rows) {
    byAsked.set(r.asked, r);
    if (r.ref) byAsked.set(r.ref, r);
  }
  const snapshot = new Map(draft.picks.map((p) => [p.ref, p.name]));
  return (it) => {
    const row = byAsked.get(it.ref) ?? byAsked.get(`place:${it.slug}`);
    const live = row && (row.state === "current" || row.state === "moved" || row.state === "merged") ? row : null;
    return { name: live?.name ?? snapshot.get(it.ref) ?? it.name, kind: live?.kind ?? "sight", slug: live?.slug ?? it.slug };
  };
}

/** The title of a built day: its first two stops, or the base for a day with none. */
function dayTitle(names: readonly string[], base: string | null, n: number): string {
  if (names.length >= 2) return `${names[0]} and ${names[1]}`;
  return names[0] ?? base ?? `Day ${n}`;
}

const place = (name: string, slug: string | null) => ({ name, placeSlug: slug, point: null });

interface DayParts {
  row: PlanDayRow;
  timelineDay: PlanTimelineDay;
  timeline: DayTimeline;
  stops: { key: string; name: string; kind: string; slug: string; time: string | null }[];
}

function dayParts(d: PlanDayOut, baseName: (town: string | null) => string | null, prevBase: string | null, resolve: ReturnType<typeof resolverOf>, tz: string): DayParts {
  const base = baseName(d.base);
  const items = d.items.map((it) => ({ it, r: resolve(it) }));
  const entries: TimelineEntry[] = [];
  const scheduleItems: ScheduleItem[] = [];
  const legs: StoredLeg[] = [];
  const stops: DayParts["stops"] = [];
  let cursor: number | null = null;
  let untimed = false;
  let driveMin = 0;
  let estimate = false;
  let prevId = "base";
  let prevPlace = place(baseName(prevBase) ?? base ?? "", null);

  for (const { it, r } of items) {
    const k = itemKindOf(r.kind);
    const start: number | null = it.startMin ?? (cursor !== null ? cursor + (it.driveMin ?? 0) : null);
    if (start === null) untimed = true;
    const est = it.basis !== "routed";
    const here = place(r.name, r.slug);
    if (it.driveMin !== null && it.driveMin > 0) {
      driveMin += it.driveMin;
      estimate ||= est;
      legs.push({ from: prevId, to: it.ref, mode: "drive", minutes: it.driveMin, km: null, basis: est ? "matrix" : "routed", estimate: est });
      const legStart = start === null ? null : Math.max(0, start - it.driveMin);
      entries.push({
        id: `${d.day}-all-leg-drive-${it.ref}`, day: d.day, lane: "all", kind: "leg", sub: "drive", title: `Drive to ${r.name}`,
        start: legStart === null ? "" : clockOf(legStart), durationMin: it.driveMin, end: start === null ? "" : clockOf(Math.min(start, LAST_MIN)), tz,
        at: null, from: prevPlace, to: here,
        time: { confidence: "suggested", source: "rule", pinned: false, note: null },
        duration: { source: "rule", basis: est ? "estimate" : "routed" },
        leg: { mode: "drive", km: null, basis: est ? "estimate" : "routed", breaks: 0 },
        optional: false, addedBy: "scheduler", sourceItemId: null, honesty: est ? ["drive_estimated"] : [],
      });
    }
    const end: number | null = start === null ? null : start + it.visitMin;
    entries.push({
      id: it.ref, day: d.day, lane: "all", kind: k.kind === "trail" ? "trail" : k.kind === "meal" ? "meal" : "visit", sub: k.sub, title: r.name,
      start: start === null ? "" : clockOf(start), durationMin: it.visitMin, end: end === null ? "" : clockOf(start! < DAY_MIN ? Math.min(end, LAST_MIN) : end), tz,
      at: here, from: null, to: null,
      time: { confidence: "suggested", source: "rule", pinned: it.locked, note: null },
      duration: { source: "rule", basis: "the plan builder" },
      optional: false, addedBy: "scheduler", sourceItemId: it.ref, honesty: [],
    });
    scheduleItems.push({
      id: it.ref, kind: k.kind, sub: k.sub, title: r.name, placeSlug: r.slug, point: null, rule: null, durationMin: it.visitMin, durationRange: null,
      durationSource: "plan", stats: null, start: start === null ? null : { time: clockOf(start), confidence: "suggested", source: "rule" }, needs: null, window: null,
      checkinMin: null, optional: false, note: null, minAge: null, minAgeRule: null, needsDaylight: k.kind === "trail", honesty: [],
    });
    stops.push({ key: it.ref, name: r.name, kind: r.kind, slug: r.slug, time: start === null ? null : clockOf(start) });
    cursor = end;
    prevId = it.ref;
    prevPlace = here;
  }
  if (d.returnMin !== null && d.returnMin > 0) {
    driveMin += d.returnMin;
    const to = place(base ?? "", null);
    entries.push({
      id: `${d.day}-all-leg-drive-return`, day: d.day, lane: "all", kind: "leg", sub: "drive", title: base ? `Drive to ${base}` : "Drive back",
      start: cursor === null ? "" : clockOf(cursor), durationMin: d.returnMin, end: cursor === null ? "" : clockOf(cursor < DAY_MIN ? Math.min(cursor + d.returnMin, LAST_MIN) : cursor + d.returnMin), tz,
      at: null, from: prevPlace, to,
      time: { confidence: "suggested", source: "rule", pinned: false, note: null },
      duration: { source: "rule", basis: "estimate" },
      leg: { mode: "drive", km: null, basis: "estimate", breaks: 0 },
      optional: false, addedBy: "scheduler", sourceItemId: null, honesty: [],
    });
  }

  const names = items.map((x) => x.r.name);
  const title = dayTitle(names, base, d.day);
  const glyph = items.map((x) => x.r.kind).find((k) => GLYPHS.has(k)) ?? "mountain";
  const visitMin = d.items.reduce((n, it) => n + it.visitMin, 0);
  const timed = entries.filter((e) => e.start !== "");
  const first = timed[0];
  const last = timed[timed.length - 1];
  const spanStart = first ? first.start : "";
  const spanEnd = last ? last.end : "";
  const minutes = first && last ? Math.max(0, toMin(spanEnd) - toMin(spanStart)) : 0;
  const stopModels: PlanStop[] = stops.map((s) => ({ id: s.key, name: s.name, kind: s.kind, time: s.time, stats: null, note: null, access: null, variant: null, placeSlug: s.slug }));

  const input: ScheduleDayInput = {
    day: d.day, kind: d.move ? "transfer" : "normal", tz, base: base ? place(base, null) : null, nextBase: null, sunPoint: null, sunWindow: null,
    variants: [{ key: "main", label: BUILT_VARIANT_LABEL, audience: "any", relation: "alternative", items: scheduleItems, rank: 0 }],
    legs, start: null, origin: null, homeBy: null, splitNote: null,
  };
  return {
    row: { n: d.day, title, base, drive: driveMin > 0 ? `${estimate ? "≈" : ""}${fmtHM(driveMin)}` : null, driveIsEstimate: estimate, thumb: null, glyph, summary: null, stops: stopModels, tracks: null, defaultTrack: null },
    timelineDay: { n: d.day, title, base, thumb: null, glyph, summary: null, light: null, input, variants: [], know: [] },
    timeline: {
      day: d.day,
      variant: { key: "main", label: BUILT_VARIANT_LABEL, chosenBy: "profile", reason: "" },
      lanes: ["all"],
      entries,
      span: { start: spanStart, end: spanEnd, minutes },
      totals: { activeMin: visitMin, driveMin, walkKm: 0, gainM: 0 },
      // the build's day-check codes stay on lastBuild; the page reads them with their level (WARN_LEVEL, STEP2-E5)
      warnings: [],
      fits: true,
      // a day the build left untimed reads in parts of the day, never with invented clock times
      blocks: untimed,
      notes: [],
    },
    stops,
  };
}

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/**
 * A built draft's last build as the details page's model: one day row and one timeline day per built day, in day order, with the
 * engine's times, drives and bases; the Stops tab's sections from the picks placed on a day; no photos, map points or add candidates
 * (resolve rows carry none; the picker asks `near` itself, STEP2-E3). Null when the draft has no build yet ("Not built yet",
 * edit-mode-spec 15).
 */
export function tripPageModelForBuilt(draft: BuiltDraftInput, rows: readonly ResolveRow[] = [], opts: BuiltModelOptions = {}): TripPlanModel | null {
  const build = draft.lastBuild;
  if (!build) return null;
  const tz = opts.tz ?? "";
  const names = new Map(build.bases.map((b) => [b.town, b.name]));
  const baseName = (town: string | null): string | null => (town ? (names.get(town) ?? null) : null);
  const resolve = resolverOf(draft, rows);
  const days = [...build.days].sort((a, b) => a.day - b.day);
  const parts: DayParts[] = [];
  let prevBase: string | null = null;
  for (const d of days) {
    parts.push(dayParts(d, baseName, prevBase, resolve, tz));
    prevBase = d.base;
  }

  // the Stops tab: each placed pick once, in its category, with every day it is on
  const byKey = new Map<string, { cat: Category; row: PlanSection["rows"][number] }>();
  for (const p of parts) for (const s of p.stops) {
    const hit = byKey.get(s.key);
    if (hit) {
      if (!hit.row.days.includes(p.row.n)) hit.row.days.push(p.row.n);
      continue;
    }
    byKey.set(s.key, { cat: categoryOfKind(s.kind), row: { key: s.key, name: s.name, kind: s.kind, placeSlug: s.slug, days: [p.row.n], time: s.time, area: p.row.base, detail: null, nights: null, bookRule: null, bookNote: null } });
  }
  const placed = [...byKey.values()];
  const sections: PlanSection[] = CATEGORIES.map((id) => {
    const rowsOf = placed.filter((x) => x.cat === id).map((x) => x.row);
    return { id, label: CATEGORY_LABEL[id], count: rowsOf.length, rows: rowsOf };
  });

  return {
    timeline: parts.length
      ? {
          slug: draft.id,
          defaultProfile: { party: "adults", youngest: null, pace: draft.pace, walkKm: null, split: false },
          writtenFor: "",
          condensed: false,
          hasSplit: false,
          hasVariants: false,
          days: parts.map((p) => p.timelineDay),
          defaultTimelines: parts.map((p) => p.timeline),
          addables: {},
          addByDay: Object.fromEntries(parts.map((p) => [String(p.row.n), []])),
          suit: {},
        }
      : null,
    days: parts.map((p) => p.row),
    sections,
    // resolve rows carry no points, so nothing is drawn; every placed stop is counted as not on the map yet (RouteModel `unplaced`)
    route: {
      bases: [],
      days: parts.map((p) => ({ n: p.row.n, title: p.row.title, base: p.row.base, points: [], unplaced: p.stops.length })),
      unplaced: parts.reduce((n, p) => n + p.stops.length, 0),
    },
    gallery: [],
    credits: [],
  };
}
