// A small slug registry and light index for the favourites tests: one of every resolve state in both spaces, a ref with a space and a
// colon (`trip/<id>/sight:...`), an alias, a page pinned but not public, and a slug shared by a place and a trip.
import { slugRegistry, SLUG_REGISTRY_SCHEMA, type SlugRegistry } from "../../src/catalogue/slugs.ts";
import { ok } from "../../src/catalogue/result.ts";
import { buildResolveIndex, resolveRefsResult, type LightLookup, type ResolveRefsMethod } from "../../src/favourites/resolve.ts";
import type { FavSpace, LightRow, ResolveQuery } from "../../src/schema/favourites.ts";

export const REGISTRY: SlugRegistry = slugRegistry.parse({
  schema: SLUG_REGISTRY_SCHEMA,
  places: {
    slugs: {
      "route/moraine-lake": "moraine-lake",
      "route/johnston-canyon": "johnston-canyon",
      "place/lake-agnes": "lake-agnes-teahouse",
      "sight/lake-louise-sightseeing": "lake-louise-sightseeing",
      "sight/lake-louise-gondola": "lake-louise-gondola",
      "trip/algonquin/sight:ragged falls": "ragged-falls",
      "route/bow-falls-new": "bow-falls",
      "place/hidden-place": "hidden-place",
    },
    retired: { "lake-agnes": "place/lake-agnes", "louise-sightseeing-old": "sight/lake-louise-sightseeing" },
    merged: { "sight/lake-louise-sightseeing": "sight/lake-louise-gondola" },
    withdrawn: { "adventure/icewalks": "athabasca-icewalk" },
  },
  trips: {
    slugs: { "trip/dolomites-2027": "dolomites-2027", "trip/private-trip": "private-trip", "trip/iceland": "iceland-2028", "trip/moraine-lake": "moraine-lake" },
    retired: { "iceland-old": "trip/iceland" },
    merged: {},
    withdrawn: { "trip/gone": "gone-trip" },
  },
  formerKeys: { "route/bow-falls-old": "route/bow-falls-new" },
  regions: {},
});

const LIGHT: Record<string, LightRow & { space: FavSpace }> = {
  "route/moraine-lake": { space: "place", name: "Moraine Lake", kind: "lake", cc: "CA" },
  "route/johnston-canyon": { space: "place", name: "Johnston Canyon", kind: "trail", cc: "CA" },
  "place/lake-agnes": { space: "place", name: "Lake Agnes Teahouse", kind: "sight", cc: "CA" },
  "sight/lake-louise-sightseeing": { space: "place", name: "Lake Louise Sightseeing", kind: "lift", cc: "CA" },
  "sight/lake-louise-gondola": { space: "place", name: "Lake Louise Gondola", kind: "lift", cc: "CA" },
  "trip/algonquin/sight:ragged falls": { space: "place", name: "Ragged Falls", kind: "waterfall", cc: "CA" },
  "route/bow-falls-new": { space: "place", name: "Bow Falls", kind: "waterfall", cc: "CA" },
  "trip/dolomites-2027": { space: "trip", name: "Dolomites", kind: null, cc: "IT" },
  "trip/iceland": { space: "trip", name: "Iceland", kind: null, cc: "IS" },
  "trip/moraine-lake": { space: "trip", name: "Moraine Lake weekend", kind: null, cc: "CA" },
  // place/hidden-place and trip/private-trip are pinned but not public: no light row
};

export const light: LightLookup = (space, key) => {
  const r = LIGHT[key];
  return r && r.space === space ? { name: r.name, kind: r.kind, cc: r.cc } : null;
};

export const INDEX = buildResolveIndex(REGISTRY);
export const REVISION = "rev-fixture-1";

/** The fake CatalogueStore method: the pure resolver behind the declared type (FAV-1 wires the real JsonStore). */
export class FakeResolveStore implements ResolveRefsMethod {
  calls = 0;
  async resolveRefs(q: ResolveQuery) {
    this.calls++;
    return resolveRefsResult(INDEX, light, q, REVISION);
  }
  async revision() {
    return ok(REVISION, REVISION);
  }
}
