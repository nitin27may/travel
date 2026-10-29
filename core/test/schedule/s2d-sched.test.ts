// S2D-SCHED: the four scheduler causes from the S2D-LEG report (research/runs/s2d-leg-2026-10-28-stored-legs.md). Each cause has a
// minimal case and its published day from the core fixtures (the published days' schedule inputs). Every other published day stays
// byte-identical: rule-rows.test.ts and web/tests/trips/timeline.test.ts pin that.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LATE_START_SLACK_MIN, MIDDAY_RETURN, TRANSFER_STOP_FLOOR_MIN } from "../../src/config/schedule.ts";
import { estimateLeg, resolveLeg } from "../../src/schedule/legs.ts";
import { scheduleDay } from "../../src/schedule/schedule.ts";
import type { DayTimeline, ScheduleDayInput, StoredLeg, TimelineEntry } from "../../src/schedule/types.ts";
import { at, day, family, item, profile, variant } from "./helpers.ts";

const load = (name: string): ScheduleDayInput[] =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url)), "utf8")) as ScheduleDayInput[];
const ROCKIES = load("rockies-trip");
const DOLOMITES = load("dolomites-trip");
const dayOf = (days: ScheduleDayInput[], n: number): ScheduleDayInput => days.find((d) => d.day === n)!;
const leg = (from: string, to: string, minutes: number, over: Partial<StoredLeg> = {}): StoredLeg => ({ from, to, mode: "drive", minutes, km: null, basis: "plan", estimate: true, symmetric: true, ...over });
const rows = (t: DayTimeline): string[] => t.entries.filter((e) => e.kind !== "sun").map((e) => `${e.start} ${e.durationMin} ${e.title}`);
const legs = (t: DayTimeline): TimelineEntry[] => t.entries.filter((e) => e.kind === "leg");
const LAKE_LOUISE = { lat: 51.4254, lon: -116.1773 };
const JASPER = { lat: 52.8737, lon: -118.0814 };

describe("cause 1: the hub rung never sends a transfer-day stop back through its start base", () => {
  it("the report's repro: Wilcox Pass (no point) to the next base reads the way on, not 'via Lake Louise'", () => {
    const r = resolveLeg({ ids: ["wilcox-pass"], point: null }, { ids: ["next-base"], point: JASPER }, [leg("base", "wilcox-pass", 70)], LAKE_LOUISE);
    const bases = estimateLeg(JASPER, LAKE_LOUISE).minutes;
    expect(r.via).toBe(false);
    expect(r.minutes).toBe(Math.round((bases - 70) / 5) * 5);
    expect(r.minutes).toBeLessThan(bases);
    expect(r).toMatchObject({ mode: "drive", basis: "estimate", estimate: true, km: null });
    // either direction
    expect(resolveLeg({ ids: ["next-base"], point: JASPER }, { ids: ["wilcox-pass"], point: null }, [leg("base", "wilcox-pass", 70)], LAKE_LOUISE).minutes).toBe(r.minutes);
  });
  it("a stop stored as far from the start base as the next base is never under the floor", () => {
    const r = resolveLeg({ ids: ["far"], point: null }, { ids: ["next-base"], point: JASPER }, [leg("base", "far", 400)], LAKE_LOUISE);
    expect(r.minutes).toBe(TRANSFER_STOP_FLOOR_MIN);
    expect(r.via).toBe(false);
  });
  it("a normal day keeps the way back through the base (a placed stop to a stop with no point)", () => {
    const placed = { ids: ["add"], point: { lat: 52.66, lon: -117.88 } };
    const r = resolveLeg(placed, { ids: ["cruise"], point: null }, [leg("base", "cruise", 60)], JASPER);
    expect(r.via).toBe(true);
    expect(r.minutes).toBe(Math.round((estimateLeg(placed.point, JASPER).minutes + 60) / 5) * 5);
  });
  it("adults Day 4 A without its stored leg to Jasper: no 'via' leg, and well under the old 5 h 20", () => {
    const d4 = dayOf(ROCKIES, 4);
    const bare = { ...d4, legs: d4.legs.filter((l) => !(l.from === "wilcox-pass" && l.to === "next-base")) };
    const t = scheduleDay(bare, profile(), { variant: "A" });
    const toJasper = legs(t).filter((e) => e.to?.name === "Jasper" && e.leg?.mode === "drive");
    expect(toJasper.some((e) => / via /.test(e.title))).toBe(false);
    expect(toJasper.reduce((n, e) => n + e.durationMin, 0)).toBeLessThan(4 * 60);
    expect(toJasper.every((e) => e.honesty.includes("drive_estimated"))).toBe(true);
  });
});

