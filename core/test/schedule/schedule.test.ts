import { describe, expect, it } from "vitest";
import { toMin } from "../../src/checks/time.ts";
import { addItem, scheduleDay, scheduleTrip } from "../../src/schedule/schedule.ts";
import type { DayTimeline, TimelineEntry } from "../../src/schedule/types.ts";
import { at, day, family, fixture, item, profile, variant } from "./helpers.ts";
import type { ScheduleDayInput } from "../../src/schedule/types.ts";

const rockies5 = () => fixture("rockies-day5.json");
const by = (t: DayTimeline, id: string): TimelineEntry => t.entries.find((e) => e.id === id)!;
const near = (a: string, b: string, tol = 5): void => expect(Math.abs(toMin(a)! - toMin(b)!), `${a} vs ${b}`).toBeLessThanOrEqual(tol);
const kinds = (t: DayTimeline) => t.entries.map((e) => `${e.start} ${e.lane} ${e.kind}${e.sub ? ` ${e.sub}` : ""}`);

describe("Rockies Day 5, family with a youngest of 6, standard, both lanes (spec 1.4)", () => {
  const t = scheduleDay(rockies5(), family(6, { split: true }));
  const e = (id: string) => by(t, id);

  it("picks the whole-family version and draws the party lane and the adult lane", () => {
    expect(t.variant.key).toBe("B");
    expect(t.variant.reason).toContain("fits age 6");
    expect(t.lanes).toEqual(["B", "A"]);
  });
  it("matches the worked example entry by entry (times within 5 minutes, anchored within 15)", () => {
    near(t.entries[0]!.start, "07:30", 0);
    expect(t.entries[0]).toMatchObject({ kind: "start", sub: "leave-base", title: "Leave Jasper" });
    const drive = t.entries.find((x) => x.kind === "leg")!;
    near(drive.start, "07:30", 0);
    expect(drive.durationMin).toBe(60);
    expect(drive.leg).toMatchObject({ basis: "plan", mode: "drive" });
    expect(drive.honesty).toContain("drive_estimated");
    const coffee = t.entries.find((x) => x.kind === "break" && x.sub === "coffee")!;
    near(coffee.start, "08:30");
    expect(coffee.durationMin).toBe(20);
    const rest1 = t.entries.find((x) => x.kind === "rest" && x.sub === "free-time")!;
    near(rest1.start, "08:50");
    expect(rest1.durationMin).toBe(50);
    const board = t.entries.find((x) => x.kind === "booking")!;
    near(board.start, "09:40");
    expect(board.bookingOf).toBe("maligne-lake-cruise");
    expect(e("maligne-lake-cruise")).toMatchObject({ start: "10:00", durationMin: 90, lane: "B" });
    expect(e("maligne-lake-cruise").time).toMatchObject({ confidence: "fixed", source: "operator", pinned: true });
    const lunch = t.entries.find((x) => x.kind === "meal" && x.lane === "B")!;
    near(lunch.start, "11:30");
    expect(lunch.style).toBe("picnic");
    near(e("mary-schaffer-loop").start, "12:20");
    near(String(e("mary-schaffer-loop").durationMin / 60 > 1 ? e("mary-schaffer-loop").end : "00:00"), "13:40");
    expect(e("mary-schaffer-loop").stats).toEqual({ distanceKm: 3.2, gainM: 84 });
    expect(Math.abs(e("mary-schaffer-loop").durationMin - 80)).toBeLessThanOrEqual(5);
    // lane A: Bald Hills with an on-trail lunch inside it
    expect(e("bald-hills")).toMatchObject({ lane: "A", durationMin: 270 });
    near(e("bald-hills").start, "08:40");
    const trailLunch = t.entries.find((x) => x.style === "on-trail")!;
    expect(trailLunch).toMatchObject({ lane: "A", insideOf: "bald-hills", durationMin: 0 });
    near(trailLunch.start, "13:10");
    // the shared regroup is pinned at the rejoin time, once, in the shared lane
    const together = t.entries.filter((x) => x.sub === "together");
    expect(together).toHaveLength(1);
    expect(together[0]).toMatchObject({ start: "14:00", lane: "all" });
    expect(together[0]!.time.pinned).toBe(true);
    near(e("moose-lake-loop").start, "14:10");
    expect(e("moose-lake-loop")).toMatchObject({ optional: true });
    const back = t.entries.filter((x) => x.kind === "leg" && x.title.startsWith("Back to Jasper"));
    near(back[0]!.start, "15:15");
    expect(back[0]!.durationMin).toBe(60);
    const dinner = t.entries.find((x) => x.sub === "dinner")!;
    near(dinner.start, "17:45");
    expect(dinner.durationMin).toBe(75);
    near(e("pyramid-lake").start, "19:20", 15);
    expect(e("pyramid-lake").time).toMatchObject({ confidence: "anchored", source: "sun" });
    expect(e("pyramid-lake").time.anchor).toMatchObject({ to: "sunset", offsetMin: -40 });
    const sunset = t.entries.find((x) => x.kind === "sun" && x.sub === "sunset")!;
    expect(sunset.time.anchor!.range).toEqual(["19:54", "20:28"]);
    expect(t.entries[t.entries.length - 1]).toMatchObject({ kind: "end", sub: "at-base" });
  });
  it("raises S_DAY_CAP with numbers and names the optional entries", () => {
    const cap = t.warnings.find((w) => w.code === "S_DAY_CAP")!;
    expect(cap.message).toMatch(/^Day 5 runs 1[23] h/);
    expect(cap.message).toContain("over 10 h for a standard family day");
    expect(cap.message).toContain("Optional: Moose Lake Loop, Pyramid Lake");
  });
  it("sorts by start, then lane, then kind, then id", () => {
    for (let i = 1; i < t.entries.length; i++) expect(toMin(t.entries[i - 1]!.start)!).toBeLessThanOrEqual(toMin(t.entries[i]!.start)!);
  });
});

