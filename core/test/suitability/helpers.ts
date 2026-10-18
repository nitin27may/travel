// Builders for suitability tests. Values here are synthetic fixtures: they check the code, they are not data.
import type { GradeSystem } from "../../src/suitability/types.ts";
import type { SuitabilityBlock, SuitabilityRecord, SuitVal } from "../../src/schema/suitability.ts";

type Basis = NonNullable<SuitVal<unknown>["basis"]>;

/** A value that rests on a source. Operator rule by default. */
export function v<T>(value: T, basis: Basis = "operator_rule", extra: Partial<SuitVal<T>> = {}): SuitVal<T> {
  return { v: value, state: "value", basis, src: basis === "our_inference" ? [] : ["src-0001"], ...(basis === "our_inference" ? { note: "fixture method" } : {}), ...extra };
}
export const searchedNone = <T>(): SuitVal<T> => ({ v: null, state: "searched_none", basis: null, src: [], on: "2026-10-18", tried: ["operator terms page", "booking FAQ"] });
export const gap = <T>(): SuitVal<T> => ({ v: null, state: "gap", basis: null, src: [] });

export function walk(km: number, gainM: number, extra: SuitabilityBlock = {}): SuitabilityBlock {
  return {
    ...extra,
    effort: {
      ...extra.effort,
      drivers: { distance_km: v(km, "official_info"), gain_m: v(gainM, "official_info"), ...extra.effort?.drivers },
    },
  };
}

export function rec(block: SuitabilityBlock, over: Partial<SuitabilityRecord> = {}): SuitabilityRecord {
  return { ref: "place/lago-di-braies", kind: "trail", suitability: block, ...over };
}

/** A source grade value. */
export const sg = (system: GradeSystem, value: string, basis: Basis = "official_grade"): SuitVal<{ system: GradeSystem; value: string }> =>
  v({ system, value }, basis);
