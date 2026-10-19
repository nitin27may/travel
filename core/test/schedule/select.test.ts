import { describe, expect, it } from "vitest";
import { selectVariant, variantFits } from "../../src/schedule/select.ts";
import { suitsProfile, readSuitability } from "../../src/schedule/suitability.ts";
import { day, family, item, profile, variant } from "./helpers.ts";

const trail = (id: string, km: number, gain: number, over = {}) => item(id, "trail", id, { stats: { distanceKm: km, gainM: gain }, durationMin: Math.round(km * 25), durationSource: "data", ...over });

const trio = () =>
  day([
    variant("A", [trail("long", 11, 700)], { audience: "adults", label: "Adults' hike" }),
    variant("B", [trail("medium", 4, 150)], { audience: "family", label: "Whole family" }),
    variant("C", [trail("short", 1, 20)], { audience: "easy", label: "Easy day" }),
  ]);

describe("selectVariant (spec 3.3)", () => {
  it("gives adults the most ambitious version that fits", () => {
    const s = selectVariant(trio(), profile());
    expect(s.variant.key).toBe("A");
    expect(s.fits).toBe(true);
    expect(s.reason).toContain("Adults' hike");
  });
  it("gives a family with a youngest of 14 the adults' version where it fits", () => {
    const s = selectVariant(trio(), family(14));
    expect(s.variant.key).toBe("A");
    expect(s.reason).toBe("Adults' hike: fits age 14");
  });
  it("gives a family with a youngest of 6 the family version, with the reason", () => {
    const s = selectVariant(trio(), family(6));
    expect(s.variant.key).toBe("B");
    expect(s.reason).toBe("Whole family: fits age 6");
  });
  it("falls to the easy version when the family walk is over the ceiling, and says why", () => {
    const d = day([
      variant("B", [trail("medium", 9, 300)], { audience: "family", label: "Whole family" }),
      variant("C", [trail("short", 1, 20)], { audience: "easy", label: "Easy day" }),
    ]);
    const s = selectVariant(d, family(6));
    expect(s.variant.key).toBe("C");
    expect(s.reason).toContain("medium is 9 km");
    expect(s.reason).toContain("limit at age 6 is 6 km");
  });
  it("relaxed falls to the easy version when the family version is over the relaxed budget", () => {
    const d = day([
      variant("B", [trail("a", 4, 100, { durationMin: 200 }), trail("b", 4, 100, { durationMin: 200 }), trail("c", 4, 100, { durationMin: 100 })], { audience: "family", label: "Whole family" }),
      variant("C", [trail("short", 1, 20)], { audience: "easy", label: "Easy day" }),
    ]);
    expect(selectVariant(d, family(10, { pace: "standard" })).variant.key).toBe("B");
    expect(selectVariant(d, family(10, { pace: "relaxed" })).variant.key).toBe("C");
  });
  it("marks fits: false and picks the lowest rank when nothing fits a 3 year old, naming the walk", () => {
    const d = day([
      variant("B", [trail("Berg Lake viewpoint", 9, 350)], { audience: "family", label: "Whole family" }),
      variant("C", [trail("Berg Lake viewpoint", 9, 350)], { audience: "easy", label: "Easy day" }),
    ]);
    const s = selectVariant(d, family(3));
    expect(s.fits).toBe(false);
    expect(s.variant.key).toBe("C");
    expect(s.reason).toContain("Berg Lake viewpoint is 9 km");
    expect(s.reason).toContain("limit at age 3 is 8 km");
  });
  it("rejects a variant whose hard minimum age is over the youngest", () => {
    const v = variant("main", [item("canyon", "visit", "Canyoning", { minAge: 5, minAgeRule: "hard", durationMin: 120, durationSource: "operator" })]);
    expect(variantFits(v, family(4)).fits).toBe(false);
    expect(variantFits(v, family(4)).reason).toContain("age 5 and up");
    expect(variantFits(v, family(6)).fits).toBe(true);
    expect(variantFits(v, profile()).fits).toBe(true);
  });
  it("does not exclude on advice-only age limits", () => {
    const v = variant("main", [item("x", "visit", "X", { minAge: 8, minAgeRule: "advice", durationMin: 60, durationSource: "plan" })]);
    expect(variantFits(v, family(6)).fits).toBe(true);
  });
  it("lets an override win even when it does not fit", () => {
    const s = selectVariant(trio(), family(6), "A");
    expect(s.variant.key).toBe("A");
    expect(s.chosenBy).toBe("override");
    expect(s.fits).toBe(false);
    expect(s.reason).toContain("picked for this day");
  });
  it("offers a parallel lane only with two or more adults in a family", () => {
    const d = day([variant("A", [trail("long", 11, 700)], { audience: "adults", relation: "parallel" }), variant("B", [trail("medium", 4, 150)], { audience: "family" })]);
    expect(selectVariant(d, family(6)).parallel?.key).toBe("A");
    expect(selectVariant(d, family(6, { adults: 1 })).parallel).toBeNull();
    expect(selectVariant(d, profile()).parallel).toBeNull();
  });
  it("keeps one version for a day without variants", () => {
    const s = selectVariant(day([variant("main", [trail("w", 3, 50)])]), family(6));
    expect(s.variant.key).toBe("main");
    expect(s.reason).toBe("The plan's day");
  });
});

describe("suitability contract (spec 3.11)", () => {
  it("reads a partial record without throwing and never excludes on a null", () => {
    expect(suitsProfile(readSuitability(null), family(2))).toEqual({ fits: true, reason: null, advice: [] });
    expect(suitsProfile(readSuitability({}), family(2)).fits).toBe(true);
  });
  it("excludes on a hard minimum age and notes advice without excluding", () => {
    expect(suitsProfile(readSuitability({ minAge: 12, rule: "hard" }), family(8)).fits).toBe(false);
    const adv = suitsProfile(readSuitability({ minAge: 12, rule: "advice" }), family(8));
    expect(adv.fits).toBe(true);
    expect(adv.advice[0]).toContain("12");
  });
  it("excludes a under-4 on a trail with no stroller and no carrier", () => {
    expect(suitsProfile(readSuitability({ stroller: "no", carrierOk: false }), family(3)).fits).toBe(false);
    expect(suitsProfile(readSuitability({ stroller: "no", carrierOk: true }), family(3)).fits).toBe(true);
  });
});
