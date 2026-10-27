// forTimeline and printTime (TRP-GL-C review F2 to F4): the one function the page's Export menu and the API's default-profile files use to
// apply a timeline to the export model. Small typed timelines; the real trips are checked against the page in
// web/tests/export/trip-routes.test.ts.
import { describe, expect, it } from "vitest";
import { forTimeline, printTime } from "../../src/export/plan.ts";
import { tripCsv } from "../../src/export/csv.ts";
import type { ExportStop, TripExport } from "../../src/export/types.ts";
import type { DayTimeline, TimelineEntry } from "../../src/schedule/types.ts";

type EntryOver = Partial<Omit<TimelineEntry, "time">> & Pick<TimelineEntry, "id" | "title" | "start"> & { slug?: string | null; confidence?: TimelineEntry["time"]["confidence"] };
const entry = ({ slug = null, confidence = "fixed", ...over }: EntryOver): TimelineEntry => ({
  day: 1, lane: "all", kind: "visit", sub: null, durationMin: 60, end: over.start, tz: "America/Edmonton", at: { name: over.title, placeSlug: slug, point: null }, from: null, to: null,
  time: { confidence, source: "plan", pinned: false, note: null }, duration: { source: "plan", basis: "" }, optional: false, addedBy: "author", sourceItemId: null, honesty: [], ...over,
});
const day = (n: number, entries: TimelineEntry[], over: Partial<DayTimeline> = {}): DayTimeline => ({
  day: n, variant: { key: "main", label: "Main", chosenBy: "profile", reason: "" }, lanes: ["all"], entries: entries.map((e) => ({ ...e, day: n })),
  span: { start: "08:00", end: "20:00", minutes: 720 }, totals: { activeMin: 0, driveMin: 0, walkKm: 0, gainM: 0 }, warnings: [], fits: true, blocks: false, notes: [], ...over,
});
const stop = (over: Partial<ExportStop> & Pick<ExportStop, "id" | "day">): ExportStop => ({
  order: 0, name: over.id, kind: "visit", category: null, area: null, time: null, durationMin: null, lane: null, note: null, placeSlug: null, links: [], point: null, ...over,
});
const model = (stops: ExportStop[]): TripExport => ({
  type: "trip", version: 2, slug: "t", title: "T", url: "https://x.invalid/trips/t/", depth: "full", nights: 2, tz: null, seasonLabel: null, skipped: 0, waypoints: [], lines: [], bookings: [],
  days: [1, 2, 3].map((n) => ({ n, title: `Day ${n}`, base: null })),
  stops: stops.map((s, order) => ({ ...s, order })),
});
/** The CSV's stop rows as [name, time], in the file's order. */
const csvRows = (m: TripExport) =>
  tripCsv(m).replace(/^﻿/, "").trimEnd().split("\r\n").slice(1, -1).map((l) => l.split(",")).map((c) => [c[2], c[1]]);

describe("printTime: the time as the page words it", () => {
  it("'~' for suggested, 'about' for the sun, the zone over a zone line, the part of the day on a condensed plan", () => {
    expect(printTime(entry({ id: "a", title: "A", start: "08:45", confidence: "suggested" }), false)).toBe("~08:45");
    expect(printTime(entry({ id: "a", title: "A", start: "19:30", confidence: "anchored" }), false)).toBe("about 19:30");
    expect(printTime(entry({ id: "a", title: "A", start: "07:30", tz: "PT" }), false)).toBe("07:30 PT");
    expect(printTime(entry({ id: "a", title: "A", start: "07:30" }), false)).toBe("07:30");
    expect(printTime(entry({ id: "a", title: "A", start: "07:30", block: "Morning" }), true)).toBe("Morning");
    expect(printTime(entry({ id: "a", title: "A", start: "07:30" }), true)).toBeNull();
  });
});

