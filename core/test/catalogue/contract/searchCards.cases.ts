// Card search (D-E7, store.ts A28): K24. Places whose card text holds the words, at most 50, rows on the allowlist, a stable order.
import { expect } from "vitest";
import { API_LIMITS, PLACE_ROW_KEYS, cardHits, type PlaceRow } from "../../../src/schema/api/index.ts";
import { SKELETON, allRows, expectError, expectOk, type ContractCase, type ContractTarget } from "./kit.ts";
import type { CatalogueStore } from "../../../src/catalogue/store.ts";

/** A word of a card and a place that has it: the target's fact, or the longest name word of the fact place. */
async function cardWord(store: CatalogueStore, t: ContractTarget): Promise<{ word: string; slug: string }> {
  if (t.facts.cardWord) return t.facts.cardWord;
  const d = expectOk(await store.getPlace(t.facts.placeSlug));
  const name = "name" in d ? d.name : "";
  const word = name.split(/[^A-Za-z]+/).sort((a, b) => b.length - a.length)[0] ?? "";
  return { word, slug: t.facts.placeSlug };
}

export const searchCardsCases: ContractCase[] = [
  {
    id: "K24",
    title: "searchCards caps at 50 rows on the allowlist, finds a card by its words, filters like the list, and orders the same way twice",
    method: "searchCards",
    awaits: { step: "API-3b step 11 (K24: searchCards)", failsWith: SKELETON },
    async run(store, t) {
      const { word, slug } = await cardWord(store, t);
      expect(word.length, "a card word").toBeGreaterThan(2);
      const got = expectOk(await store.searchCards({ q: word }));
      expect(cardHits.safeParse(got).success).toBe(true);
      expect(got.items.length).toBeLessThanOrEqual(API_LIMITS.cards.max);
      expect(got.truncated).toBe(got.total > got.items.length);
      expect(got.terms.length).toBeGreaterThan(0);
      for (const r of got.items) expect(Object.keys(r).sort(), r.slug).toEqual([...PLACE_ROW_KEYS].sort());
      expect(got.items.map((r) => r.slug)).toContain(slug);
      // the same query twice gives the same order (ties by sortKey(name), then ref: A28)
      expect(expectOk(await store.searchCards({ q: word })).items.map((r) => r.ref)).toEqual(got.items.map((r) => r.ref));
      // every other filter applies: a country filter keeps only that country's rows, a subset of the listed rows
      const cc = t.facts.region.cc;
      const inCountry = expectOk(await store.searchCards({ q: word, facets: { country: [cc] } }));
      const listed = new Set((await allRows<PlaceRow>((n) => store.listPlaces({ facets: { country: [cc] } }, { page: n, pageSize: API_LIMITS.pageSize.max }))).map((r) => r.ref));
      for (const r of inCountry.items) expect(listed.has(r.ref), r.slug).toBe(true);
      // a smaller limit is a prefix of the larger answer
      const two = expectOk(await store.searchCards({ q: word, limit: 2 }));
      expect(two.items.map((r) => r.ref)).toEqual(got.items.slice(0, 2).map((r) => r.ref));
      expect(two.total).toBe(got.total);
      // stop words alone match nothing
      expect(expectOk(await store.searchCards({ q: "the and of" })).total).toBe(0);
    },
  },
  {
    id: "K24.caps",
    title: "a limit above 50 is too_large; an empty q and a sort are invalid_input",
    method: "searchCards",
    awaits: { step: "API-3b step 11 (K24: searchCards)", failsWith: SKELETON },
    async run(store) {
      expectError(await store.searchCards({ q: "lake", limit: API_LIMITS.cards.max + 1 }), "too_large");
      expectError(await store.searchCards({ q: "" }), "invalid_input");
      expectError(await store.searchCards({ q: "lake", sort: ["name"] } as never), "invalid_input");
    },
  },
];
