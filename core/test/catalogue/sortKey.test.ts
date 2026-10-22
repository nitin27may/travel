import { describe, expect, it } from "vitest";
import { compareCodePoints, compareSortable, sortByName, sortKey } from "../../src/catalogue/sortKey.ts";

describe("sortKey (D-B5)", () => {
  it("folds accents, case and white space", () => {
    expect(sortKey("Lac Supérieur")).toBe("lac superieur");
    expect(sortKey("  Émerald   Pool ")).toBe("emerald pool");
    expect(sortKey("ÆSIR")).toBe("æsir");
    expect(sortKey("Ⅻ Ｆｕｌｌ")).toBe("xii full");
  });
  it("is idempotent", () => {
    for (const s of ["Lac Supérieur", "Ötzi", "Smörgås"]) expect(sortKey(sortKey(s))).toBe(sortKey(s));
  });
});

describe("compareCodePoints (collate \"C\" order)", () => {
  it("orders by code point, not by locale", () => {
    expect(["b", "B", "a", "_", "Z"].sort(compareCodePoints)).toEqual(["B", "Z", "_", "a", "b"]);
    // localeCompare puts "a" before "B"; code-point order does not
    expect(compareCodePoints("a", "B")).toBe(1);
  });
  it("orders characters above U+FFFF after the rest of the BMP, as UTF-8 bytes do", () => {
    // UTF-16 code units would put U+1F600 (surrogates D83D...) before U+FF5E
    expect(compareCodePoints("\u{1F600}", "～")).toBe(1);
    expect(compareCodePoints("ab", "abc")).toBe(-1);
    expect(compareCodePoints("abc", "abc")).toBe(0);
  });
});

describe("compareSortable", () => {
  it("breaks a sort-key tie by ref, so two stores cut pages at the same row", () => {
    const rows = [
      { name: "Emerald Pool", ref: "place/b" },
      { name: "Émerald Pool", ref: "place/a" },
      { name: "Alpine Lake", ref: "place/z" },
    ];
    expect(sortByName(rows).map((r) => r.ref)).toEqual(["place/z", "place/a", "place/b"]);
    expect(sortByName([...rows].reverse()).map((r) => r.ref)).toEqual(["place/z", "place/a", "place/b"]);
    expect(compareSortable({ sortKey: "x", ref: "a" }, { sortKey: "x", ref: "a" })).toBe(0);
  });
});
