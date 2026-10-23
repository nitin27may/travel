import { describe, expect, it } from "vitest";
import { JsonStore, type JsonSource } from "../../src/catalogue/json/index.ts";
import { stubData } from "../../src/catalogue/stub/index.ts";

// A source over the stub's rows, with a detail that fails on demand.
function source(failures: { n: number }): JsonSource {
  const d = stubData();
  const engine = { knows: () => true, match: <R,>(rows: readonly R[]) => [...rows], counts: () => ({ facets: {}, gaps: {}, notes: [], scope: 0, unchecked: 0 }) };
  return {
    registry: d.registry,
    placeRows: d.places.map((p) => p.row),
    placeDetail(slug) {
      if (failures.n-- > 0) throw new Error("a cited source is not in the registry");
      return d.places.find((p) => p.row.slug === slug)?.detail ?? null;
    },
    placeEngine: engine,
    tripRows: d.trips.map((t) => t.row),
    tripDetail: (slug) => d.trips.find((t) => t.row.slug === slug)?.detail ?? null,
    tripEngine: engine,
    parse: () => { throw new Error("unused"); },
    search: () => { throw new Error("unused"); },
    exportFile: () => null,
    globe: { tree: () => ({ continents: [] }), pins: () => null, card: () => null, feature: () => null, line: () => null },
    reportLink: () => null,
    snapshot: () => ({ globe: null, vocab: null, citations: null, towns: null }),
  };
}

describe("JsonStore.revision", () => {
  it("does not keep a failure for the life of the store: the next call builds the revision again (audit GB-A-5)", async () => {
    const store = new JsonStore(source({ n: 1 }));
    await expect(store.revision()).rejects.toThrow(/registry/);
    const rev = await store.revision();
    expect(rev).toMatch(/^[0-9a-f]{64}$/);
    expect(await store.revision()).toBe(rev);
  });
});
