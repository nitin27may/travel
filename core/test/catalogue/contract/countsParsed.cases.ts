// Parsed counts (D-E7, store.ts A25): K22. A count with `parsed` equals the count of the merged query, and the merged query's list.
import { expect } from "vitest";
import { mergeParsed } from "../../../src/catalogue/store.ts";
import { facetCounts, type CountQuery } from "../../../src/schema/api/index.ts";
import { expectError, expectOk, type ContractCase } from "./kit.ts";

export const countsParsedCases: ContractCase[] = [
  {
    id: "K22",
    title: "countPlaces({...q, parsed}) equals countPlaces and listPlaces of mergeParsed(q, parsed): n, unchecked and every facet",
    method: "countPlaces",
    async run(store, t) {
      const { cc, aliases } = t.facts.region;
      // a real parse of the target's own words, merged into a query that already filters
      const parse = expectOk(await store.parse({ q: `${aliases[0]} lakes` }));
      const cases: CountQuery[] = [
        { facets: { country: [cc] }, parsed: { q: parse.q, facets: parse.facets } },
        // the parse's key replaces the query's (kind: trail becomes kind: lake), the other keys stay
        { q: "zzzz-no-such-words", facets: { country: [cc], kind: ["trail"] }, parsed: { facets: { kind: ["lake"] } } },
        // an empty parse clears the words and keeps the filters
        { q: "zzzz-no-such-words", facets: { country: [cc] }, parsed: {} },
      ];
      for (const q of cases) {
        const merged = mergeParsed(q);
        const got = expectOk(await store.countPlaces(q), JSON.stringify(q));
        expect(facetCounts.safeParse(got).success).toBe(true);
        const want = expectOk(await store.countPlaces(merged));
        expect(got.n).toBe(want.n);
        expect(got.n).toBe(expectOk(await store.listPlaces(merged)).total);
        expect(got.unchecked).toBe(want.unchecked);
        expect(got.facets).toEqual(want.facets);
        expect(got.gaps).toEqual(want.gaps);
      }
      expect(mergeParsed(cases[1]!)).toEqual({ facets: { country: [cc], kind: ["lake"] } });
      expect(mergeParsed(cases[2]!)).toEqual({ facets: { country: [cc] } });
    },
  },
  {
    id: "K22.invalid",
    title: "a parse with an unknown facet key or an oversized text is invalid_input, before any count",
    method: "countPlaces",
    async run(store) {
      expectError(await store.countPlaces({ parsed: { facets: { "not a key": ["x"] } } }), "invalid_input");
      expectError(await store.countPlaces({ parsed: { q: "x".repeat(10_000) } }), "invalid_input");
    },
  },
];
