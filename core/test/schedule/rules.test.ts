import { describe, expect, it } from "vitest";
import { ACTIVE_BUDGET_MIN, ageRules, DURATION_RULES, resolveDuration, walkCeiling, dayCapMin, naismithMin } from "../../src/schedule/rules.ts";
import { estimateLeg, resolveLeg, samePlace } from "../../src/schedule/legs.ts";
import { anchorTime, sunReference } from "../../src/schedule/sun.ts";
import { sunDay } from "../../src/sun/index.ts";
import { fmtMin, haversineM } from "../../src/checks/time.ts";
import { family, item, profile } from "./helpers.ts";

describe("duration rules (spec 2.3)", () => {
  it("has a rule id for every row of the table", () => {
    for (const id of ["viewpoint.roadside", "lake.viewpoint", "lake.shore", "waterfall.walk", "sight.museum", "town.stroll", "lift.ride", "hot-spring", "activity.default", "boat.default", "meal.dinner", "break.coffee", "checkin", "park.walk-in", "trail.naismith"]) {
      expect(DURATION_RULES[id], id).toBeDefined();
    }
  });
  it("resolves a trail range by pace: relaxed takes the top, standard the middle, full the bottom", () => {
    const t = item("bald", "trail", "Bald Hills", { durationRange: [240, 300], durationSource: "data", stats: { distanceKm: 10.4, gainM: 500 } });
    expect(resolveDuration(t, profile({ pace: "relaxed" })).minutes).toBe(300);
    expect(resolveDuration(t, profile({ pace: "standard" })).minutes).toBe(270);
    expect(resolveDuration(t, profile({ pace: "full" })).minutes).toBe(240);
  });
  it("applies Naismith then the age multiplier: 3.2 km and 84 m for age 6 is about 1 h 20", () => {
    const t = item("mary", "trail", "Mary Schaffer Loop", { stats: { distanceKm: 3.2, gainM: 84 } });
    expect(Math.round(naismithMin(3.2, 84))).toBe(51);
    const r = resolveDuration(t, family(6));
    expect(r.minutes).toBe(Math.round((naismithMin(3.2, 84) * 1.6) / 5) * 5);
    expect(r.minutes % 5).toBe(0);
    expect(r.ruleId).toBe("trail.naismith");
    expect(r.basis).toContain("x 1.6");
  });
  it("never scales an operator duration", () => {
    const c = item("cruise", "visit", "Cruise", { durationMin: 90, durationSource: "operator" });
    expect(resolveDuration(c, profile({ pace: "relaxed" })).minutes).toBe(90);
  });
  it("is total: an item with nothing falls back to the activity rule and carries not_known", () => {
    const r = resolveDuration(item("x", "visit", "Something"), profile());
    expect(r.minutes).toBe(180);
    expect(r.unknown).toBe(true);
  });
  it("scales a data visit by pace but not the plan's own duration", () => {
    expect(resolveDuration(item("v", "visit", "V", { durationMin: 60, durationSource: "data" }), profile({ pace: "relaxed" })).minutes).toBe(75);
    expect(resolveDuration(item("v", "visit", "V", { durationMin: 60, durationSource: "plan" }), profile({ pace: "relaxed" })).minutes).toBe(60);
  });
  it("age bands and ceilings follow spec 2.4", () => {
    expect(ageRules(6)).toMatchObject({ trailMultiplier: 1.6, maxKm: 6, maxGainM: 350 });
    expect(ageRules(3)).toMatchObject({ trailMultiplier: 1.3, maxKm: 8 });
    expect(ageRules(14).maxKm).toBeNull();
    expect(walkCeiling(family(6, { walkKm: 8 }))).toEqual({ km: 8, gainM: null });
    expect(dayCapMin(family(6))).toBe(600);
    expect(dayCapMin(profile({ pace: "full" }))).toBe(780);
    expect(ACTIVE_BUDGET_MIN.standard).toBe(540);
  });
});

