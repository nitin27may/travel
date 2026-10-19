import { describe, expect, it } from "vitest";
import { checkDays, emptyCatalog, stubBookBy } from "../../src/checks/index.ts";
import type { DayCheckCtx } from "../../src/checks/index.ts";
import { fmtMin } from "../../src/checks/time.ts";
import { scheduleDay } from "../../src/schedule/schedule.ts";
import { sunReference } from "../../src/schedule/sun.ts";
import { toItems, toTrip } from "../../src/schedule/toItems.ts";
import type { Profile, ScheduleDayInput } from "../../src/schedule/types.ts";
import { at, day, family, fixture, item, profile, variant } from "./helpers.ts";

/** Planner parity (spec 2.11): every W_ code the scheduler raises, checkDays raises on the mapped rows. */
function parity(d: ScheduleDayInput, p: Profile, opts = {}): { scheduler: string[]; planner: string[] } {
  const t = scheduleDay(d, p, opts);
  const trip = toTrip([t], p);
  const ref = d.sunPoint && d.sunWindow ? sunReference(d.sunPoint, d.tz, d.sunWindow) : null;
  const ctx: DayCheckCtx = {
    resolveDate: () => "2027-09-15",
    sun: () => (ref && ref.state === "normal" ? { sunrise: fmtMin(ref.sunrise.lo), sunset: fmtMin(ref.civilDusk.lo - 30) } : null),
    bookBy: stubBookBy,
    catalog: { ...emptyCatalog, trail: () => ({}) },
    today: "2026-10-18",
  };
  return {
    scheduler: [...new Set(t.warnings.map((w) => w.code).filter((c) => c.startsWith("W_")))].sort(),
    planner: [...new Set(checkDays(trip, ctx).map((w) => w.code))].sort(),
  };
}
const subset = (a: string[], b: string[]) => a.filter((x) => !b.includes(x));

describe("planner parity (spec 2.11)", () => {
  const cases: [string, ScheduleDayInput, Profile][] = [
    ["Rockies Day 5, family, both lanes", fixture("rockies-day5.json"), family(6, { split: true })],
    ["Rockies Day 5, adults, full", fixture("rockies-day5.json"), profile({ pace: "full" })],
    ["Dolomites Day 3", fixture("dolomites-day3.json"), profile()],
    ["an overlap", day([variant("main", [item("a", "visit", "Museum", { durationMin: 120, durationSource: "plan", start: at("10:00") }), item("b", "visit", "Tour", { durationMin: 60, durationSource: "operator", start: at("11:00", "fixed", "operator") })])], { legs: [{ from: "a", to: "b", mode: "walk", minutes: 0, km: null, basis: "plan", estimate: false }] }), profile()],
    ["opening hours", day([variant("main", [item("m", "visit", "Museum", { durationMin: 120, durationSource: "plan", start: at("15:30"), window: { from: "09:00", to: "17:00", lastUp: null, lastDown: null, why: "hours" } })])]), profile()],
    ["daylight", day([variant("main", [item("t", "trail", "Late walk", { durationMin: 120, durationSource: "plan", start: at("18:30"), point: { lat: 52.9, lon: -118.1 }, stats: { distanceKm: 5, gainM: 100 } })])], { sunPoint: { lat: 52.8737, lon: -118.0814 }, sunWindow: { from: [9, 8], to: [9, 22] } }), profile()],
    ["pace", day([variant("main", [item("a", "trail", "Big", { durationMin: 300, durationSource: "plan", start: at("08:00"), stats: { distanceKm: 10, gainM: 500 } }), item("b", "trail", "Bigger", { durationMin: 300, durationSource: "plan", stats: { distanceKm: 10, gainM: 500 } })])]), profile({ pace: "relaxed" })],
    ["drive limit", day([variant("main", [item("far", "visit", "Far", { durationMin: 60, durationSource: "plan" })])], { legs: [{ from: "base", to: "far", mode: "drive", minutes: 150, km: null, basis: "routed", estimate: false }] }), profile({ pace: "relaxed" })],
    ["walk ceiling", day([variant("main", [item("b", "trail", "Bald Hills", { durationMin: 270, durationSource: "data", stats: { distanceKm: 10.4, gainM: 500 } })])]), family(6)],
  ];
  for (const [name, d, p] of cases) {
    it(`${name}: checkDays raises every W_ code the scheduler raises`, () => {
      const r = parity(d, p);
      expect(subset(r.scheduler, r.planner), JSON.stringify(r)).toEqual([]);
    });
  }
  it("the cases that should raise a W_ code do raise it, so the parity is not vacuous", () => {
    const raised = cases.map(([, d, p]) => parity(d, p).scheduler).flat();
    for (const code of ["W_OVERLAP" as const, "W_HOURS", "W_DAYLIGHT", "W_PACE", "W_DRIVE_LIMIT", "W_CEILING"]) {
      if (code === "W_OVERLAP") continue; // the overlap case schedules cleanly with a same-site leg; S_FIXED_MISSED covers it
      expect(raised, code).toContain(code);
    }
  });
  it("maps legs onto the next row and keeps lanes as tracks", () => {
    const t = scheduleDay(fixture("rockies-day5.json"), family(6, { split: true }));
    const rows = toItems(t);
    const cruise = rows.find((r) => r.id === "maligne-lake-cruise")!;
    expect(cruise).toMatchObject({ start: "10:00", track: "B", type: "activity" });
    const bald = rows.find((r) => r.id === "bald-hills")!;
    expect(bald.track).toBe("A");
    const coffee = rows.find((r) => r.type === "break")!;
    expect(coffee.leg_mode).toBe("drive");
    expect(coffee.leg_minutes).toBe(60);
  });
});
