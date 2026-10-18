import { describe, expect, it } from "vitest";
import { GATES, RELAXED, fits, gateFor } from "../../src/suitability/gates.ts";
import { gap, rec, searchedNone, v, walk, sg } from "./helpers.ts";

const mapped = (system: "cai" | "sac" | "parks-canada", value: string) => ({ effort: { source_grade: v({ system, value }, "official_grade") } });
const check = (res: ReturnType<typeof fits>, gate: string) => res.checks.find((c) => c.gate === gate)?.status;

describe("gates table (spec 6.2)", () => {
  it.each([
    [0, 2, 8, 400, 12], [3, 2, 8, 400, 12], [4, 2, 4, 200, 6], [5, 2, 4, 200, 6], [6, 3, 6, 350, 9.5], [7, 3, 6, 350, 9.5],
    [8, 3, 9, 500, 14], [9, 3, 9, 500, 14], [10, 4, 12, 750, 19.5], [12, 4, 12, 750, 19.5],
  ] as const)("age %i: cap %i, %f km, %i m, effort %f", (age, cap, km, gain, effort) => {
    const g = gateFor(age);
    expect([g.terrainCap, g.ceilingKm, g.ceilingGainM, g.effortKm]).toEqual([cap, km, gain, effort]);
  });
  it("13 to 15 cap at 4 with FE5 as advice; 16 and over are unrestricted", () => {
    for (const age of [13, 14, 15]) expect(gateFor(age)).toMatchObject({ terrainCap: 4, adviceAboveCap: true, ceilingKm: null });
    expect(gateFor(16)).toMatchObject({ terrainCap: 5, ceilingKm: null });
    expect(gateFor(40).terrainCap).toBe(5);
  });
  it("covers every age without a gap or an overlap", () => {
    for (let age = 0; age <= 90; age++) expect(GATES.filter((g) => age >= g.from && (g.to === null || age <= g.to))).toHaveLength(1);
  });
  it("the effort-km column is the ceilings combined: km + gain / 100", () => {
    for (const g of GATES) if (g.effortKm !== null) expect(g.ceilingKm! + g.ceilingGainM! / 100).toBeCloseTo(g.effortKm, 5);
  });
});

describe("fits: both gates apply", () => {
  it("a flat 14 km (FE3) fails a 6-year-old on the ceiling, not on the cap", () => {
    const r = fits(rec(walk(14, 0, { effort: { source_grade: sg("bike-path", "car_free_paved", "our_inference") } })), { youngestAge: 6 });
    expect(r.effort.family_effort).toBe(3);
    expect(check(r, "terrain_cap")).toBe("ok");
    expect(check(r, "ceiling_km")).toBe("fail");
    expect(r.fits).toBe("no");
  });

  it("a short exposed ledge fails the cap and passes the ceiling", () => {
    const r = fits(rec(walk(1, 20, { exposure: v({ level: "significant", fenced: "unfenced" }, "official_info") })), { youngestAge: 6 });
    expect(r.effort.terrain).toBe(4);
    expect(check(r, "terrain_cap")).toBe("fail");
    expect(check(r, "ceiling_km")).toBe("ok");
    expect(r.fits).toBe("no");
    expect(r.advice).toContain("unfenced drop-offs");
  });

  it("Larch Valley (11.2 km, 750 m) fits a 10-year-old and fails an 8-year-old", () => {
    const larch = rec(walk(11.2, 750, mapped("parks-canada", "Difficult")));
    expect(fits(larch, { youngestAge: 10 }).fits).toBe("yes");
    expect(fits(larch, { youngestAge: 8 }).fits).toBe("no");
  });

  it("ceilings are inclusive", () => {
    expect(fits(rec(walk(6, 350)), { youngestAge: 6 }).checks.filter((c) => c.gate.startsWith("ceiling")).map((c) => c.status)).toEqual(["ok", "ok"]);
    expect(check(fits(rec(walk(6.1, 350)), { youngestAge: 6 }), "ceiling_km")).toBe("fail");
  });

  it("a relaxed pace lowers the cap by one and the ceilings by 25%", () => {
    expect(RELAXED).toEqual({ capDrop: 1, ceilingFactor: 0.75 });
    const r = rec(walk(6, 300, mapped("parks-canada", "Difficult"))); // terrain 4, 6 km, effort 9
    expect(fits(r, { youngestAge: 10 }).fits).toBe("yes");
    expect(check(fits(r, { youngestAge: 10, relaxed: true }), "terrain_cap")).toBe("fail"); // cap 4 -> 3
    const long = rec(walk(9, 300)); // age 8-9 ceiling 9 km; relaxed 6.75
    expect(check(fits(long, { youngestAge: 8 }), "ceiling_km")).toBe("ok");
    expect(check(fits(long, { youngestAge: 8, relaxed: true }), "ceiling_km")).toBe("fail");
  });

  it("ages 13 to 15: FE5 terrain is advice and does not exclude; under 13 it does", () => {
    const hard = rec({ effort: { source_grade: sg("schall", "C", "official_grade") } }, { kind: "activity", subkind: "via-ferrata" });
    const teen = fits(hard, { youngestAge: 14 });
    expect(check(teen, "terrain_cap")).toBe("advice");
    expect(teen.fits).toBe("yes");
    expect(teen.advice.length).toBeGreaterThan(0);
    expect(fits(hard, { youngestAge: 12 }).fits).toBe("no");
    expect(fits(hard, { youngestAge: 16 }).fits).toBe("yes");
  });

  it("under 4, carried: needs a carrier or a stroller that works", () => {
    const base = walk(2, 20, mapped("parks-canada", "Easy"));
    expect(check(fits(rec({ ...base, carrier_ok: v(true, "our_inference") }), { youngestAge: 2 }), "carried")).toBe("ok");
    expect(check(fits(rec({ ...base, stroller: v("smooth", "official_info") }), { youngestAge: 2 }), "carried")).toBe("ok");
    expect(check(fits(rec({ ...base, carrier_ok: v(false, "our_inference"), stroller: v("none", "official_info") }), { youngestAge: 2 }), "carried")).toBe("fail");
    expect(check(fits(rec(base), { youngestAge: 2 }), "carried")).toBe("unknown");
    expect(fits(rec(base), { youngestAge: 5 }).checks.find((c) => c.gate === "carried")).toBeUndefined();
  });

  it("riding is judged by effort_km, not by the walking ceilings", () => {
    const ride = rec(walk(43.4, 15, { effort: { source_grade: sg("bike-path", "car_free_paved", "our_inference") } }), { kind: "activity", subkind: "cycling", ext: { kind: "ride" } });
    const r = fits(ride, { youngestAge: 10 });
    expect(r.checks.some((c) => c.gate === "ceiling_km")).toBe(false);
    expect(check(r, "effort_km")).toBe("ok"); // 43.4 * 0.25 + 0.15 = 11 <= 19.5
    expect(check(fits(ride, { youngestAge: 6 }), "effort_km")).toBe("fail"); // 11 > 9.5
  });

  it("missing distance or climb is unknown, never a pass", () => {
    const r = fits(rec({ effort: { source_grade: sg("sac", "T2", "official_grade") } }), { youngestAge: 8 });
    expect(check(r, "ceiling_km")).toBe("unknown");
    expect(r.fits).toBe("unknown");
  });
});