describe("legs (spec 2.5)", () => {
  const a = { ids: ["a"], point: { lat: 46.7327, lon: 12.2803 } };
  const b = { ids: ["b"], point: { lat: 46.612, lon: 12.296 } };
  const stored = (basis: "routed" | "plan" | "matrix", minutes: number) => [{ from: "a", to: "b", mode: "drive" as const, minutes, km: 10, basis, estimate: basis !== "routed" }];

  it("a stored leg wins over the estimate, and routed legs are not estimates", () => {
    const r = resolveLeg(a, b, stored("routed", 41));
    expect(r).toMatchObject({ minutes: 41, basis: "routed", estimate: false });
    expect(resolveLeg(a, b, stored("plan", 50))).toMatchObject({ minutes: 50, basis: "plan", estimate: true });
    expect(resolveLeg(a, b, stored("matrix", 60))).toMatchObject({ basis: "matrix", estimate: true });
  });
  it("falls to the straight-line estimate, then to a 10 minute local move", () => {
    expect(resolveLeg(a, b, [])).toMatchObject({ basis: "estimate", estimate: true });
    expect(resolveLeg({ ids: ["a"], point: null }, { ids: ["b"], point: null }, [])).toMatchObject({ minutes: 10, km: null, basis: "estimate" });
  });
  it("matches the prototype rule for three pairs", () => {
    // prototype/src/lib/geo.ts: under 1.2 km walk x1.3 at 4.5 km/h; else x1.42 (+1.5 km under 60 km) at 46 or 72 km/h, +3 min
    const P = (lat: number, lon: number) => ({ lat, lon });
    const walk = estimateLeg(P(46.5405, 12.1357), P(46.5415, 12.1367));
    const d1 = haversineM(P(46.5405, 12.1357), P(46.5415, 12.1367)) / 1000;
    expect(walk.mode).toBe("walk");
    expect(walk.minutes).toBe(Math.max(2, Math.round(((d1 * 1.3) / 4.5) * 60)));
    const mid = estimateLeg(P(46.7327, 12.2803), P(46.612, 12.296));
    const d2 = haversineM(P(46.7327, 12.2803), P(46.612, 12.296)) / 1000;
    expect(mid.minutes).toBe(Math.round(((d2 * 1.42 + 1.5) / 46) * 60 + 3));
    expect(mid.km).toBe(Math.round(d2 * 1.42 + 1.5));
    const far = estimateLeg(P(45.505, 12.352), P(46.7327, 12.2803));
    const d3 = haversineM(P(45.505, 12.352), P(46.7327, 12.2803)) / 1000;
    expect(far.minutes).toBe(Math.round(((d3 * 1.42) / 72) * 60 + 3));
  });
  it("samePlace compares ids", () => {
    expect(samePlace({ ids: ["x", "y"], point: null }, { ids: ["y"], point: null })).toBe(true);
    expect(samePlace(a, b)).toBe(false);
  });
});

describe("sun (spec 2.8)", () => {
  it("gives Jasper's sunset range for the season window within 2 minutes of core/bin/sun.ts", () => {
    const ref = sunReference({ lat: 52.8737, lon: -118.0814 }, "America/Edmonton", { from: [9, 8], to: [9, 22] });
    const set = (iso: string) => {
      const e = sunDay(52.8737, -118.0814, iso, "America/Edmonton").sunrise;
      return e.kind === "normal" ? e.set : NaN;
    };
    expect(Math.abs(ref.sunset.hi - set("2027-09-08"))).toBeLessThanOrEqual(2);
    expect(Math.abs(ref.sunset.lo - set("2027-09-22"))).toBeLessThanOrEqual(2);
    expect(fmtMin(ref.sunset.lo)).toBe("19:54");
    expect(fmtMin(ref.sunset.hi)).toBe("20:28");
  });
  it("anchors an item to the sun with the range across the window", () => {
    const ref = sunReference({ lat: 52.8737, lon: -118.0814 }, "America/Edmonton", { from: [9, 8], to: [9, 22] });
    const a = anchorTime(ref, "sunset", -40)!;
    expect(a.range).toEqual(["19:14", "19:48"]);
  });
  it("reports a polar window and no anchor", () => {
    const ref = sunReference({ lat: 68.2, lon: 14.6 }, "Europe/Oslo", { from: [6, 20], to: [7, 5] });
    expect(ref.state).toBe("never-sets");
    expect(anchorTime(ref, "sunset", 0)).toBeNull();
  });
});
