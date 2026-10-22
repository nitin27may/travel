// search and parse: K1 (the search limit cap), the shapes, purity of the parse.
import { expect } from "vitest";
import { API_LIMITS, parsedQuery, searchResult } from "../../../src/schema/api/index.ts";
import { expectError, expectOk, type ContractCase } from "./kit.ts";

export const searchCases: ContractCase[] = [
  {
    id: "K1",
    title: "limit above the cap is too_large; at the cap it is served",
    method: "search",
    async run(store) {
      expectError(await store.search({ q: "a", limit: API_LIMITS.searchLimit.max + 1 }), "too_large");
      expectOk(await store.search({ q: "a", limit: API_LIMITS.searchLimit.max }));
    },
  },
  {
    id: "search.shape",
    title: "an answer parses as SearchResult, each group within the limit",
    method: "search",
    async run(store, t) {
      const got = expectOk(await store.search({ q: t.facts.placeSlug.split("-")[0]!, limit: 3 }));
      expect(searchResult.safeParse(got).success).toBe(true);
      for (const g of got.groups) expect(g.hits.length).toBeLessThanOrEqual(3);
      expect(got.counts.places).toBeGreaterThan(0);
    },
  },
];

export const parseCases: ContractCase[] = [
  {
    id: "parse.shape",
    title: "a parse parses as ParsedQuery and is pure (same words, same answer)",
    method: "parse",
    async run(store, t) {
      const q = `${t.facts.region.aliases[0]} lakes`;
      const one = expectOk(await store.parse({ q }));
      expect(parsedQuery.safeParse(one).success).toBe(true);
      expect(expectOk(await store.parse({ q }))).toEqual(one);
      expectError(await store.parse({ q: "x".repeat(API_LIMITS.query.textChars + 1) }), "invalid_input");
    },
  },
];
