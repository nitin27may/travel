// countPlaces: counts only, the same filters as listPlaces, K14 region aliases.
import { expect } from "vitest";
import { facetCounts } from "../../../src/schema/api/index.ts";
import { expectError, expectOk, type ContractCase } from "./kit.ts";

export const countPlacesCases: ContractCase[] = [
  {
    id: "countPlaces.shape",
    title: "counts parse as FacetCounts and carry no row",
    method: "countPlaces",
    async run(store) {
      const got = expectOk(await store.countPlaces({}));
      expect(facetCounts.safeParse(got).success).toBe(true);
      expect(JSON.stringify(got)).not.toMatch(/"slug"/);
      expect(got.n).toBe(got.total);
    },
  },
  {
    id: "countPlaces.agrees",
    title: "n equals listPlaces' total for the same query",
    method: "countPlaces",
    async run(store, t) {
      const q = { facets: { country: [t.facts.region.cc] } };
      expect(expectOk(await store.countPlaces(q)).n).toBe(expectOk(await store.listPlaces(q)).total);
    },
  },
  {
    id: "K14",
    title: "every region alias counts the same rows",
    method: "countPlaces",
    async run(store, t) {
      const { cc, canonical, aliases } = t.facts.region;
      const base = expectOk(await store.countPlaces({ facets: { country: [cc], region: [canonical] } })).n;
      expect(base).toBeGreaterThan(0);
      for (const alias of aliases) expect(expectOk(await store.countPlaces({ facets: { country: [cc], region: [alias] } })).n, alias).toBe(base);
    },
  },
  {
    id: "countPlaces.invalid",
    title: "an unknown facet key is invalid_input",
    method: "countPlaces",
    async run(store) {
      expectError(await store.countPlaces({ facets: { "not-a-key": ["x"] } }), "invalid_input");
    },
  },
];
