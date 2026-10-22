// towns: K15 (not_available until META-2), the row cap, the region scope of a prefix lookup.
import { expect } from "vitest";
import { API_LIMITS, townList } from "../../../src/schema/api/index.ts";
import { expectError, expectOk, type ContractCase } from "./kit.ts";

export const townsCases: ContractCase[] = [
  {
    id: "K15",
    title: "towns answer not_available until the towns layer exists, then at most the cap",
    method: "towns",
    async run(store, t) {
      const r = await store.towns({ city: t.facts.town.id, r: 500 });
      if (!t.facts.town.layer) return expectError(r, "not_available");
      const got = expectOk(r);
      expect(townList.safeParse(got).success).toBe(true);
      expect(got.items.length).toBeLessThanOrEqual(API_LIMITS.towns.max);
      for (const town of got.items) expect(town.distanceKm!).toBeLessThanOrEqual(API_LIMITS.nearRadius.max);
    },
  },
  {
    id: "towns.scope",
    title: "a prefix without a region is invalid_scope; no centre and no prefix is invalid_scope",
    method: "towns",
    async run(store, t) {
      if (!t.facts.town.layer) return expectError(await store.towns({ prefix: "a" }), "not_available");
      expectError(await store.towns({ prefix: "a" }), "invalid_scope");
      expectError(await store.towns({ prefix: "a", cc: t.facts.region.cc }), "invalid_scope");
      expectError(await store.towns({}), "invalid_scope");
      const { cc, aliases } = t.facts.region;
      const got = expectOk(await store.towns({ prefix: "a", cc, region: aliases[0]! }));
      expect(got.truncated).toBe(false);
    },
  },
];
