import { describe, expect, it } from "vitest";
import { mergeBlock, projectForSchedule } from "../../src/suitability/project.ts";
import type { SuitabilitySource } from "../../src/schema/suitability.ts";
import { gap, rec, v, walk, sg } from "./helpers.ts";

const sources: SuitabilitySource[] = [{ id: "src-0001", url: "https://example.org/operator", title: "Operator terms", publisher: "Operator", kind: "operator", read: "2026-10-12" }];

describe("projectForSchedule", () => {
  it("Via Ferrata Loen: age is advice, weight is a hard rule, and ruleByField says which", () => {
    const loen = rec({
      min_age: v(12), age_rule: "recommendation",
      min_weight_kg: v(40, "operator_rule", { note: "harness limit", quote: "40 kg" }),
      max_weight_kg: v(120),
      limit_reason: "harness",
    }, { kind: "activity", subkind: "via-ferrata", ext: { kind: "ferrata" } });
    const s = projectForSchedule(loen, undefined, { sources });
    expect(s).toMatchObject({ minAge: 12, minWeightKg: 40, maxWeightKg: 120, rule: "hard" });
    expect(s.ruleByField).toEqual({ minAge: "advice", minWeightKg: "hard", maxWeightKg: "hard" });
  });

  it("when the only limit is a recommended age the rule is advice", () => {
    const s = projectForSchedule(rec({ min_age: v(10), age_rule: "recommendation" }));
    expect(s.rule).toBe("advice");
    expect(s.minAge).toBe(10);
  });

  it("with no filled limit the rule is null and every limit is null", () => {
    const s = projectForSchedule(rec({ min_age: { v: null, state: "searched_none", basis: null, src: [], on: "2026-10-18", tried: ["a", "b"] } }));
    expect(s.rule).toBeNull();
    expect([s.minAge, s.maxAge, s.minHeightCm, s.maxHeightCm, s.minWeightKg, s.maxWeightKg]).toEqual([null, null, null, null, null, null]);
    expect(s.ruleByField).toEqual({});
  });

  it("a conflict never becomes a limit", () => {
    const s = projectForSchedule(rec({ min_weight_kg: { v: null, state: "gap", basis: null, src: [], conflicts: [{ v: 22.7, basis: "our_inference", src: [] }] } }));
    expect(s.minWeightKg).toBeNull();
    expect(s.rule).toBeNull();
  });

  it("Braies: smooth for part of the way is partly, with the note", () => {
    const s = projectForSchedule(rec({ stroller: v("smooth", "official_info"), stroller_extent: { scope: "part", part_note: "west shore only; steps on the east side" } }));
    expect(s.stroller).toBe("partly");
    expect(s.strollerNote).toBe("west shore only; steps on the east side");
  });

  it("stroller: whole smooth is yes, all-terrain is partly, none is no, unknown is null", () => {
    expect(projectForSchedule(rec({ stroller: v("smooth", "official_info"), stroller_extent: { scope: "whole" } })).stroller).toBe("yes");
    expect(projectForSchedule(rec({ stroller: v("smooth", "official_info") })).stroller).toBe("partly"); // extent not recorded: not claimed as whole
    expect(projectForSchedule(rec({ stroller: v("all_terrain", "our_inference"), stroller_extent: { scope: "whole" } }))).toMatchObject({ stroller: "partly", strollerNote: "all-terrain stroller only" });
    expect(projectForSchedule(rec({ stroller: v("none", "official_info") })).stroller).toBe("no");
    expect(projectForSchedule(rec({ stroller: gap() })).stroller).toBeNull();
    expect(projectForSchedule(rec({ stroller: v("smooth", "official_info"), stroller_extent: { scope: "part", part_km: 1.2 } })).strollerNote).toBe("first 1.2 km");
  });

  it("wheelchair and carrier map straight across", () => {
    expect(projectForSchedule(rec({ wheelchair: v("step_free", "official_info") })).wheelchair).toBe("yes");
    expect(projectForSchedule(rec({ wheelchair: v("partial", "official_info") })).wheelchair).toBe("partly");
    expect(projectForSchedule(rec({ wheelchair: v("none", "official_info") })).wheelchair).toBe("no");
    expect(projectForSchedule(rec({ carrier_ok: v(true, "our_inference") })).carrierOk).toBe(true);
    expect(projectForSchedule(rec({})).carrierOk).toBeNull();
  });

  it("effort fields: family effort, terrain, effort km, source grade and the drivers", () => {
    const s = projectForSchedule(rec(walk(11.2, 750, { effort: { source_grade: sg("parks-canada", "Difficult", "official_grade") } })));
    expect(s).toMatchObject({ familyEffort: 4, terrain: 4, effortKm: 18.7, distanceKm: 11.2, gainM: 750, lossM: null });
    expect(s.sourceGrade).toEqual({ system: "parks-canada", value: "Difficult" });
  });

  it("times: stated child time wins by age, adult time carries its basis", () => {
    const s = projectForSchedule(rec({
      adult_time_min: v([180, 240], "official_info"),
      child_time_min: v([{ from_age: 6, to_age: 9, range: [240, 300] }, { from_age: 10, to_age: null, range: [200, 220] }], "official_info"),
    }));
    expect(s.adultTime).toEqual({ min: 180, max: 240, source: "official information" });
    expect(s.childTime).toEqual({ byAge: [{ fromAge: 6, minutes: 270 }, { fromAge: 10, minutes: 210 }], source: "official information" });
    expect(projectForSchedule(rec({})).childTime).toBeNull();
    expect(projectForSchedule(rec({ adult_time_min: v([60, 90], "our_inference") })).adultTime?.source).toBe("our rule");
  });

  it("exposureUnfenced is true only for significant or serious exposure with no fence", () => {
    const e = (level: "none" | "some" | "significant" | "serious", fenced: "fenced" | "partly" | "unfenced" | null) => projectForSchedule(rec({ exposure: v({ level, fenced }, "official_info") })).exposureUnfenced;
    expect(e("significant", "unfenced")).toBe(true);
    expect(e("serious", "unfenced")).toBe(true);
    expect(e("significant", "fenced")).toBe(false);
    expect(e("some", "unfenced")).toBe(false);
    expect(projectForSchedule(rec({})).exposureUnfenced).toBe(false);
  });

  it("provenance words the basis, the date and the grade", () => {
    const s = projectForSchedule(rec({
      min_age: v(8), effort: { source_grade: sg("cai", "E", "official_grade") }, adult_time_min: v([180, 240], "our_inference"),
    }), undefined, { sources });
    expect(s.provenance).toBe("Operator rule, read 12 Oct 2026; CAI grade E (official grade); adult time our rule; child time our rule");
  });

  it("an offer overrides the record's fields and inherits the rest", () => {
    const parent = rec(walk(5, 100, { carrier_ok: v(true, "our_inference") }), { kind: "activity", subkind: "rafting", offers: [
      { name: "Class III", suitability: { min_age: v(12), effort: { source_grade: sg("whitewater", "III", "official_grade") } }, ext: { kind: "paddle" } },
    ] });
    const base = projectForSchedule(parent);
    const offer = projectForSchedule(parent, parent.offers![0]);
    expect(base.minAge).toBeNull();
    expect(offer.minAge).toBe(12);
    expect(offer.terrain).toBe(4);
    expect(offer.distanceKm).toBe(5); // inherited drivers
    expect(offer.carrierOk).toBe(true);
    expect(mergeBlock(parent.suitability, undefined)).toBe(parent.suitability);
  });
});
