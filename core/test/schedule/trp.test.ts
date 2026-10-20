import { describe, expect, it } from "vitest";
import { scheduleDay } from "../../src/schedule/schedule.ts";
import { day, family, fixture, item, profile, variant } from "./helpers.ts";

describe("TRP: legs through the base", () => {
  const hub = { lat: 52.8737, lon: -118.0814 };
  const stop = (id: string, title: string, over = {}) => item(id, "visit", title, { durationMin: 45, durationSource: "plan", ...over });
  it("reads a way through the base as one leg 'via Jasper', and a split drive carries on instead of repeating itself", () => {
    const d = day([variant("main", [stop("far", "Far lake", { point: { lat: 52.66, lon: -117.88 } }), stop("pin", "Maligne cruise")])], {
      base: { name: "Jasper", placeSlug: null, point: hub },
      legs: [{ from: "base", to: "pin", mode: "drive", minutes: 120, km: null, basis: "plan", estimate: true, symmetric: true }],
    });
    const t = scheduleDay(d, profile());
    const legs = t.entries.filter((e) => e.kind === "leg" && e.to?.name === "Maligne cruise");
    expect(legs.length).toBe(2);
    expect(legs.map((e) => e.title)).toEqual(["Drive to Maligne cruise via Jasper", "Drive on to Maligne cruise via Jasper"]);
    expect(legs.every((e) => e.leg?.basis === "estimate")).toBe(true);
  });
  it("a way that does not run through the base keeps its plain title", () => {
    const d = day([variant("main", [stop("a", "A lake", { point: { lat: 52.9, lon: -118.0 } })])], { base: { name: "Jasper", placeSlug: null, point: hub } });
    const t = scheduleDay(d, profile());
    expect(t.entries.filter((e) => e.kind === "leg").every((e) => !/ via /.test(e.title))).toBe(true);
  });
});

describe("TRP: the rejoin wait", () => {
  it("is scheduled on the plan's own versions in the one-lane view, not on the easy day that has no rejoin of its own", () => {
    const one = scheduleDay(fixture("rockies-day5.json"), family(6));
    expect(one.entries.some((e) => e.sub === "together")).toBe(true);
    const easy = scheduleDay(fixture("rockies-day5.json"), family(6), { variant: "C" });
    expect(easy.entries.some((e) => e.sub === "together")).toBe(false);
  });
});
