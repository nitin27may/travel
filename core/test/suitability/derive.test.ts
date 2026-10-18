import { describe, expect, it } from "vitest";
import { accessibilityOf, deriveEffort, kidFitOf, projectFlat, terrainFromDrivers } from "../../src/suitability/derive.ts";
import { DEFAULT_MAP, bandOf } from "../../src/suitability/map.ts";
import type { GradeSystem } from "../../src/suitability/types.ts";
import { gap, rec, searchedNone, v, walk, sg } from "./helpers.ts";

const effort = (block: Parameters<typeof walk>[2], kind = "trail", subkind?: string) => deriveEffort({ kind, subkind, block: block ?? {} });
const grade = (system: GradeSystem, value: string) => ({ effort: { source_grade: v({ system, value }, "official_grade") } });

describe("effort bands (difficulty-map.json)", () => {
  it.each([[0, 1], [5.99, 1], [6, 2], [11.99, 2], [12, 3], [19.99, 3], [20, 4], [29.99, 4], [30, 4], [60, 4]])("effort_km %f is band %i", (km, band) => {
    expect(bandOf(DEFAULT_MAP, km)).toBe(band);
  });
});

describe("deriveEffort", () => {
  it("Larch Valley: 11.2 km and 750 m is effort_km 18.7, band 3", () => {
    const e = effort(walk(11.2, 750));
    expect(e.effort_km).toBe(18.7);
    expect(e.band).toBe(3);
    expect(e.terrain).toBeNull(); // no grade and no drivers: nothing to say about terrain
    expect(e.family_effort).toBe(3); // effort only
  });

  it("family effort is the larger of terrain and band", () => {
    expect(effort(walk(2, 10, grade("cai", "EE"))).family_effort).toBe(4); // short but EE terrain 4
    expect(effort(walk(30, 400, grade("parks-canada", "Easy"))).family_effort).toBe(4); // easy ground, very long
    expect(effort(walk(8, 100, grade("parks-canada", "Moderate"))).family_effort).toBe(2);
  });

  it("is computed from stored values only: a typed family_effort is not read", () => {
    const sneaky = walk(2, 10) as Record<string, unknown>;
    (sneaky.effort as Record<string, unknown>).family_effort = 5;
    expect(effort(sneaky).family_effort).toBe(1);
  });

  it("the mode factor makes four km of riding count as one km of walking", () => {
    // Drava path: 43.4 km and 15 m. Ridden: 43.4 * 0.25 + 0.15 = 11, band 2. Walked it would be band 4.
    const block = walk(43.4, 15, { effort: { source_grade: sg("bike-path", "car_free_paved", "our_inference") } });
    const ride = deriveEffort({ kind: "activity", subkind: "cycling", block, ext: { kind: "ride" } });
    expect(ride.mode).toBe("ride");
    expect(ride.effort_km).toBe(11);
    expect(ride.band).toBe(2);
    expect(ride.terrain).toBe(1);
    expect(ride.family_effort).toBe(2);
    expect(deriveEffort({ kind: "trail", block }).band).toBe(4);
  });

  it("a Class II raft has terrain 3, read from water_safety.class (A10: the water class is the effort grade for paddling)", () => {
    const e = deriveEffort({ kind: "activity", subkind: "rafting", block: { water_safety: { class: v({ system: "whitewater" as const, value: "II" }, "official_grade") } }, ext: { kind: "paddle" } });
    expect(e.terrain).toBe(3);
    expect(e.terrain_basis).toBe("mapped");
    expect(e.family_effort).toBe(3);
  });

  it("an override replaces the mapped terrain and says so", () => {
    const block = { effort: { source_grade: sg("sac", "T2", "official_grade"), override: { grade: 4, reason: "snow on the traverse", by: "nitin", on: "2026-10-18" } } };
    const e = effort(block);
    expect(e.terrain).toBe(4);
    expect(e.terrain_basis).toBe("override");
  });

  it("a flat made surface selects the flat row of the grade", () => {
    const flat = { effort: { source_grade: sg("sac", "T1", "official_grade"), drivers: { surface: v(["paved" as const], "official_info") } } };
    expect(effort(flat).terrain).toBe(1);
    expect(effort({ effort: { source_grade: sg("sac", "T1", "official_grade") } }).terrain).toBe(2);
  });

  it("an unmapped grade falls back to the drivers", () => {
    const e = effort({ effort: { source_grade: sg("local", "easy", "official_info"), drivers: { scrambling: v("hands_occasional", "official_info") } } });
    expect(e.terrain).toBe(4);
    expect(e.terrain_basis).toBe("drivers");
  });

  it("gain is needed for a band, unless the source says it does not apply", () => {
    expect(effort({ effort: { drivers: { distance_km: v(10, "official_info") } } }).band).toBeNull();
    expect(effort({ effort: { drivers: { distance_km: v(10, "official_info"), gain_m: { v: null, state: "not_applicable", basis: null, src: [] } } } }).effort_km).toBe(10);
  });

  it("kinds with a fixed terrain get it only when nothing else says", () => {
    expect(effort({}, "activity", "zipline")).toMatchObject({ terrain: 2, terrain_basis: "kind_default" });
    expect(effort({}, "lift")).toMatchObject({ terrain: 1, family_effort: 1 });
    expect(effort({}, "town").family_effort).toBeNull();
    expect(effort({}, "activity", "bungee").family_effort).toBeNull();
  });
});

