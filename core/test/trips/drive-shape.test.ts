import { describe, expect, it } from "vitest";
import { LONG_DRIVE_MIN, dayDriveMin, driveAverageMin } from "../../src/trips/drive.ts";
import { mainVariantKey, tripShape, type ShapeInput } from "../../src/trips/shape.ts";
import type { DayTimeline, TimelineEntry } from "../../src/schedule/types.ts";

const e = (kind: TimelineEntry["kind"], extra: Partial<TimelineEntry> = {}): TimelineEntry =>
  ({ id: `${kind}-${Math.random()}`, day: 1, lane: "all", kind, sub: null, title: "", start: "09:00", durationMin: 0, end: "09:00", tz: "UTC", at: null, from: null, to: null,
     time: { confidence: "suggested", source: "rule", pinned: false, note: null }, duration: { source: "rule", basis: "" }, optional: false, addedBy: "scheduler", sourceItemId: null, ...extra }) as TimelineEntry;
const at = (slug: string) => ({ name: slug, placeSlug: slug, point: null });
const tl = (day: number, driveMin: number, entries: TimelineEntry[], o: Partial<DayTimeline> = {}): DayTimeline =>
  ({ day, variant: { key: "B", label: "Whole family", chosenBy: "profile", reason: "" }, lanes: ["all"], entries, span: { start: "08:00", end: "18:00", minutes: 600 },
     totals: { activeMin: 300, driveMin, walkKm: 3, gainM: 100 }, warnings: [], fits: true, blocks: false, notes: [], ...o }) as DayTimeline;

describe("one drive figure (spec 4.7, I14)", () => {
  it("a timed day shows the timeline's total; a condensed day the plan's own figure", () => {
    expect(dayDriveMin({ totals: { driveMin: 130 }, blocks: false }, 60)).toBe(130);
    expect(dayDriveMin({ totals: { driveMin: 0 }, blocks: true }, 150)).toBe(150);
    expect(dayDriveMin({ totals: { driveMin: 90 }, blocks: true }, null)).toBe(90);
    expect(dayDriveMin({ totals: { driveMin: 0 }, blocks: true }, null)).toBeNull();
    expect(dayDriveMin(null, 45)).toBe(45);
    expect(dayDriveMin(undefined, null)).toBeNull();
  });
  it("averages every day of the trip (a day with no drive counts 0), to 5 minutes", () => {
    // the Rockies at the default party, 26 Oct 2026: 1,765 min over 15 days = 117.7 -> 120 ("about 2 h", not the seed's 1 h 40)
    const rockies = [150, 90, 120, 175, 150, 130, 130, 225, 130, 50, 0, 125, 105, 110, 75];
    expect(driveAverageMin(rockies.map((m) => ({ tl: { totals: { driveMin: m }, blocks: false }, planned: null })))).toBe(120);
    expect(driveAverageMin([])).toBeNull();
    expect(driveAverageMin([{ tl: { totals: { driveMin: 0 }, blocks: true }, planned: null }])).toBeNull();
    expect(driveAverageMin([{ tl: null, planned: 61 }, { tl: null, planned: null }])).toBe(60);
  });
});

describe("the trip's shape (spec 4.2, W5)", () => {
  const variants = [{ key: "A", label: "Adults", audience: "adults" }, { key: "B", label: "Whole family", audience: "family" }];
  const base: ShapeInput = {
    days: [1, 2, 3, 4].map((n) => ({ n, title: `Day ${n}`, base: n < 3 ? "Banff" : "Jasper", plannedDriveMin: null, variants })),
    bases: [{ name: "Banff", nights: 2, days: [1, 2] }, { name: "Jasper", nights: 1, days: [3] }],
    timelines: [
      tl(1, 150, [e("checkin"), e("trail", { durationMin: 50, at: at("johnston-canyon") })]),
      tl(2, 40, [e("trail", { durationMin: 60 })], { warnings: [{ code: "S_DAY_CAP", message: "long", entryId: null, lane: "all" }] }),
      tl(3, 225, [e("checkin"), e("visit", { at: at("athabasca-falls-walk") })], { variant: { key: "A", label: "Adults", chosenBy: "profile", reason: "" } }),
      tl(4, 75, [e("checkout"), e("leg", { to: { name: "Calgary airport", placeSlug: null, point: null } })]),
    ],
    bookingDays: [1, 1, 3, null],
    highlightSlugs: ["johnston-canyon", "athabasca-falls-walk"],
    changedDays: [2],
  };
  const s = tripShape(base);
  it("counts long drives (2 h 30 or more), bookings, highlights and warnings by day", () => {
    expect(LONG_DRIVE_MIN).toBe(150);
    expect(s.sets).toEqual({ longDrive: [1, 3], booking: [1, 3], highlight: [1, 3], warning: [2], light: [2] });
    expect(s.countLine).toBe("4 days · 2 long drive days · 2 days with a booking · 2 highlight days · 1 day with a warning");
    expect(s.phrases.map((p) => p.key)).toEqual(["days", "longDrive", "booking", "highlight", "warning"]);
  });
  it("writes notes as words, the version only when it is not the main one", () => {
    expect(s.rows[0]!.notes.map((n) => n.text)).toEqual(["Long drive", "Book 2", "Highlight"]);
    expect(s.rows[1]!.notes.map((n) => n.text)).toEqual(["Warning 1", "Light day", "Changed"]);
    expect(s.rows[2]!.notes.map((n) => n.text)).toEqual(["Long drive", "Book 1", "Highlight", "Adults"]);
    expect(s.rows[3]!.notes.map((n) => n.text)).toEqual(["Flight home"]);
    expect(mainVariantKey(variants)).toBe("B");
    expect(mainVariantKey([{ key: "main", label: "", audience: "any" }])).toBe("main");
  });
  it("scales the drive bar to the longest drive day and keeps the walk of the party on screen", () => {
    expect(s.maxDriveMin).toBe(225);
    expect(s.rows[2]!.driveShare).toBe(1);
    expect(s.rows[1]!.driveShare).toBeCloseTo(40 / 225, 3);
    expect(s.rows[0]!.walkKm).toBe(3);
    expect(s.rows[0]!.onFootMin).toBe(50);
  });
  it("draws the ribbon by nights and the departure day after it", () => {
    expect(s.ribbon).toEqual([{ name: "Banff", nights: 2, days: [1, 2], share: 0.667 }, { name: "Jasper", nights: 1, days: [3], share: 0.333 }]);
    expect(s.tail).toEqual({ days: [4], label: "Flight home" });
  });
  it("leaves zero counts out of the line and says Last day without an airport", () => {
    const quiet = tripShape({ ...base, timelines: base.timelines.map((t) => ({ ...t, warnings: [], totals: { ...t.totals, driveMin: 30 }, entries: t.entries.filter((x) => x.kind !== "leg") })), bookingDays: [], highlightSlugs: [], changedDays: [] });
    expect(quiet.countLine).toBe("4 days");
    expect(quiet.rows[3]!.notes.map((n) => n.text)).toEqual(["Last day"]);
  });
});
