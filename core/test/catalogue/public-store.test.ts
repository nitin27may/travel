// publicStore (public-ref-aliases 5.1 B1; REF-C acceptance A5, A7): every method wrapped, every answer (values and keys, errors too) in
// public form, the resolve echo kept verbatim, the gazetteer forwarded. The whole contract kit runs through it on a stub with a dated
// folder planted (core/test/catalogue/contract.test.ts, target `stub-public`); here the planted stub shows the raw store leaks and the
// wrapped one does not.
import { describe, expect, it } from "vitest";
import { STUB_RETIRED, StubStore } from "../../src/catalogue/stub/index.ts";
import { CATALOGUE_METHODS, type CatalogueStore } from "../../src/catalogue/store.ts";
import { isPublicStore, publicStore } from "../../src/catalogue/public-store.ts";
import { gazetteerOf } from "../../src/privacy/towns.ts";
import { DATED_FOLDER_WHY, privacyHits } from "../../src/privacy/detect.ts";
import { householdCases } from "./contract/household.cases.ts";
import { PLANTED_ALIAS, PLANTED_DATED, PLANTED_TABLE, plantedDatedStub, publicTarget } from "./planted-dated.ts";

const datedHits = (x: unknown) => privacyHits(x, 50).filter((h) => h.why === DATED_FOLDER_WHY);

describe("publicStore", () => {
  it("wraps every CatalogueStore method (a new method fails the type check until it is wrapped)", () => {
    const s = publicStore(new StubStore(), PLANTED_TABLE);
    for (const m of CATALOGUE_METHODS) expect(typeof s[m], m).toBe("function");
    expect(isPublicStore(s)).toBe(true);
    expect(isPublicStore(new StubStore())).toBe(false);
  });
  it("forwards the inner store's gazetteer, so respond()'s town exemption still holds", async () => {
    const inner = new StubStore();
    expect(await gazetteerOf(publicStore(inner, PLANTED_TABLE))).toBe(await gazetteerOf(inner));
  });
  it("the planted stub leaks its dated ref raw; through publicStore every answer carries the alias, in values and in keys", async () => {
    const raw = plantedDatedStub();
    const pub = publicStore(raw, PLANTED_TABLE);
    // the planted record's current slug (its first slug, larch-basin, is the stub's retired one)
    const rawPlace = await raw.getPlace(STUB_RETIRED.to);
    const pubPlace = await pub.getPlace(STUB_RETIRED.to);
    expect(rawPlace.ok && pubPlace.ok && "sections" in pubPlace.data).toBe(true);
    expect(datedHits(rawPlace).length).toBeGreaterThan(0);
    expect(datedHits(pubPlace)).toEqual([]);
    const text = JSON.stringify(pubPlace);
    expect(text).toContain(PLANTED_ALIAS);
    expect(text).not.toContain(PLANTED_DATED);
    // the export bodies are strings: rewritten inside too
    for (const format of ["gpx", "kml", "csv", "json"] as const) {
      const r = await pub.getExport({ type: "trip", slug: "stub-rockies-loop", format });
      expect(datedHits(r), format).toEqual([]);
    }
  });
  it("K7 fails on the raw planted stub for the dated folder, and passes through publicStore", async () => {
    const k7 = householdCases[0]!;
    const target = publicTarget();
    await expect(k7.run(plantedDatedStub(), target)).rejects.toThrow();
    await k7.run(await target.make(), target);
  });
  it("resolve: the alias resolves to the public ref; a dated ref asked is unknown and its echo is kept verbatim (no oracle)", async () => {
    const pub = publicStore(plantedDatedStub(), PLANTED_TABLE);
    const aliasRef = `legacy/${PLANTED_ALIAS}/hikes/larch-basin`;
    const datedRef = `legacy/${PLANTED_DATED}/hikes/larch-basin`;
    const r = await pub.resolveRefs({ refs: [aliasRef, `place:${STUB_RETIRED.to}`, datedRef, "legacy/stub-rockies-jan-2029/hikes/larch-basin"] });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.data.items.map((i) => [i.asked, i.state, i.ref])).toEqual([
      [aliasRef, "current", aliasRef],
      [`place:${STUB_RETIRED.to}`, "current", aliasRef],
      [datedRef, "unknown", null],
      ["legacy/stub-rockies-jan-2029/hikes/larch-basin", "unknown", null],
    ]);
  });
  it("resolve with duplicate refs: one row per input, in the order sent, each `asked` restored verbatim (REF-REVIEW)", async () => {
    const pub = publicStore(plantedDatedStub(), PLANTED_TABLE);
    const aliasRef = `legacy/${PLANTED_ALIAS}/hikes/larch-basin`;
    const datedRef = `legacy/${PLANTED_DATED}/hikes/larch-basin`;
    const asked = [datedRef, aliasRef, datedRef, aliasRef, `place:${STUB_RETIRED.to}`, aliasRef, "legacy/stub-rockies-jan-2029/hikes/larch-basin", datedRef];
    const r = await pub.resolveRefs({ refs: asked });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.data.items.map((i) => i.asked)).toEqual(asked);
    expect(r.data.items.map((i) => i.state)).toEqual(["unknown", "current", "unknown", "current", "current", "current", "unknown", "unknown"]);
    expect(r.data.items.map((i) => i.ref)).toEqual([null, aliasRef, null, aliasRef, aliasRef, aliasRef, null, null]);
  });
  it("an error's message and details are public too", async () => {
    const inner = new StubStore();
    const leaky: CatalogueStore = Object.assign(Object.create(inner) as CatalogueStore, {
      getPlace: async () => ({ ok: false as const, error: { code: "not_found" as const, message: `no ${PLANTED_DATED}`, details: { [PLANTED_DATED]: 1 } } }),
    });
    const r = await publicStore(leaky, PLANTED_TABLE).getPlace("x");
    expect(datedHits(r)).toEqual([]);
  });
});
