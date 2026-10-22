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
    id: "countPlaces.semantics",
    title: "options count with every other key applied, a selected value with no rows shows 0, options run count-descending (A22)",
    method: "countPlaces",
    async run(store, t) {
      const cc = t.facts.region.cc;
      const got = expectOk(await store.countPlaces({ facets: { country: [cc], kind: ["lake", "no-such-kind"] } }));
      // the country options ignore the country filter itself, so every country still shows
      const all = expectOk(await store.countPlaces({ facets: { kind: ["lake", "no-such-kind"] } }));
      expect(got.facets.country).toEqual(all.facets.country);
      expect(got.facets.kind!.find((o) => o.value === "no-such-kind")?.count).toBe(0);
      for (const opts of Object.values(got.facets)) for (let i = 1; i < opts.length; i++) expect(opts[i - 1]!.count).toBeGreaterThanOrEqual(opts[i]!.count);
      expect(got.n).toBe(expectOk(await store.listPlaces({ facets: { country: [cc], kind: ["lake", "no-such-kind"] } })).total);
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
