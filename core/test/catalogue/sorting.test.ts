import { describe, expect, it } from "vitest";
import { compareValues, sortRows } from "../../src/catalogue/sorting.ts";
import { bandOf, compareByDistance, measure, within } from "../../src/catalogue/distance.ts";
import { matchesText } from "../../src/catalogue/sortKey.ts";

describe("the sort rule (R-4)", () => {
  it("nulls go last in both directions; numbers compare numerically; strings by sortKey", () => {
    expect([3, null, 1, 2].sort((a, b) => compareValues(a, b, false))).toEqual([1, 2, 3, null]);
    expect([3, null, 1, 2].sort((a, b) => compareValues(a, b, true))).toEqual([3, 2, 1, null]);
    expect(["b", "Á", "a"].sort((a, b) => compareValues(a, b, false))).toEqual(["Á", "a", "b"]);
    expect(compareValues(10, 9, false)).toBe(1);
  });
  it("ties break by sortKey(name) then ref, ascending whatever the direction", () => {
    const rows = [
      { ref: "r/2", name: "Beta", km: 5 },
      { ref: "r/1", name: "Beta", km: 5 },
      { ref: "r/3", name: "Alpha", km: 5 },
      { ref: "r/4", name: "Zed", km: null },
    ];
    const by = { km: (r: (typeof rows)[number]) => r.km };
    expect(sortRows(rows, ["-km"], by, (r) => r.name).map((r) => r.ref)).toEqual(["r/3", "r/1", "r/2", "r/4"]);
    expect(sortRows(rows, ["km"], by, (r) => r.name).map((r) => r.ref)).toEqual(["r/3", "r/1", "r/2", "r/4"]);
  });
});

describe("the distance rule (R-12)", () => {
  const c = { lat: 51, lon: -115 };
  it("includes on the unrounded km, shows it rounded, and orders by rounded km, then name, then ref", () => {
    const m = measure(c, { lat: 51.2245, lon: -115 });
    expect(m.distanceKm).toBe(Math.round(m.km * 10) / 10);
    expect(within(m, m.km)).toBe(true);
    expect(within(m, m.km - 1e-9)).toBe(false);
    const a = { distanceKm: 2.5, name: "B", ref: "x" };
    const b = { distanceKm: 2.5, name: "A", ref: "y" };
    expect([a, b].sort(compareByDistance)).toEqual([b, a]);
  });
  it("bands: a walk under 1.2 km, then drive estimates", () => {
    expect(bandOf(1.1)).toBe("walk");
    expect(bandOf(5)).toBe("lt15");
    expect(bandOf(150)).toBe("60-120");
    expect(measure(c, { lat: 52, lon: -115 }).bearing).toBe("N");
  });
});

describe("the q rule (R-11)", () => {
  it("folds accents and case on both sides, over the joined fields", () => {
    expect(matchesText("emerald", ["Émerald Pool", "Yoho"])).toBe(true);
    expect(matchesText("POOL YOHO", ["Émerald Pool", "Yoho"])).toBe(true);
    expect(matchesText("lake", ["Émerald Pool"])).toBe(false);
    expect(matchesText("  ", ["x"])).toBe(true);
  });
});
