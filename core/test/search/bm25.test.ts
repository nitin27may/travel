import { describe, expect, it } from "vitest";
import { buildTextIndex, cardText, queryTerms, searchTexts, stem, terms } from "../../src/search/bm25.ts";
import { matchesFreeText, placeHaystack, queryWords, tripHaystack } from "../../src/query/text.ts";

// The one BM25 module (store.ts A28, review API3-R-8) and the one list word rule (A16, review API3-R-7).
const round = (n: number): number => Math.round(n * 1e6) / 1e6;

describe("terms (A28)", () => {
  it("drops accents, stop words and one-letter words, stems, and keeps repeats", () => {
    expect(terms("The Horseback Riding of Cafés and lakes")).toEqual(["horseback", "riding", "cafe", "lake"]);
    expect(terms("quiet quiet a b lake")).toEqual(["quiet", "quiet", "lake"]);
    expect(terms("Straße")).toEqual(["strasse"]);
    expect([stem("falls"), stem("glass"), stem("rides"), stem("boxes"), stem("cities"), stem("hiking")]).toEqual(["fall", "glass", "ride", "box", "city", "hiking"]);
  });
  it("reads a query as its DISTINCT terms, first seen first (definition 4)", () => {
    expect(queryTerms("lake Lake LAKES boat lake")).toEqual(["lake", "boat"]);
  });
});

describe("the four definitions A28 used to leave out", () => {
  const docs = [
    { id: "a", text: "Quiet lake with a boat rental" },
    { id: "b", text: "Quiet viewpoint above the town" },
    { id: "c", text: "Busy town square" },
    { id: "d", text: "Quiet quiet quiet lake" },
  ];
  const ix = buildTextIndex(docs);

  it("1. document length is the terms after stop words and stemming, repeats counted", () => {
    expect(ix.len).toEqual([4, 4, 3, 4]);
    expect(buildTextIndex([{ id: "x", text: "lakes LAKE lake of the" }]).len).toEqual([3]);
  });
  it("scores are pinned to six decimals", () => {
    const hits = searchTexts([ix], "quiet lake boat");
    expect(hits.map((h) => [h.id, round(h.score)])).toEqual([
      ["a", 2.19396],
      ["d", 1.22734],
    ]);
  });
  it("2. tags enter the card text as their LABELS, never their ids", () => {
    const text = cardText({ name: "Glacier Lake", kindLabel: "Lake", areaChain: [{ name: "Bow Valley" }], summary: "A blue lake.", tags: ["Family friendly"] });
    expect(text).toBe("Glacier Lake Lake Bow Valley A blue lake. Family friendly");
    expect(terms(text)).toContain("family");
  });
  it("3. N counts the places indexed: a place with no card is not a document", () => {
    const withoutCard = buildTextIndex(docs.slice(0, 3));
    expect(withoutCard.ids).toEqual(["a", "b", "c"]);
    // the same query over one more indexed document changes idf; over a place left out of the index it cannot
    const plain = searchTexts([withoutCard], "quiet").map((h) => round(h.score));
    expect(searchTexts([buildTextIndex(docs.slice(0, 3))], "quiet").map((h) => round(h.score))).toEqual(plain);
    expect(searchTexts([ix], "quiet").map((h) => round(h.score))).not.toEqual(plain);
  });
  it("4. repeats in the query do not raise the minimum match", () => {
    // distinct terms: lake, zebra -> half is 1, so "lake" alone qualifies; counting repeats (4 words) would need 2
    expect(searchTexts([ix], "lake lake lake zebra").map((h) => h.id)).toEqual(["a", "d"]);
    expect(searchTexts([ix], "quiet zebra giraffe")).toEqual([]);
  });
  it("scores the same however the catalogue is split", () => {
    const split = [buildTextIndex(docs.slice(0, 2)), buildTextIndex(docs.slice(2))];
    expect(searchTexts(split, "quiet lake boat").map((h) => [h.id, round(h.score)])).toEqual(searchTexts([ix], "quiet lake boat").map((h) => [h.id, round(h.score)]));
  });
});

describe("the list's word rule (A16)", () => {
  const place = { name: "Lago Verde", area_name: "Dolomites East", region_name: "Veneto", country_name: "Italy", tags: [{ label: "Family" }], kindLabel: "Lake", kind: "lake" };
  const trip = { title: "Alps week", region: "Alps", countryName: "Italy", firstBase: "Cortina" };

  it("needs every word, in any order, in the wider haystack, ignoring case", () => {
    expect(queryWords("  Lake  ITALY ")).toEqual(["lake", "italy"]);
    expect(matchesFreeText("italy lake", place, placeHaystack)).toBe(true);
    expect(matchesFreeText("family dolomites", place, placeHaystack)).toBe(true);
    expect(matchesFreeText("lake canada", place, placeHaystack)).toBe(false);
    expect(matchesFreeText("cortina", trip, tripHaystack)).toBe(true);
  });
  it("matches everything on a blank query, and does not fold accents (the list never did)", () => {
    expect(matchesFreeText("   ", place, placeHaystack)).toBe(true);
    expect(matchesFreeText(undefined, place, placeHaystack)).toBe(true);
    expect(matchesFreeText("véneto", place, placeHaystack)).toBe(false);
  });
});