describe("cause 2: a rejoin pin a stored leg leads into draws that leg (Rockies Day 2 B)", () => {
  const split = (withLegs: boolean): ScheduleDayInput =>
    day(
      [
        variant("A", [item("ridge", "trail", "Ridge walk", { durationMin: 240, durationSource: "plan", stats: { distanceKm: 12, gainM: 600 } })], { relation: "parallel", audience: "adults", rejoin: { time: "15:00", place: "the trailhead car park", afterItem: "cruise" } }),
        variant("B", [item("gondola", "visit", "Gondola", { durationMin: 120, durationSource: "plan", start: at("09:00") }), item("cruise", "visit", "Cruise", { durationMin: 60, durationSource: "plan" }), item("pools", "visit", "Hot pools", { durationMin: 90, durationSource: "plan" })], { rejoin: { time: "15:00", place: "the trailhead car park", afterItem: "cruise" } }),
      ],
      { legs: [leg("base", "gondola", 20), leg("gondola", "cruise", 35), leg("cruise", "pools", 25), leg("pools", "base", 10), leg("base", "ridge", 20), ...(withLegs ? [leg("cruise", "1-together", 35), leg("1-together", "pools", 30)] : [])] },
    );
  it("draws the drive back to the rejoin place and the drive on from it, both from the plan", () => {
    const t = scheduleDay(split(true), family(10), { variant: "B" });
    const to = legs(t).find((e) => e.title === "Drive to the trailhead car park")!;
    expect(to).toMatchObject({ durationMin: 35, lane: "all" });
    expect(to.from?.name).toBe("Cruise");
    const on = legs(t).find((e) => e.to?.name === "Hot pools")!;
    expect(on.durationMin).toBe(30);
    expect(on.from?.name).toMatch(/^Together again/);
    expect(t.entries.find((e) => e.id === "1-together")!.start).toBe("15:00");
    expect(t.totals.driveMin).toBe(20 + 35 + 35 + 30 + 10);
  });
  it("in the split view the drive to the rejoin is the party's own lane, not 'all'", () => {
    const t = scheduleDay(split(true), family(10, { split: true }), { variant: "B" });
    expect(legs(t).find((e) => e.title === "Drive to the trailhead car park")!.lane).toBe("B");
    expect(t.entries.find((e) => e.id === "1-together")!.lane).toBe("all");
  });
  it("with no stored leg into it the rejoin stays a moment where the party is (every other split day)", () => {
    const t = scheduleDay(split(false), family(10), { variant: "B" });
    expect(legs(t).some((e) => e.title === "Drive to the trailhead car park")).toBe(false);
    expect(legs(t).find((e) => e.to?.name === "Hot pools")!.durationMin).toBe(25);
  });
  it("the published Rockies Day 2 B: Minnewanka back to the Sunshine car park, then 30 min to the hot springs", () => {
    const t = scheduleDay(dayOf(ROCKIES, 2), family(10));
    expect(t.variant.key).toBe("B");
    const back = legs(t).find((e) => e.title === "Drive to Sunshine Village gondola base car park")!;
    expect(back).toMatchObject({ start: "14:05", durationMin: 35 });
    expect(legs(t).find((e) => e.to?.name === "Banff Upper Hot Springs")).toMatchObject({ start: "15:30", durationMin: 30 });
    expect(t.totals.driveMin).toBe(130);
    expect(t.span).toMatchObject({ start: "07:40", end: "19:25" });
  });
});

