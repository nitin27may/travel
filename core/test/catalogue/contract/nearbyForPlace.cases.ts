// nearbyForPlace: the list cap, K17 approximate points, the no-point and approximate-point states. Pending on JsonStore until phase E (N2).
import { expect } from "vitest";
import { API_LIMITS, nearbyBlock } from "../../../src/schema/api/index.ts";
import { expectError, expectOk, type ContractCase } from "./kit.ts";

export const nearbyForPlaceCases: ContractCase[] = [
  {
    id: "nearbyForPlace.shape",
    title: "the block parses, lists at most the cap within the radius, nearest first",
    method: "nearbyForPlace",
    async run(store, t) {
      const got = expectOk(await store.nearbyForPlace(t.facts.placeSlug));
      expect(nearbyBlock.safeParse(got).success).toBe(true);
      expect(got.items.length).toBeLessThanOrEqual(API_LIMITS.nearby.list);
      for (const i of got.items) expect(i.distanceKm).toBeLessThanOrEqual(API_LIMITS.nearby.radius);
      expect(got.items.map((i) => i.distanceKm)).toEqual(got.items.map((i) => i.distanceKm).sort((a, b) => a - b));
      expectError(await store.nearbyForPlace("no-such-place-anywhere"), "not_found");
    },
  },
  {
    id: "K17",
    title: "approximate points are never listed; an approximate place draws no block",
    method: "nearbyForPlace",
    async run(store, t) {
      const approx = new Set(t.facts.approxSlugs);
      const got = expectOk(await store.nearbyForPlace(t.facts.placeSlug));
      for (const i of got.items) expect(approx.has(i.slug)).toBe(false);
      for (const slug of approx) {
        const own = expectOk(await store.nearbyForPlace(slug));
        expect(own.state).toBe("approx_point");
        expect(own.items).toEqual([]);
      }
    },
  },
];