describe("terrain from drivers (spec 1.3)", () => {
  const d = (drivers: Record<string, unknown>, exposure?: unknown) => terrainFromDrivers({ effort: { drivers: drivers as never }, ...(exposure ? { exposure: exposure as never } : {}) });
  it("paved or boardwalk under 5% is 1", () => {
    expect(d({ surface: v(["paved"], "official_info"), max_grade_pct: v(4, "official_info") })).toBe(1);
    expect(d({ surface: v(["boardwalk", "paved"], "official_info") })).toBe(1);
    expect(d({ surface: v(["paved"], "official_info"), max_grade_pct: v(8, "official_info") })).toBe(2);
  });
  it("a path with no hands is 2, rough ground or some exposure is 3", () => {
    expect(d({ surface: v(["dirt"], "official_info"), scrambling: v("none", "official_info") })).toBe(2);
    expect(d({ surface: v(["dirt", "roots"], "official_info") })).toBe(3);
    expect(d({ surface: v(["dirt"], "official_info") }, v({ level: "some", fenced: "partly" }, "community"))).toBe(3);
  });
  it("hands, chains, ladders or significant exposure is 4; hands needed or serious exposure is 5", () => {
    expect(d({ scrambling: v("hands_occasional", "official_info") })).toBe(4);
    expect(d({ fixed_aids: v(["ladders"], "official_info") })).toBe(4);
    expect(d({}, v({ level: "significant", fenced: "unfenced" }, "official_info"))).toBe(4);
    expect(d({ scrambling: v("hands_needed", "official_info") })).toBe(5);
    expect(d({}, v({ level: "serious", fenced: "unfenced" }, "official_info"))).toBe(5);
  });
  it("says nothing when the drivers say nothing", () => {
    expect(d({})).toBeNull();
    expect(d({ surface: gap() })).toBeNull();
  });
});

describe("the flat catalogue copy", () => {
  it("carries limits only when they rest on a rule", () => {
    const flat = projectFlat(rec({
      min_age: v(8, "operator_rule"),
      max_weight_kg: v(113, "operator_rule"),
      min_height_cm: { v: null, state: "gap", basis: null, src: [], conflicts: [{ v: 110, basis: "our_inference", src: [] }] },
    }));
    expect(flat).toMatchObject({ min_age: 8, max_weight_kg: 113, min_height_cm: null });
  });

  it("Kicking Horse: a 50 lb minimum is min_weight_kg 22.7 and never a maximum", () => {
    const flat = projectFlat(rec({
      min_age: v(8, "operator_rule"),
      min_weight_kg: v(22.7, "operator_rule", { quote: "50 lb", note: "50 lb = 22.7 kg, a minimum" }),
    }, { kind: "activity", subkind: "rafting" }));
    expect(flat.min_weight_kg).toBe(22.7);
    expect(flat.max_weight_kg).toBeNull();
  });

  it("an operator-recommended age warns and never becomes min_age or kid_fit no", () => {
    const loen = rec({ min_age: v(12), age_rule: "recommendation", age_band: v({ from: 7, to: null }, "our_inference") }, { kind: "activity", subkind: "via-ferrata" });
    expect(projectFlat(loen)).toMatchObject({ min_age: null, max_age: null, kid_fit: "yes" });
    expect(kidFitOf({ min_age: v(12), age_rule: "recommendation" })).toBe("unknown");
    expect(projectFlat(rec({ min_age: v(12), age_rule: "rule" })).min_age).toBe(12);
    expect(kidFitOf({ min_age: v(12), age_rule: "rule" })).toBe("no");
  });

  it("house_grade is family effort; walk_km and walk_gain_m are the drivers", () => {
    expect(projectFlat(rec(walk(11.2, 750)))).toMatchObject({ house_grade: 3, walk_km: 11.2, walk_gain_m: 750 });
  });

  describe("kid_fit (spec 5.3)", () => {
    const band = (from: number) => ({ age_band: v({ from, to: null }, "our_inference") });
    it.each([[0, "yes"], [7, "yes"], [8, "strong-kid"], [11, "strong-kid"], [12, "no"], [16, "no"]])("band from %i is %s", (from, want) => {
      expect(kidFitOf(band(from))).toBe(want);
    });
    it("a hard minimum age of 12 or more is no, whatever the band says", () => {
      expect(kidFitOf({ ...band(7), min_age: v(12, "operator_rule") })).toBe("no");
    });
    it("is unknown with no band, and a conflict does not count as a minimum", () => {
      expect(kidFitOf({})).toBe("unknown");
      expect(kidFitOf({ min_age: { v: null, state: "gap", basis: null, src: [], conflicts: [{ v: 14, basis: "our_inference", src: [] }] } })).toBe("unknown");
    });
  });

  it("accessibility follows wheelchair", () => {
    expect(accessibilityOf({ wheelchair: v("step_free", "official_info") })).toBe("step-free");
    expect(accessibilityOf({ wheelchair: v("partial", "official_info") })).toBe("partial");
    expect(accessibilityOf({ wheelchair: v("none", "official_info") })).toBe("none");
    expect(accessibilityOf({ wheelchair: searchedNone() })).toBe("unknown");
    expect(accessibilityOf({})).toBe("unknown");
  });
});
