// Structural test for spec 6.1: ScheduleSuitability is the interface of docs/v2/features/trip-timeline.md 3.11, plus
// five fields. L3c (core/src/schedule/suitability.ts) can later replace its own declaration with
//   export type { ScheduleSuitability as Suitability } from '../suitability/project.ts'
// and this file is the check that nothing else changes. It is a compile-time test: tsc fails when the shapes drift.
import { describe, expect, expectTypeOf, it } from "vitest";
import { projectForSchedule } from "../../src/suitability/project.ts";
import type { ScheduleSuitability } from "../../src/suitability/project.ts";
import type { GradeSystem } from "../../src/suitability/types.ts";
import { rec } from "./helpers.ts";

/** A verbatim copy of the 3.11 interface, with one change the spec 6.1 makes: sourceGrade.system widens to GradeSystem. */
interface TimelineSuitability {
  minAge: number | null;
  maxAge: number | null;
  minHeightCm: number | null; maxHeightCm: number | null;
  minWeightKg: number | null; maxWeightKg: number | null;
  rule: "hard" | "advice" | null;
  stroller: "yes" | "partly" | "no" | null;
  wheelchair: "yes" | "partly" | "no" | null;
  carrierOk: boolean | null;
  familyEffort: 1 | 2 | 3 | 4 | 5 | null;
  sourceGrade: { system: GradeSystem; value: string } | null;
  childTime: {
    byAge: { fromAge: number; minutes: number }[];
    source: string;
  } | null;
  adultTime: { min: number; max: number; source: string } | null;
  distanceKm: number | null; gainM: number | null; lossM: number | null;
  provenance: string;
}

/** The six values the timeline's own union names. The ids are lower case here (difficulty-map ids). */
type TimelineSystems = "SAC" | "CAI" | "IMBA" | "whitewater" | "operator" | "local";

describe("ScheduleSuitability against the trip-timeline 3.11 interface", () => {
  it("every timeline field is present with the same type (compile-time)", () => {
    expectTypeOf<ScheduleSuitability>().toExtend<TimelineSuitability>();
    expectTypeOf<Pick<ScheduleSuitability, keyof TimelineSuitability>>().toEqualTypeOf<TimelineSuitability>();
  });

  it("adds exactly the five fields of spec 6.1", () => {
    type Extra = Exclude<keyof ScheduleSuitability, keyof TimelineSuitability>;
    expectTypeOf<Extra>().toEqualTypeOf<"terrain" | "effortKm" | "exposureUnfenced" | "ruleByField" | "strollerNote">();
  });

  it("the widened system list is a superset of the timeline's six (case aside)", () => {
    const folded: Lowercase<TimelineSystems>[] = ["sac", "cai", "imba", "whitewater", "operator", "local"];
    expectTypeOf<Lowercase<TimelineSystems>>().toExtend<GradeSystem>();
    expect(folded).toHaveLength(6);
  });

  it("the function returns the type at run time with every key present", () => {
    const s = projectForSchedule(rec({}));
    expect(Object.keys(s).sort()).toEqual([
      "adultTime", "carrierOk", "childTime", "distanceKm", "effortKm", "exposureUnfenced", "familyEffort", "gainM", "lossM", "maxAge", "maxHeightCm", "maxWeightKg", "minAge", "minHeightCm", "minWeightKg",
      "provenance", "rule", "ruleByField", "sourceGrade", "stroller", "strollerNote", "terrain", "wheelchair",
    ]);
  });
});
