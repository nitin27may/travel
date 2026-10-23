// near: K1 page size, K2 allowlist, K3 clamp, K4 unknown centre, K5 unscoped, K17 approximate points. Pending on JsonStore until
// phase E (N2, nearby-and-regions.md section 7) fills the method.
import { expect } from "vitest";
import { API_LIMITS, PLACE_ROW_KEYS, nearPage } from "../../../src/schema/api/index.ts";
import { expectError, expectOk, type ContractCase } from "./kit.ts";

export const nearCases: ContractCase[] = [
  {
    id: "near.shape",
    title: "an answer parses as NearPage, nearest first",
    method: "near",
    async run(store, t) {
      const got = expectOk(await store.near({ near: t.facts.near.token, r: API_LIMITS.nearRadius.max }));
      expect(nearPage.safeParse(got).success).toBe(true);
      const kms = got.items.map((r) => r.distanceKm);
      expect(kms).toEqual([...kms].sort((a, b) => a - b));
    },
  },
  {
    id: "K1",
    title: "pageSize above the cap is too_large",
    method: "near",
    async run(store, t) {
      expectError(await store.near({ near: t.facts.near.token }, { pageSize: API_LIMITS.pageSize.max + 1 }), "too_large");
    },
  },
  {
    id: "K2",
    title: "near rows carry the PlaceRow allowlist plus distanceKm, bearing, band, basis and minutes, nothing else (A35)",
    method: "near",
    async run(store, t) {
      const got = expectOk(await store.near({ near: t.facts.near.token, r: API_LIMITS.nearRadius.max }));
      for (const r of got.items) {
        expect(Object.keys(r).sort()).toEqual([...PLACE_ROW_KEYS, "distanceKm", "bearing", "band", "basis", "minutes"].sort());
        // minutes only with a routed basis (A35): an estimate never carries a number of minutes
        if (r.basis === "estimate") expect(r.minutes).toBeNull();
      }
    },
  },
  {
    id: "K3",
    title: "r=500 clamps to the cap with clamped: true; r within the cap is kept",
    method: "near",
    async run(store, t) {
      const big = expectOk(await store.near({ near: t.facts.near.token, r: 500 }));
      expect(big.r).toBe(API_LIMITS.nearRadius.max);
      expect(big.clamped).toBe(true);
      for (const row of big.items) expect(row.distanceKm).toBeLessThanOrEqual(API_LIMITS.nearRadius.max);
      const small = expectOk(await store.near({ near: t.facts.near.token, r: 50 }));
      expect(small.r).toBe(50);
      expect(small.clamped).toBe(false);
    },
  },
  {
    id: "K4",
    title: "an unknown centre is not_found and reads no row or shard",
    method: "near",
    async run(store, t) {
      const before = t.rowReads?.(store);
      expectError(await store.near({ near: t.facts.near.unknown }), "not_found");
      expect(before, "the target must expose rowReads for K4").not.toBeUndefined();
      expect(t.rowReads!(store)).toBe(before);
    },
  },
  {
    id: "K5",
    title: "a near query with no centre is invalid_scope, whatever else it filters",
    method: "near",
    async run(store, t) {
      expectError(await store.near({}), "invalid_scope");
      expectError(await store.near({ r: 25, facets: { country: [t.facts.region.cc] } }), "invalid_scope");
    },
  },
  {
    id: "K17",
    title: "approximate points are never in a near answer, and basis counts them",
    method: "near",
    async run(store, t) {
      const got = expectOk(await store.near({ near: t.facts.near.token, r: API_LIMITS.nearRadius.max, facets: {} }));
      const approx = new Set(t.facts.approxSlugs);
      for (const r of got.items) expect(approx.has(r.slug), r.slug).toBe(false);
      expect(got.basis.distance).toBe("straight_line");
      // with no filter, every approximate place is in scope, so each is counted as left out
      expect(got.basis.excludedApprox).toBe(t.facts.approxSlugs.length);
    },
  },
];
