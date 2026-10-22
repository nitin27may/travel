import { mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson, revisionOf, servedSnapshot } from "../../src/catalogue/revision.ts";
import { StubStore, stubData } from "../../src/catalogue/stub/index.ts";

describe("canonicalJson", () => {
  it("sorts keys at every depth and keeps array order", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, 1], c: null } })).toBe('{"a":{"c":null,"d":[3,1]},"b":1}');
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });
  it("drops undefined members like JSON does, and refuses what JSON cannot hold", () => {
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(() => canonicalJson({ a: Number.NaN })).toThrow(/finite/);
    expect(() => canonicalJson({ a: new Map() })).toThrow(/plain object/);
    expect(() => canonicalJson({ a: () => 1 })).toThrow(/function/);
  });
});

describe("revisionOf (D-B6)", () => {
  it("is deterministic: the same data in two instances gives the same hash", () => {
    const a = revisionOf(servedSnapshot({ dataset: stubData(), slugs: stubData().registry }));
    const b = revisionOf(servedSnapshot({ dataset: stubData(), slugs: stubData().registry }));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
  });
  it("changes when one value changes, and when only the slug registry changes", () => {
    const base = revisionOf(servedSnapshot({ dataset: { x: [1, 2] }, slugs: { places: { k: "a" } } }));
    expect(revisionOf(servedSnapshot({ dataset: { x: [1, 3] }, slugs: { places: { k: "a" } } }))).not.toBe(base);
    expect(revisionOf(servedSnapshot({ dataset: { x: [1, 2] }, slugs: { places: { k: "b" } } }))).not.toBe(base);
  });
  it("does not depend on key order or on a file's mtime", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rev-"));
    const file = join(dir, "data.json");
    writeFileSync(file, JSON.stringify({ b: 1, a: 2 }));
    const read = () => revisionOf(servedSnapshot({ dataset: JSON.parse(readFileSync(file, "utf8")), slugs: {} }));
    const before = read();
    utimesSync(file, new Date(2001, 0, 1), new Date(2001, 0, 1));
    expect(read()).toBe(before);
    expect(revisionOf(servedSnapshot({ dataset: { a: 2, b: 1 }, slugs: {} }))).toBe(before);
  });
  it("covers every served input: a globe, towns, vocabulary or citation change moves it (R-7)", () => {
    const base = servedSnapshot({ dataset: { a: 1 }, slugs: {} });
    const rev = revisionOf(base);
    for (const k of ["globe", "towns", "vocab", "citations"] as const) expect(revisionOf({ ...base, [k]: { changed: true } }), k).not.toBe(rev);
    expect(Object.keys(base).sort()).toEqual(["citations", "dataset", "globe", "slugs", "towns", "vocab"]);
  });
  it("two StubStores share a revision; a changed fixture does not", async () => {
    expect(await new StubStore().revision()).toBe(await new StubStore().revision());
    const d = stubData();
    d.towns[0]!.pop = (d.towns[0]!.pop ?? 0) + 1;
    expect(await new StubStore({ data: d }).revision()).not.toBe(await new StubStore().revision());
    const g = stubData();
    g.lines[0]!.name = "Renamed range";
    expect(await new StubStore({ data: g }).revision()).not.toBe(await new StubStore().revision());
  });
});
