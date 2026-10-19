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
