import { describe, expect, it } from "vitest";
import { scheduleDay } from "../../src/schedule/schedule.ts";
import type { ScheduleDayInput, WarnCode } from "../../src/schedule/types.ts";
import { at, day, family, item, profile, variant } from "./helpers.ts";

const codes = (d: ScheduleDayInput, p = profile(), opts = {}): WarnCode[] => scheduleDay(d, p, opts).warnings.map((w) => w.code);
const one = (...items: ReturnType<typeof item>[]) => day([variant("main", items)]);
const sunDay = (d: ScheduleDayInput): ScheduleDayInput => ({ ...d, tz: "America/Edmonton", sunPoint: { lat: 52.8737, lon: -118.0814 }, sunWindow: { from: [9, 8], to: [9, 22] } });

describe("each validation code has a fixture that raises it and one that does not (spec 2.11)", () => {
  it("W_OVERLAP", () => {
    const bad = one(item("a", "visit", "Museum", { durationMin: 120, durationSource: "plan", start: at("10:00") }), item("b", "visit", "Tour", { durationMin: 60, durationSource: "operator", start: at("11:00", "fixed", "operator") }));
    const w = scheduleDay(bad, profile()).warnings.find((x) => x.code === "W_OVERLAP")!;
    expect(w.message).toContain("Museum runs");
    const good = day([variant("main", [item("a", "visit", "Museum", { durationMin: 60, durationSource: "plan", start: at("10:00") }), item("b", "visit", "Tour", { durationMin: 60, durationSource: "operator", start: at("11:00", "fixed", "operator") })])], {
      legs: [{ from: "a", to: "b", mode: "walk", minutes: 0, km: null, basis: "plan", estimate: false }],
    });
    expect(codes(good)).not.toContain("W_OVERLAP");
  });
  it("W_HOURS", () => {
    const win = { from: "09:00", to: "17:00", lastUp: null, lastDown: null, why: "opening hours" };
    const bad = one(item("m", "visit", "Museum", { durationMin: 120, durationSource: "plan", start: at("15:30"), window: win }));
    expect(scheduleDay(bad, profile()).warnings.find((x) => x.code === "W_HOURS")!.message).toBe("Ends 17:30; Museum closes at 17:00.");
    expect(codes(one(item("m", "visit", "Museum", { durationMin: 60, durationSource: "plan", start: at("15:30"), window: win })))).not.toContain("W_HOURS");
    expect(scheduleDay(one(item("m", "visit", "Museum", { durationMin: 60, durationSource: "plan", start: at("08:00"), window: win })), profile()).warnings.find((x) => x.code === "W_HOURS")!.message).toContain("opens at 09:00");
  });
  it("S_LAST_RIDE", () => {
    const win = { from: "09:00", to: null, lastUp: "19:30", lastDown: "21:00", why: "lift hours" };
    const bad = one(item("g", "visit", "Gondola", { sub: "lift-ride", durationMin: 80, durationSource: "plan", start: at("19:40"), window: win }));
    expect(scheduleDay(bad, profile()).warnings.find((x) => x.code === "S_LAST_RIDE")!.message).toBe("Last ride up is 19:30; this starts at 19:40.");
    expect(codes(one(item("g", "visit", "Gondola", { sub: "lift-ride", durationMin: 80, durationSource: "plan", start: at("18:00"), window: win })))).not.toContain("S_LAST_RIDE");
  });
  it("W_DAYLIGHT", () => {
    const bad = sunDay(one(item("t", "trail", "Late walk", { durationMin: 120, durationSource: "plan", start: at("18:30"), stats: { distanceKm: 5, gainM: 100 } })));
    const w = scheduleDay(bad, profile()).warnings.find((x) => x.code === "W_DAYLIGHT")!;
    expect(w.message).toMatch(/^Ends about 20:30; sunset can be 19:54 in this window\.$/);
    expect(codes(sunDay(one(item("t", "trail", "Early walk", { durationMin: 120, durationSource: "plan", start: at("09:00"), stats: { distanceKm: 5, gainM: 100 } }))))).not.toContain("W_DAYLIGHT");
  });
  it("S_DAY_CAP", () => {
    const long = one(item("a", "visit", "All day", { durationMin: 600, durationSource: "plan", start: at("08:00") }));
    expect(codes(long, profile({ pace: "relaxed" }))).toContain("S_DAY_CAP");
    expect(codes(one(item("a", "visit", "Short", { durationMin: 120, durationSource: "plan", start: at("10:00") })))).not.toContain("S_DAY_CAP");
  });
  it("W_PACE", () => {
    const heavy = one(item("a", "trail", "Big", { durationMin: 300, durationSource: "plan", start: at("08:00"), stats: { distanceKm: 10, gainM: 500 } }), item("b", "trail", "Bigger", { durationMin: 300, durationSource: "plan", stats: { distanceKm: 10, gainM: 500 } }));
    expect(codes(heavy, profile({ pace: "relaxed" }))).toContain("W_PACE");
    expect(codes(one(item("a", "visit", "Little", { durationMin: 60, durationSource: "plan", start: at("10:00") })), profile({ pace: "relaxed" }))).not.toContain("W_PACE");
  });
  it("W_DRIVE_LIMIT", () => {
    const d = day([variant("main", [item("far", "visit", "Far", { durationMin: 60, durationSource: "plan" })])], { legs: [{ from: "base", to: "far", mode: "drive", minutes: 150, km: null, basis: "routed", estimate: false }] });
    expect(codes(d, profile({ pace: "relaxed" }))).toContain("W_DRIVE_LIMIT");
    expect(codes(d, profile({ pace: "full" }))).not.toContain("W_DRIVE_LIMIT");
  });
  it("an early start the plan pins is a note on the start, never a W_EARLY warning (the profile's own start is never before 07:00)", () => {
    // an unpinned item, so the start is the profile's: made early by a very early start the plan did not write down
    const pinnedEarly = day([variant("main", [item("s", "visit", "Shuttle", { durationMin: 60, durationSource: "operator", start: at("06:30", "fixed", "operator") })])], { legs: [{ from: "base", to: "s", mode: "drive", minutes: 60, km: null, basis: "plan", estimate: true }] });
    const t = scheduleDay(pinnedEarly, profile());
    expect(t.entries[0]!.start).toBe("05:30");
    expect(t.warnings.some((w) => w.code === "W_EARLY")).toBe(false);
  });
  it("W_CEILING", () => {
    const d = one(item("b", "trail", "Bald Hills", { durationMin: 270, durationSource: "data", stats: { distanceKm: 10.4, gainM: 500 } }));
    const w = scheduleDay(d, family(6)).warnings.find((x) => x.code === "W_CEILING")!;
    expect(w.message).toBe("Bald Hills is 10.4 km; we plan walks up to 6 km at age 6.");
    expect(codes(d, profile())).not.toContain("W_CEILING");
  });
  it("W_FIT", () => {
    const d = one(item("c", "visit", "Canyoning", { durationMin: 120, durationSource: "operator", minAge: 5, minAgeRule: "hard" }));
    expect(scheduleDay(d, family(4), { variant: "main" }).warnings.find((x) => x.code === "W_FIT")!.message).toBe("Canyoning has a minimum age of 5.");
    expect(codes(d, family(6))).not.toContain("W_FIT");
  });
  it("S_FIXED_MISSED", () => {
    const d = day([variant("main", [item("s", "visit", "Cruise", { durationMin: 60, durationSource: "operator", start: at("10:00", "fixed", "operator") })])], {
      start: { time: "09:00", source: "plan", label: null }, legs: [{ from: "base", to: "s", mode: "drive", minutes: 70, km: null, basis: "plan", estimate: true }],
    });
    expect(codes(d)).toContain("S_FIXED_MISSED");
    expect(codes({ ...d, start: { time: "08:00", source: "plan", label: null } })).not.toContain("S_FIXED_MISSED");
  });
  it("S_MIDNIGHT", () => {
    const d = one(item("n", "visit", "Night market", { durationMin: 180, durationSource: "plan", start: at("22:00") }));
    expect(scheduleDay(d, profile()).warnings.find((w) => w.code === "S_MIDNIGHT")!.message).toBe("Night market runs past midnight.");
    expect(codes(one(item("n", "visit", "Market", { durationMin: 60, durationSource: "plan", start: at("20:00") })))).not.toContain("S_MIDNIGHT");
  });
  it("S_NO_FIT", () => {
    const d = day([variant("main", [item("t", "trail", "Long", { durationMin: 300, durationSource: "data", stats: { distanceKm: 12, gainM: 600 } })])]);
    const w = scheduleDay(d, family(3)).warnings.find((x) => x.code === "S_NO_FIT")!;
    expect(w.message).toBe("No version of Day 1 suits age 3.");
    expect(codes(d, profile())).not.toContain("S_NO_FIT");
  });
  it("S_HOME_BY", () => {
    const d = day([variant("main", [item("v", "visit", "Falls", { durationMin: 120, durationSource: "plan", start: at("17:00") })])], { base: null, origin: { name: "Your start point", placeSlug: null, point: null }, homeBy: "19:00" });
    const w = scheduleDay(d, profile()).warnings.find((x) => x.code === "S_HOME_BY")!;
    expect(w.message).toMatch(/^Home \d\d:\d\d, \d+ min after 19:00\.$/);
    expect(codes({ ...d, homeBy: "23:30" })).not.toContain("S_HOME_BY");
  });
});