describe("cause 3: a long wait for a set time is spent at a nearby base (Dolomites Day 2)", () => {
  const D2 = dayOf(DOLOMITES, 2);
  it("Braies, back to San Candido, rest and lunch there, out to Val Fiscalina for 14:00; no Free time", () => {
    const t = scheduleDay(D2, profile());
    expect(rows(t)).toEqual([
      "04:45 0 Leave San Candido",
      "04:45 26 Drive to Lago di Braies",
      "05:15 150 Lago di Braies",
      "07:45 26 Back to San Candido",
      "08:15 264 Rest at the base",
      "12:40 60 Lunch",
      "13:40 16 Drive to Val Fiscalina",
      "14:00 120 Val Fiscalina",
      "16:00 16 Back to San Candido",
      "16:20 145 Rest at the base",
      "18:45 75 Dinner in San Candido",
      "20:00 0 Back at San Candido",
    ]);
    expect(t.entries.some((e) => e.sub === "free-time")).toBe(false);
    expect(t.entries.find((e) => e.id === "i4")!.start).toBe("14:00");
    expect(t.warnings.map((w) => w.code)).toEqual([]);
  });
  const far = (minutes: number, point = true): ScheduleDayInput =>
    day([variant("main", [item("a", "visit", "Lake", { durationMin: 60, durationSource: "plan", ...(point ? { point: { lat: 46.7, lon: 12.1 } } : {}) }), item("b", "trail", "Valley", { durationMin: 120, durationSource: "plan", start: at("15:00"), ...(point ? { point: { lat: 46.65, lon: 12.35 } } : {}) })])], {
      base: { name: "Town", placeSlug: null, point: point ? { lat: 46.73, lon: 12.28 } : null }, start: { time: "07:00", source: "plan", label: null },
      legs: [leg("base", "a", minutes), leg("a", "b", 20), leg("b", "base", minutes)],
    });
  it(`keeps the Free time when the base is over ${MIDDAY_RETURN.maxLegMin} min away`, () => {
    const t = scheduleDay(far(MIDDAY_RETURN.maxLegMin + 5), profile());
    expect(t.entries.some((e) => e.sub === "free-time" && e.durationMin > MIDDAY_RETURN.minWaitMin)).toBe(true);
    expect(legs(t).filter((e) => e.title === "Back to Town")).toHaveLength(1);
  });
  it("goes back within the limit, and never over a drive the data does not know", () => {
    expect(legs(scheduleDay(far(MIDDAY_RETURN.maxLegMin), profile())).filter((e) => e.title === "Back to Town")).toHaveLength(2);
    // no point and no stored way from the stop to the base: the 10 minute local move is not a reason to go back
    const unknown = far(20, false);
    unknown.legs = unknown.legs.filter((l) => l.to !== "base");
    expect(scheduleDay(unknown, profile()).entries.some((e) => e.sub === "free-time" && e.durationMin > MIDDAY_RETURN.minWaitMin)).toBe(true);
  });
  it("a short wait stays where it is", () => {
    const d = far(20);
    d.variants[0]!.items[1]!.start = at("10:00");
    expect(legs(scheduleDay(d, profile())).filter((e) => e.title === "Back to Town")).toHaveLength(1);
  });
});

describe("cause 4: the walkers' version on its own leaves when it needs to (adults Day 4 A)", () => {
  const D4 = dayOf(ROCKIES, 4);
  it("adults on Version A leave Lake Louise at 11:10 for the 12:30 Wilcox Pass: no 3 h 20 wait", () => {
    const t = scheduleDay(D4, profile(), { variant: "A" });
    expect(t.entries[0]).toMatchObject({ kind: "start", start: "11:10", title: "Leave Lake Louise" });
    expect(t.entries[0]!.time.pinned).toBe(false);
    expect(t.entries.find((e) => e.id === "wilcox-pass")!.start).toBe("12:30");
    expect(t.entries.some((e) => e.sub === "free-time")).toBe(false);
  });
  it("the family's version keeps the plan's 07:30, and so does the split view, whose walkers start with the family", () => {
    expect(scheduleDay(D4, family(10)).entries[0]!.start).toBe("07:30");
    expect(scheduleDay(D4, family(10, { split: true })).entries[0]!.start).toBe("07:30");
  });
  const walk = (source: "plan" | "operator" | "visitor", pin = "12:30"): ScheduleDayInput =>
    day([variant("A", [item("w", "trail", "Pass", { durationMin: 180, durationSource: "plan", start: at(pin) })], { relation: "parallel", audience: "adults" }), variant("B", [item("x", "visit", "Lake", { durationMin: 60, durationSource: "plan" })])], {
      start: { time: "07:30", source, label: null }, legs: [leg("base", "w", 60), leg("base", "x", 30)],
    });
  it("an operator's or the person's start never moves; neither does a stop's set time", () => {
    expect(scheduleDay(walk("operator"), profile(), { variant: "A" }).entries[0]!.start).toBe("07:30");
    expect(scheduleDay(walk("visitor"), profile(), { variant: "A" }).entries[0]!.start).toBe("07:30");
    const t = scheduleDay(walk("plan"), profile(), { variant: "A" });
    expect(t.entries[0]!.start).toBe("11:20");
    expect(t.entries.find((e) => e.id === "w")!.start).toBe("12:30");
  });
  it(`a wait of ${LATE_START_SLACK_MIN} min or less keeps the plan's start`, () => {
    // 07:30 + 60 drive + 10 walk-in = 08:40; a 09:40 pin is exactly the slack
    expect(scheduleDay(walk("plan", "09:40"), profile(), { variant: "A" }).entries[0]!.start).toBe("07:30");
    expect(scheduleDay(walk("plan", "09:45"), profile(), { variant: "A" }).entries[0]!.start).toBe("08:35");
  });
});
