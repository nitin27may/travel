// An offer's block over its record's block: the offer's own fields win, anything it leaves out falls back to the record.
import type { SuitabilityBlock, SuitabilityRecord } from "../schema/suitability.ts";

type Offer = NonNullable<SuitabilityRecord["offers"]>[number];

/** Effort drivers, water safety and participation merge one level down, so an offer that sets only `class` keeps the record's lifejacket. */
export function mergeBlock(base: SuitabilityBlock, offer?: Offer): SuitabilityBlock {
  if (!offer) return base;
  const o = offer.suitability;
  const merged: SuitabilityBlock = { ...base, ...o };
  if (base.effort || o.effort) {
    merged.effort = { ...base.effort, ...o.effort, drivers: { ...base.effort?.drivers, ...o.effort?.drivers } };
  }
  if (base.water_safety || o.water_safety) merged.water_safety = { ...base.water_safety, ...o.water_safety };
  if (base.participation || o.participation) merged.participation = { ...base.participation, ...o.participation };
  return merged;
}