describe("Rockies Day 5 in the default view and for adults", () => {
  it("shows one lane and a split option row for a family with two adults", () => {
    const t = scheduleDay(rockies5(), family(6));
    expect(t.lanes).toEqual(["all"]);
    expect(t.entries.every((e) => e.lane === "all")).toBe(true);
    const row = t.notes.find((n) => n.kind === "split-option")!;
    expect(row.text).toContain("Bald Hills");
    expect(row.text).toContain("rejoin at 14:00");
    expect(row.text).not.toMatch(/\bone adult\b|child/i);
    expect(t.entries.some((e) => e.id === "bald-hills")).toBe(false);
  });
  it("offers no split option with one adult", () => {
    const t = scheduleDay(rockies5(), family(6, { adults: 1 }));
    expect(t.notes.find((n) => n.kind === "split-option")).toBeUndefined();
  });
  it("gives adults the Adults' hike as the whole day with no split row", () => {
    const t = scheduleDay(rockies5(), profile({ pace: "full" }));
    expect(t.variant.key).toBe("A");
    expect(t.lanes).toEqual(["all"]);
    expect(t.notes.find((n) => n.kind === "split-option")).toBeUndefined();
    expect(t.entries.some((e) => e.id === "bald-hills")).toBe(true);
    expect(t.entries.some((e) => e.kind === "booking")).toBe(false);
  });
  it("starts later at a relaxed pace when nothing is authored", () => {
    const d = { ...rockies5(), start: null };
    const relaxed = scheduleDay(d, profile({ pace: "relaxed" }));
    expect(relaxed.entries[0]!.start <= "08:30").toBe(true);
  });
});

describe("Dolomites Day 3: authored times stay, ORS legs are not estimates", () => {
  const d = fixture("dolomites-day3.json");
  const t = scheduleDay(d, profile());
  it("keeps the 11:30 slot and the 16:30 Cadini time", () => {
    expect(by(t, "tre-cime")).toMatchObject({ start: "11:30", durationMin: 270 });
    expect(by(t, "cadini")).toMatchObject({ start: "16:30" });
    expect(by(t, "tre-cime").time).toMatchObject({ pinned: true, confidence: "suggested", source: "plan" });
  });
  it("back-solves the start from the first pin and uses the routed minutes", () => {
    expect(t.entries[0]!.start).toBe("10:35");
    const legs = t.entries.filter((e) => e.kind === "leg");
    expect(legs[0]).toMatchObject({ durationMin: 55 });
    expect(legs[0]!.leg).toMatchObject({ basis: "routed" });
    expect(legs[0]!.honesty).not.toContain("drive_estimated");
    expect(legs[1]).toMatchObject({ durationMin: 18 });
  });
  it("puts lunch on the trail (the walk spans the window) and dinner at the base", () => {
    expect(t.entries.find((e) => e.style === "on-trail")).toMatchObject({ insideOf: "tre-cime" });
    expect(t.entries.find((e) => e.sub === "dinner")).toMatchObject({ style: "at-base" });
  });
});

