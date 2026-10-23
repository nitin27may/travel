// K28: the engine parity corpus (PHASE-E-START 15.27, review API3-R-7). `listPlaces` and `countPlaces` on every target equal the query
// engine's own free-text rule (core/src/query/text.ts, store.ts A16) over 30 queries drawn from the target's rows: the words a visitor
// types (a name, an area, a country, a tag, a kind), several words in any order, capitals, padding, a word no row holds, and the
// "lake" case that once counted 20 on the server against the 22 the list showed. The expected rows are computed HERE from the target's
// own full list with the core rule, so a store that matches by substring of fewer fields, folds accents or stops at the first word fails.
import { expect } from "vitest";
import { matchesFreeText, placeHaystack } from "../../../src/query/text.ts";
import { API_LIMITS, type PlaceRow } from "../../../src/schema/api/index.ts";
import { allRows, expectOk, type ContractCase } from "./kit.ts";

export const CORPUS_SIZE = 30;

const words = (s: string): string[] => s.split(/[^\p{L}\p{N}']+/u).filter(Boolean);

/** Thirty queries: six fixed (the 20-vs-22 "lake" among them), the rest drawn from rows spread through the list. */
export function corpusQueries(rows: readonly PlaceRow[]): string[] {
  const out: string[] = ["lake", "LAKE", "  lake  ", "national park", "park national", "zzzzqqxx"];
  const step = Math.max(1, Math.floor(rows.length / 12));
  for (let i = 0; i < rows.length && out.length < CORPUS_SIZE; i += step) {
    const r = rows[i]!;
    const longest = [...words(r.name)].sort((a, b) => b.length - a.length)[0];
    const candidates = [
      longest,
      words(r.name).slice(0, 2).join(" "),
      r.area_name,
      `${longest ?? ""} ${r.country_name}`,
      r.tags[0]?.label,
      r.kindLabel.toUpperCase(),
      words(r.region_name).slice(-1)[0],
    ];
    for (const c of candidates) {
      const q = c?.trim();
      if (q && !out.includes(q) && out.length < CORPUS_SIZE) out.push(q);
    }
  }
  // a tiny catalogue may not fill the corpus: pad with words of the names themselves
  for (const r of rows) for (const w of words(r.name)) if (out.length < CORPUS_SIZE && w.length > 2 && !out.includes(w)) out.push(w);
  for (let n = 0; out.length < CORPUS_SIZE; n++) out.push(`nothing${n}`);
  return out.slice(0, CORPUS_SIZE);
}

export const corpusCases: ContractCase[] = [
  {
    id: "K28",
    title: "listPlaces and countPlaces equal the engine's word rule over 30 queries, alone and inside a country",
    method: "listPlaces",
    async run(store, t) {
      const rows = await allRows<PlaceRow>((n) => store.listPlaces({}, { page: n, pageSize: API_LIMITS.pageSize.max }));
      const queries = corpusQueries(rows);
      expect(queries.length).toBe(CORPUS_SIZE);
      const cc = t.facts.region.cc;
      let nonEmpty = 0;
      for (const q of queries) {
        for (const inCountry of [false, true]) {
          // the full list is already in the A15 order, so a filtered copy of it is the order the store must give
          const want = rows.filter((r) => (!inCountry || r.country === cc) && matchesFreeText(q, r, placeHaystack));
          const query = { q, ...(inCountry ? { facets: { country: [cc] } } : {}) };
          const list = expectOk(await store.listPlaces(query, { pageSize: API_LIMITS.pageSize.max }), `list "${q}"`);
          const count = expectOk(await store.countPlaces(query), `count "${q}"`);
          expect(list.total, `listPlaces total for "${q}"${inCountry ? ` in ${cc}` : ""}`).toBe(want.length);
          expect(count.n, `countPlaces n for "${q}"${inCountry ? ` in ${cc}` : ""}`).toBe(want.length);
          expect(list.items.map((r) => r.ref), `listPlaces rows for "${q}"${inCountry ? ` in ${cc}` : ""}`).toEqual(want.slice(0, API_LIMITS.pageSize.max).map((r) => r.ref));
          if (want.length && !inCountry) nonEmpty++;
        }
      }
      expect(nonEmpty, "the corpus must find rows for most of its queries").toBeGreaterThanOrEqual(15);
    },
  },
  {
    id: "K28.lake",
    title: "the word 'lake' counts the same in a count, a list and the engine's rule (the 20-vs-22 case)",
    method: "countPlaces",
    async run(store) {
      const rows = await allRows<PlaceRow>((n) => store.listPlaces({}, { page: n, pageSize: API_LIMITS.pageSize.max }));
      const want = rows.filter((r) => matchesFreeText("lake", r, placeHaystack)).length;
      expect(expectOk(await store.countPlaces({ q: "lake" })).n).toBe(want);
      expect(expectOk(await store.listPlaces({ q: "lake" })).total).toBe(want);
    },
  },
];