describe("forTimeline: one row per row of the timeline (review F3)", () => {
  // out to the lake in the morning, a walk at noon, back to the lake for the sunset: the plan lists the lake twice
  const tl = day(1, [
    entry({ id: "e1", title: "Lake", slug: "lake", start: "08:00", confidence: "suggested" }),
    entry({ id: "e2", title: "Walk", slug: "walk", start: "12:00" }),
    entry({ id: "e3", title: "Lake", slug: "lake", start: "19:30", confidence: "anchored" }),
  ]);
  const m = model([stop({ id: "s-lake-1", name: "Lake", day: 1, placeSlug: "lake" }), stop({ id: "s-walk", name: "Walk", day: 1, placeSlug: "walk" }), stop({ id: "s-lake-2", name: "Lake", day: 1, placeSlug: "lake" })]);
  const out = forTimeline(m, { timelines: [tl] });
  it("a place visited twice in a day keeps both rows, each with its own entry's time", () => {
    expect(out.stops.map((s) => [s.id, s.time])).toEqual([["s-lake-1", "~08:00"], ["s-walk", "12:00"], ["s-lake-2", "about 19:30"]]);
    expect(out.stops.map((s) => s.order)).toEqual([0, 1, 2]);
  });
  it("the CSV's stop rows per day equal the timeline's printed rows per day", () => {
    expect(csvRows(out)).toEqual([["Lake", "~08:00"], ["Walk", "12:00"], ["Lake", "about 19:30"]]);
  });
  it("a place several versions list is one row: the shown version's own copy", () => {
    const v = day(2, [entry({ id: "v1", title: "Ridge", slug: "ridge", start: "09:00" })], { variant: { key: "B", label: "Version B", chosenBy: "profile", reason: "" } });
    const both = model([stop({ id: "ridge-a", name: "Ridge", day: 2, placeSlug: "ridge", lane: "Lane A" }), stop({ id: "ridge-b", name: "Ridge", day: 2, placeSlug: "ridge", lane: "Lane B" })]);
    expect(forTimeline(both, { timelines: [v] }).stops.map((s) => s.id)).toEqual(["ridge-b"]);
  });
  it("a stop the timeline names only inside another entry is kept, untimed, after the timed rows", () => {
    const inner = day(1, [entry({ id: "i0", title: "Loop", slug: "loop", start: "10:00" }), entry({ id: "i1", title: "Falls", slug: "falls", start: "10:30", insideOf: "i0" })]);
    const m2 = model([stop({ id: "falls", name: "Falls", day: 1, placeSlug: "falls" }), stop({ id: "loop", name: "Loop", day: 1, placeSlug: "loop" })]);
    expect(forTimeline(m2, { timelines: [inner] }).stops.map((s) => [s.id, s.time])).toEqual([["loop", "10:00"], ["falls", null]]);
  });
  it("a stop with no place takes the row with its name (an airport); a stop of another version is left out", () => {
    const air = day(1, [entry({ id: "a1", title: "Calgary airport", start: "15:00", slug: null })]);
    const m3 = model([stop({ id: "yyc", name: "Calgary airport", day: 1 }), stop({ id: "other", name: "Elsewhere", day: 1, placeSlug: "elsewhere" })]);
    expect(forTimeline(m3, { timelines: [air] }).stops.map((s) => [s.id, s.time])).toEqual([["yyc", "15:00"]]);
  });
  it("a stop takes the print's row for its place (the walk), never the coffee break the scheduler puts there first", () => {
    const v = day(1, [entry({ id: "b", title: "Coffee and a snack", kind: "break", slug: "valley", start: "08:25" }), entry({ id: "r", title: "Free time", kind: "rest", slug: "valley", start: "08:45" }), entry({ id: "t", title: "Valley", kind: "trail", slug: "valley", start: "14:00", confidence: "suggested" })]);
    const two = model([stop({ id: "valley-1", name: "Valley", day: 1, placeSlug: "valley", lane: "Track 1" }), stop({ id: "valley-2", name: "Valley", day: 1, placeSlug: "valley", lane: "Track 2" })]);
    // two tracks list the walk; the timeline prints it once
    expect(forTimeline(two, { timelines: [v] }).stops.map((s) => [s.id, s.time])).toEqual([["valley-1", "~14:00"]]);
  });
  it("no timeline: the model as it is", () => {
    expect(forTimeline(m, null)).toBe(m);
  });
});

describe("the CSV follows the timeline's order, never the clock inside the time text (review F2)", () => {
  it("a condensed day: Morning before Afternoon whatever the plan's order", () => {
    const tl = day(1, [entry({ id: "m", title: "Museum", slug: "museum", start: "14:00", block: "Morning" }), entry({ id: "p", title: "Park", slug: "park", start: "09:00", block: "Afternoon" })], { blocks: true });
    const m = model([stop({ id: "park", name: "Park", day: 1, placeSlug: "park" }), stop({ id: "museum", name: "Museum", day: 1, placeSlug: "museum" })]);
    expect(csvRows(forTimeline(m, { timelines: [tl] }))).toEqual([["Museum", "Morning"], ["Park", "Afternoon"]]);
  });
  it("over a time-zone line: 08:30 PT before 08:15 MT when the timeline says so", () => {
    const tl = day(1, [entry({ id: "w", title: "West", slug: "west", start: "08:30", tz: "PT" }), entry({ id: "e", title: "East", slug: "east", start: "08:15", tz: "MT" })]);
    const m = model([stop({ id: "east", name: "East", day: 1, placeSlug: "east" }), stop({ id: "west", name: "West", day: 1, placeSlug: "west" })]);
    expect(csvRows(forTimeline(m, { timelines: [tl] }))).toEqual([["West", "08:30 PT"], ["East", "08:15 MT"]]);
  });
  it("without a timeline the CSV keeps the model's order (the builder numbers the authored HH:MM chronologically)", () => {
    const m = model([stop({ id: "b", name: "B", day: 1, time: "09:00" }), stop({ id: "a", name: "A", day: 1, time: "08:00" })]);
    expect(csvRows({ ...m, stops: m.stops.map((s) => ({ ...s, order: s.id === "a" ? 0 : 1 })) })).toEqual([["A", "08:00"], ["B", "09:00"]]);
  });
});
