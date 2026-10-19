// kids_from with its basis, and the three flat values on one fixture per profile family (L3b).
import { describe, expect, it } from "vitest";
import { familyEffortOf, kidsFromBasisOf, kidsFromOf, strollerOkOf } from "../../src/suitability/derive.ts";
import { rec, sg, v, walk } from "./helpers.ts";

const hike = (block: object) => rec(block, { kind: "trail", subkind: "hike" });
const lake = (block: object) => rec(block, { kind: "lake", subkind: "lake" });
const lift = (block: object) => rec(block, { kind: "lift", subkind: "gondola" });
const raft = (block: object, extra = {}) => rec(block, { kind: "activity", subkind: "rafting", ...extra });
const bungee = (block: object) => rec(block, { kind: "activity", subkind: "bungee" });
const boat = (block: object) => rec(block, { kind: "activity", subkind: "boat-tour" });

describe("kidsFromBasisOf: a rule hides, advice fades", () => {
  it("is a rule when a rule minimum sets the number", () => {
    expect(kidsFromBasisOf(boat({ min_age: v(6) }))).toEqual({ value: 6, basis: "rule" });
    expect(kidsFromBasisOf(boat({ min_age: v(8), age_band: v({ from: 8, to: null }, "our_inference") }))).toEqual({ value: 8, basis: "rule" });
  });
  it("is advice when the recommended band starts higher than the rule", () => {
    expect(kidsFromBasisOf(boat({ min_age: v(6), age_band: v({ from: 9, to: null }, "our_inference") }))).toEqual({ value: 9, basis: "advice" });
    expect(kidsFromBasisOf(hike({ age_band: v({ from: 10, to: null }, "our_inference") }))).toEqual({ value: 10, basis: "advice" });
  });
  it("is null when neither is known, and agrees with kidsFromOf", () => {
    expect(kidsFromBasisOf(boat({}))).toBeNull();
    for (const r of [boat({ min_age: v(6) }), hike({ age_band: v({ from: 7, to: null }, "our_inference") }), boat({})]) expect(kidsFromBasisOf(r)?.value ?? null).toBe(kidsFromOf(r));
  });
  it("with offers, takes the most permissive", () => {
    const r = raft({}, { offers: [{ name: "Family", suitability: { min_age: v(8) } }, { name: "Class III", suitability: { min_age: v(12) } }] });
    expect(kidsFromBasisOf(r)).toEqual({ value: 8, basis: "rule" });
  });
});

describe("the three flat values, one fixture per profile family", () => {
  it("hike: family effort from the grade, stroller from the surface", () => {
    const r = hike({ ...walk(5, 100, { effort: { source_grade: sg("sac", "T2") } }), stroller: v("none", "official_info") });
    expect(familyEffortOf(r)).toBe(3);
    expect(strollerOkOf(r)).toBe("no");
  });
  it("lake: no minimum age, no effort", () => {
    expect(kidsFromOf(lake({ min_age: v(8) }))).toBeNull();
    expect(familyEffortOf(lake({}))).toBeNull();
  });
  it("lift: no effort, stroller from the carriage rule", () => {
    expect(familyEffortOf(lift({}))).toBeNull();
    expect(strollerOkOf(lift({ stroller_on_board: v("folded", "operator_rule") }))).toBe("partly");
  });
  it("raft: the rule minimum, no stroller", () => {
    expect(kidsFromOf(raft({ min_age: v(8) }))).toBe(8);
    expect(strollerOkOf(raft({ stroller: v("smooth", "official_info") }))).toBeNull();
  });
  it("bungee: effort and stroller are N", () => {
    expect(familyEffortOf(bungee({}))).toBeNull();
    expect(strollerOkOf(bungee({ stroller: v("smooth", "official_info") }))).toBeNull();
  });
  it("boat tour: stroller on board is a carriage rule", () => {
    expect(strollerOkOf(boat({ stroller_on_board: v("no", "operator_rule") }))).toBe("no");
    expect(strollerOkOf(boat({ stroller_on_board: v("yes", "operator_rule") }))).toBe("yes");
  });
});

describe("tagEffortOf: effort that rests on distance, gain or a grade, never on exposure alone", () => {
  it("a short walk with a rock surface is easy, not hard", async () => {
    const { tagEffortOf } = await import("../../src/suitability/derive.ts");
    const mesa = rec({ effort: { drivers: { distance_km: v(1, "official_info"), gain_m: v(17, "official_info"), surface: v(["dirt", "rock"], "our_inference") } }, exposure: v({ level: "significant", fenced: "unfenced" }, "official_info") }, { kind: "trail", subkind: "walk" });
    expect(familyEffortOf(mesa)).toBeGreaterThanOrEqual(3);
    expect(tagEffortOf(mesa)).toBe(1);
  });
  it("an official grade still counts, a bare driver result is null, a lift has none", async () => {
    const { tagEffortOf } = await import("../../src/suitability/derive.ts");
    expect(tagEffortOf(hike({ effort: { source_grade: sg("sac", "T3") } }))).toBeGreaterThanOrEqual(3);
    expect(tagEffortOf(hike({ effort: { drivers: { surface: v(["rock"], "our_inference") } } }))).toBeNull();
    expect(tagEffortOf(lift({}))).toBeNull();
    // a grade the difficulty map cannot translate is still an official grade: it keeps the family effort (Track and Tower, "Difficult")
    const local = hike({ effort: { source_grade: sg("local", "Difficult"), drivers: { distance_km: v(7.5, "official_info"), surface: v(["rock"], "our_inference") } } });
    expect(tagEffortOf(local)).toBe(familyEffortOf(local));
  });
});
