// Public refs in the contract (public-ref-aliases 5.2, REF-C acceptance A4): `apiRef`, `apiPlaceRef` and `favRef` refuse a dated legacy
// folder, so a schema parse in any test fails on a leaked ref; the alias passes; and OpenAPI states the same refusal as a pattern.
import { describe, expect, it } from "vitest";
import { buildOpenApi } from "../../src/catalogue/openapi.ts";
import { NO_DATED_FOLDER_SOURCE } from "../../src/catalogue/alias.ts";
import { apiPlaceRef, apiRef } from "../../src/schema/api/common.ts";
import { favRef, favRefShape } from "../../src/schema/favourites.ts";

const DATED = [
  "legacy/canadian-rockies-sept-2029/sights/bow-lake",
  "part/legacy/canadian-rockies-sept-2029/hikes/x#top",
  "offer/legacy/canadian-rockies-sept-2029/lifts/banff-gondola#ticket",
  "legacy/patagonia-feb-mar-2027/x",
  "trip/quebec-sept-2026",
  "legacy/Canadian-Rockies-SEPT-2029/x",
  "legacy/dolomites-july-2027/huts/a",
];
const PUBLIC = [
  "legacy/canadian-rockies-2029/sights/bow-lake",
  "offer/legacy/canadian-rockies-2029/lifts/banff-gondola#ticket",
  "route/johnston-canyon",
  "place/lake-louise",
  "trip/vermont-fall-2026",
  "trip/algonquin/sight:ragged falls",
  "trip/x/sight:2029-09 viewpoint",
];

describe("the contract refuses a dated ref (5.2)", () => {
  for (const [name, schema] of [["apiRef", apiRef], ["apiPlaceRef", apiPlaceRef], ["favRef", favRef]] as const) {
    it(`${name}: every dated form fails, every public form passes`, () => {
      for (const r of DATED) expect(schema.safeParse(r).success, r).toBe(false);
      for (const r of PUBLIC) expect(schema.safeParse(r).success, r).toBe(true);
    });
  }
  it("apiRef still takes a research ref that is a plain name", () => {
    expect(apiRef.safeParse("Lake Louise").success).toBe(true);
  });
  it("favRefShape (what the resolver accepts as a question) takes a dated ref, so asking one is never invalid_input (QR4)", () => {
    for (const r of DATED) expect(favRefShape.safeParse(r).success, r).toBe(true);
  });
  it("OpenAPI carries the refusal as a flag-free pattern on every ref", () => {
    const text = JSON.stringify(buildOpenApi());
    const n = text.split(JSON.stringify(NO_DATED_FOLDER_SOURCE).slice(1, -1)).length - 1;
    expect(n).toBeGreaterThan(10);
    // the pattern means the same with the `u` flag a JSON Schema validator uses
    const re = new RegExp(NO_DATED_FOLDER_SOURCE, "u");
    for (const r of DATED) expect(re.test(r), r).toBe(false);
    for (const r of PUBLIC) expect(re.test(r), r).toBe(true);
  });
});