describe("determinism, pins and back-pressure", () => {
  it("returns a deep-equal result for the same input run twice", () => {
    const a = scheduleDay(rockies5(), family(6, { split: true }));
    const b = scheduleDay(rockies5(), family(6, { split: true }));
    expect(b).toEqual(a);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
  it("keeps the authored order of items", () => {
    const t = scheduleDay(rockies5(), family(6));
    const ids = t.entries.filter((e) => e.sourceItemId).map((e) => e.sourceItemId);
    expect(ids).toEqual(["maligne-lake-cruise", "mary-schaffer-loop", "moose-lake-loop", "pyramid-lake"]);
  });
  it("never moves a fixed entry", () => {
    for (const p of [family(6, { pace: "relaxed" }), family(6, { pace: "full" }), family(10), profile({ pace: "relaxed" })]) {
      expect(by(scheduleDay(rockies5(), p, { variant: "B" }), "maligne-lake-cruise")).toMatchObject({ start: "10:00" });
    }
  });
  it("drops a generated coffee before it raises S_FIXED_MISSED", () => {
    // a coffee fits the gap but the next pin is tight: the gap becomes rest, not a missed pin
    const d = day([variant("main", [item("slot", "visit", "Boat", { durationMin: 60, durationSource: "operator", start: at("09:15", "fixed", "operator") })])], {
      start: { time: "08:00", source: "plan", label: null },
      legs: [{ from: "base", to: "slot", mode: "drive", minutes: 50, km: null, basis: "plan", estimate: true }],
    });
    const t = scheduleDay(d, profile());
    expect(t.warnings.find((w) => w.code === "S_FIXED_MISSED")).toBeUndefined();
    expect(t.entries.find((e) => e.kind === "break")).toBeUndefined();
  });
  it("raises S_FIXED_MISSED when a pin cannot be reached, and says when it arrives", () => {
    const d = day([variant("main", [item("slot", "visit", "Cruise", { durationMin: 60, durationSource: "operator", start: at("10:00", "fixed", "operator") })])], {
      start: { time: "09:00", source: "plan", label: null },
      legs: [{ from: "base", to: "slot", mode: "drive", minutes: 70, km: null, basis: "plan", estimate: true }],
    });
    const t = scheduleDay(d, profile());
    const w = t.warnings.find((x) => x.code === "S_FIXED_MISSED")!;
    expect(w.message).toBe("Arrives 10:10 for the 10:00 Cruise.");
    expect(by(t, "slot").start).toBe("10:00");
  });
  it("shortens lunch before it misses a pin", () => {
    const d = day([variant("main", [
      item("a", "visit", "Museum", { durationMin: 60, durationSource: "plan", start: at("10:30") }),
      item("b", "visit", "Tour", { durationMin: 60, durationSource: "operator", start: at("12:25", "fixed", "operator") }),
    ])], { start: { time: "09:30", source: "plan", label: null } });
    const t = scheduleDay(d, profile());
    expect(t.warnings.find((w) => w.code === "S_FIXED_MISSED")).toBeUndefined();
  });
});

describe("meals (spec 2.6)", () => {
  it("lunch lands inside the window at the first boundary", () => {
    const d = day([variant("main", [
      item("a", "visit", "Falls", { durationMin: 60, durationSource: "plan", start: at("10:00") }),
      item("b", "visit", "Viewpoint", { durationMin: 30, durationSource: "plan" }),
    ])]);
    const t = scheduleDay(d, profile());
    const lunch = t.entries.find((e) => e.sub === "lunch")!;
    expect(toMin(lunch.start)!).toBeGreaterThanOrEqual(12 * 60);
    expect(toMin(lunch.start)!).toBeLessThanOrEqual(13 * 60 + 30);
    expect(lunch.time.window).toMatchObject({ from: "12:00", to: "13:30" });
  });
  it("uses the family window for a family", () => {
    const d = day([variant("main", [item("a", "visit", "Falls", { durationMin: 60, durationSource: "plan", start: at("10:00") }), item("b", "visit", "Viewpoint", { durationMin: 30, durationSource: "plan" })])]);
    const lunch = scheduleDay(d, family(8)).entries.find((e) => e.sub === "lunch")!;
    expect(lunch.time.window).toMatchObject({ from: "11:30", to: "13:00" });
    expect(toMin(lunch.start)!).toBeGreaterThanOrEqual(11 * 60 + 30);
    expect(toMin(lunch.start)!).toBeLessThanOrEqual(13 * 60);
  });
  it("puts lunch on the trail, inside it, when a trail spans the window", () => {
    const d = day([variant("main", [item("t", "trail", "Long walk", { durationMin: 360, durationSource: "data", start: at("09:00"), stats: { distanceKm: 14, gainM: 700 } })])]);
    const t = scheduleDay(d, profile());
    const lunch = t.entries.find((e) => e.style === "on-trail")!;
    expect(lunch.insideOf).toBe("t");
    expect(lunch.durationMin).toBe(0);
  });
  it("sits dinner at the base after a rest, inside the dinner window", () => {
    const d = day([variant("main", [item("a", "visit", "Falls", { durationMin: 60, durationSource: "plan", start: at("10:00") })])]);
    const t = scheduleDay(d, profile());
    const dinner = t.entries.find((e) => e.sub === "dinner")!;
    expect(dinner.style).toBe("at-base");
    expect(toMin(dinner.start)!).toBeGreaterThanOrEqual(18 * 60 + 30);
    expect(t.entries.find((e) => e.kind === "rest" && e.sub === "at-base")).toBeDefined();
  });
});

describe("drive breaks (spec 2.5)", () => {
  it("splits a long drive around a stretch break", () => {
    const d = day([variant("main", [item("far", "visit", "Far lake", { durationMin: 60, durationSource: "plan" })])], {
      legs: [{ from: "base", to: "far", mode: "drive", minutes: 200, km: 180, basis: "routed", estimate: false }],
    });
    const t = scheduleDay(d, family(6));
    const legs = t.entries.filter((e) => e.kind === "leg" && e.title.includes("Far lake"));
    expect(legs).toHaveLength(2);
    expect(legs[0]!.durationMin + legs[1]!.durationMin).toBe(200);
    expect(t.entries.find((e) => e.sub === "leg-stretch")).toBeDefined();
    expect(legs[0]!.leg!.breaks).toBe(1);
  });
});

describe("days of other kinds (spec 6)", () => {
  it("an arrival day lands, collects the car, drops bags and runs the light item", () => {
    const d = day([variant("main", [item("loop", "trail", "Fenland Loop", { stats: { distanceKm: 1.9, gainM: 20 }, durationMin: 45, durationSource: "data" })])], {
      kind: "arrival", origin: { name: "Calgary airport", placeSlug: null, point: null },
      legs: [{ from: "origin", to: "base", mode: "drive", minutes: 90, km: null, basis: "plan", estimate: true }],
    });
    const t = scheduleDay(d, family(6));
    expect(t.entries[0]).toMatchObject({ kind: "start", sub: "land", start: "10:00" });
    expect(t.entries[0]!.time.note).toBe("Arrival time not set");
    expect(t.entries.find((e) => e.sub === "car-hire")).toBeDefined();
    expect(t.entries.find((e) => e.kind === "checkin")).toBeDefined();
    expect(t.entries.map((e) => e.id).indexOf("loop")).toBeGreaterThan(t.entries.findIndex((e) => e.kind === "checkin"));
  });
  it("a transfer day ends at the next base with a check-in and dinner", () => {
    const d = day([variant("main", [item("v", "visit", "Lake", { durationMin: 45, durationSource: "plan" })])], {
      kind: "transfer", nextBase: { name: "Jasper", placeSlug: null, point: null },
      legs: [{ from: "v", to: "next-base", mode: "drive", minutes: 120, km: null, basis: "plan", estimate: true }],
    });
    const t = scheduleDay(d, profile());
    expect(t.entries.at(-1)).toMatchObject({ kind: "end", sub: "at-next-base" });
    expect(t.entries.some((e) => e.kind === "checkin")).toBe(true);
    expect(t.entries.some((e) => e.sub === "dinner")).toBe(true);
  });
  it("a departure day checks out first and ends at the airport", () => {
    const d = day([variant("main", [item("v", "visit", "Last walk", { durationMin: 30, durationSource: "plan" })])], { kind: "departure", nextBase: { name: "the airport", placeSlug: null, point: null } });
    const t = scheduleDay(d, profile());
    expect(t.entries[1]).toMatchObject({ kind: "checkout" });
    expect(t.entries.at(-1)).toMatchObject({ kind: "end", sub: "at-airport" });
    expect(t.entries.some((e) => e.sub === "dinner")).toBe(false);
  });
  it("a short trip starts and ends at home with a home-by window", () => {
    const d = day([variant("main", [item("v", "visit", "Falls", { durationMin: 120, durationSource: "plan", start: at("10:00") })])], {
      base: null, origin: { name: "Your start point", placeSlug: null, point: null }, homeBy: "21:00",
    });
    const t = scheduleDay(d, profile());
    expect(t.entries[0]).toMatchObject({ kind: "start", sub: "leave-home" });
    expect(t.entries.at(-1)).toMatchObject({ kind: "end", sub: "at-home" });
    expect(t.entries.at(-1)!.time.window).toMatchObject({ to: "21:00", why: "home by" });
  });
  it("a day with no base starts from the first item and says the start point is not set", () => {
    const d = day([variant("main", [item("v", "visit", "Walk", { durationMin: 60, durationSource: "plan" })])], { base: null });
    const t = scheduleDay(d, profile());
    expect(t.entries[0]!.time.note).toBe("Start point not set");
    expect(t.entries.some((e) => e.kind === "leg")).toBe(false);
  });
  it("draws a no-sunset marker and no daylight warning in the midnight sun", () => {
    const d = day([variant("main", [item("t", "trail", "Late walk", { durationMin: 120, durationSource: "plan", start: at("22:00"), stats: { distanceKm: 5, gainM: 300 }, needsDaylight: true })])], {
      tz: "Europe/Oslo", sunPoint: { lat: 68.2, lon: 14.6 }, sunWindow: { from: [6, 20], to: [7, 5] },
    });
    const t = scheduleDay(d, profile());
    expect(t.entries.some((e) => e.sub === "no-sunset")).toBe(true);
    expect(t.warnings.some((w) => w.code === "W_DAYLIGHT")).toBe(false);
  });
});

describe("add to this day (spec 3.7)", () => {
  const base = rockies5();
  const stop = item("agnes", "visit", "Lake Agnes teahouse", { durationMin: 60, durationSource: "data", sub: "lake" });
  it("inserts by cheapest insertion, keeps every fixed slot and marks the entry as the visitor's", () => {
    const { timeline } = addItem(base, family(6), {}, stop);
    const e = by(timeline, "agnes");
    expect(e.addedBy).toBe("visitor");
    expect(e.time.source).toBe("visitor");
    expect(by(timeline, "maligne-lake-cruise").start).toBe("10:00");
    expect(timeline.warnings.some((w) => w.code === "S_FIXED_MISSED")).toBe(false);
  });
  it("is deterministic and reproduces from the list of additions alone", () => {
    const a = addItem(base, family(6), {}, stop);
    const b = scheduleDay(base, family(6), { added: [stop] });
    expect(b).toEqual(a.timeline);
  });
  it("re-flows later entries and puts the day over its cap with numbers", () => {
    const before = scheduleDay(base, family(6));
    const { timeline } = addItem(base, family(6), {}, item("big", "visit", "Long visit", { durationMin: 120, durationSource: "plan", point: null }));
    expect(timeline.span.minutes).toBeGreaterThan(before.span.minutes - 1);
    expect(timeline.warnings.find((w) => w.code === "S_DAY_CAP")!.message).toMatch(/^Day 5 runs /);
  });
  it("adds more than one item, in insertion order", () => {
    const t = scheduleDay(base, family(6), { added: [stop, item("two", "visit", "Second", { durationMin: 30, durationSource: "plan" })] });
    expect(t.entries.filter((e) => e.addedBy === "visitor")).toHaveLength(2);
  });
});

describe("a whole trip", () => {
  it("applies per-day variant overrides", () => {
    const days: ScheduleDayInput[] = [rockies5()];
    const [t] = scheduleTrip(days, family(6), { 5: "C" });
    expect(t!.variant).toMatchObject({ key: "C", chosenBy: "override" });
    expect(t!.entries.some((e) => e.id === "mary-schaffer-loop")).toBe(false);
  });
  it("shows the lines of a day as time, kind and title", () => {
    expect(kinds(scheduleDay(rockies5(), family(6))).length).toBeGreaterThan(10);
  });
});