describe("fits: hard limits", () => {
  const funbob = rec({ min_age: v(8), min_height_cm: searchedNone() }, { kind: "activity", subkind: "mountain-coaster" });
  it("Funbob: a height nobody found is unknown once the party's height is given", () => {
    expect(fits(funbob, { youngestAge: 9, childHeightCm: 120 }).fits).toBe("unknown");
    expect(check(fits(funbob, { youngestAge: 9, childHeightCm: 120 }), "min_height")).toBe("unknown");
  });
  it("is not checked when the party gave no height", () => {
    expect(fits(funbob, { youngestAge: 9 }).checks.some((c) => c.gate === "min_height")).toBe(false);
    expect(fits(funbob, { youngestAge: 9 }).fits).toBe("yes");
  });
  it("a rule age fails a younger party; a recommendation only warns", () => {
    expect(fits(funbob, { youngestAge: 6 }).fits).toBe("no");
    const rec12 = rec({ min_age: v(12), age_rule: "recommendation" }, { kind: "activity", subkind: "via-ferrata" });
    const r = fits(rec12, { youngestAge: 10 });
    expect(check(r, "min_age")).toBe("advice");
    expect(r.fits).not.toBe("no");
  });
  it("weights and heights fail on the right end", () => {
    const loen = rec({ min_weight_kg: v(40), max_weight_kg: v(120) }, { kind: "activity", subkind: "via-ferrata" });
    expect(check(fits(loen, { youngestAge: 12, childWeightKg: 39 }), "min_weight")).toBe("fail");
    expect(check(fits(loen, { youngestAge: 12, childWeightKg: 40 }), "min_weight")).toBe("ok");
    expect(check(fits(loen, { youngestAge: 30, childWeightKg: 121 }), "max_weight")).toBe("fail");
  });
  it("a conflict is not a limit", () => {
    const kh = rec({ min_weight_kg: { v: null, state: "gap", basis: null, src: [], conflicts: [{ v: 22.7, basis: "our_inference", src: [] }] } }, { kind: "activity", subkind: "rafting" });
    expect(fits(kh, { youngestAge: 8, childWeightKg: 20 }).checks.find((c) => c.gate === "min_weight")?.status).toBe("unknown");
    expect(gap()).toBeTruthy();
  });
  it("an offer's limits apply instead of the record's", () => {
    const parent = rec({}, { kind: "activity", subkind: "rafting", offers: [
      { name: "Family Float", suitability: { min_age: v(8), min_weight_kg: v(22.7) } },
      { name: "Class III", suitability: { min_age: v(12) } },
    ] });
    expect(fits(parent, { youngestAge: 9, childWeightKg: 30 }, { offerIndex: 0 }).fits).toBe("yes");
    expect(fits(parent, { youngestAge: 9 }, { offerIndex: 1 }).fits).toBe("no");
  });
});
