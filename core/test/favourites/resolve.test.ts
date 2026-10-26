import { describe, expect, it } from "vitest";
import { resolveOne, resolveQueryOf, resolveRefsResult, resolveSearchOf } from "../../src/favourites/resolve.ts";
import { privacyHits } from "../../src/privacy/detect.ts";
import { resolveRow } from "../../src/schema/favourites.ts";
import { FakeResolveStore, INDEX, light, REVISION } from "./fixture.ts";
import { resolveRefsCases, type ResolveFacts } from "./resolveRefs.cases.ts";

const FACTS: ResolveFacts = {
  placeSlug: "moraine-lake",
  tripSlug: "dolomites-2027",
  retired: { from: "lake-agnes", to: "lake-agnes-teahouse" },
  merged: { from: "lake-louise-sightseeing", to: "lake-louise-gondola" },
  withdrawn: "athabasca-icewalk",
  former: { ref: "route/bow-falls-old", slug: "bow-falls" },
  tripRetired: { from: "iceland-old", to: "iceland-2028" },
};

describe("resolveRefs contract cases on the fake store", () => {
  for (const c of resolveRefsCases) it(`${c.id}: ${c.title}`, () => c.run(new FakeResolveStore(), FACTS));
});

describe("resolveRefs over the registry", () => {
  const one = (asked: string) => {
    const r = resolveOne(INDEX, light, asked);
    expect(resolveRow.safeParse(r).success, asked).toBe(true);
    return r;
  };

  it("a page pinned but not public answers unknown, exactly like a slug that never existed (no oracle)", () => {
    const hidden = one("place:hidden-place");
    const never = one("place:never-was-here");
    expect({ ...hidden, asked: "" }).toEqual({ ...never, asked: "" });
    expect(one("trip:private-trip")).toEqual({ ...one("trip:never-was-a-trip"), asked: "trip:private-trip" });
    expect(one("place/hidden-place").state).toBe("unknown");
    expect(one("trip/private-trip").state).toBe("unknown");
  });

  it("a place and a trip may share a slug: the space decides", () => {
    expect(one("place:moraine-lake")).toMatchObject({ space: "place", ref: "route/moraine-lake", kind: "lake" });
    expect(one("trip:moraine-lake")).toMatchObject({ space: "trip", ref: "trip/moraine-lake", kind: null });
  });

  it("refs with spaces and colons resolve (trip/<id>/sight:<name>)", () => {
    expect(one("trip/algonquin/sight:ragged falls")).toMatchObject({ state: "current", space: "place", slug: "ragged-falls" });
    expect(one("place:ragged-falls").ref).toBe("trip/algonquin/sight:ragged falls");
  });

  it("a retired slug of a merged record answers merged, not moved", () => {
    expect(one("place:louise-sightseeing-old")).toMatchObject({ state: "merged", slug: "lake-louise-gondola", ref: "sight/lake-louise-gondola" });
    expect(one("sight/lake-louise-sightseeing")).toMatchObject({ state: "merged", slug: "lake-louise-gondola" });
  });

  it("a withdrawn trip, by slug and by ref", () => {
    expect(one("trip:gone-trip")).toMatchObject({ state: "withdrawn", space: "trip", slug: "gone-trip", ref: null });
    expect(one("trip/gone")).toMatchObject({ state: "withdrawn", space: "trip", slug: "gone-trip", ref: null });
    expect(one("adventure/icewalks")).toMatchObject({ state: "withdrawn", space: "place", slug: "athabasca-icewalk" });
  });

  it("a handle in the wrong space is unknown", () => {
    expect(one("trip:johnston-canyon").state).toBe("unknown");
    expect(one("place:dolomites-2027").state).toBe("unknown");
  });

  it("answers carry the store revision and pass the privacy detector", () => {
    const r = resolveRefsResult(INDEX, light, { refs: ["place:moraine-lake", "trip:gone-trip", "place:hidden-place"] }, REVISION);
    expect(r.ok && r.revision).toBe(REVISION);
    expect(privacyHits(r)).toEqual([]);
  });

  it("a malformed body is invalid_input, never a throw", () => {
    for (const body of [null, {}, { refs: "place:x" }, { refs: [1] }, { refs: ["x".repeat(500)] }, { refs: ["place:x"], extra: 1 }]) {
      const r = resolveRefsResult(INDEX, light, body, REVISION);
      expect(r.ok, JSON.stringify(body)).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("invalid_input");
    }
  });
});

describe("the HTTP codec (GET /api/v1/resolve?ref=...)", () => {
  it("round-trips refs with spaces, colons and slashes, in order", () => {
    const q = { refs: ["place:moraine-lake", "trip/algonquin/sight:ragged falls", "trip:dolomites-2027"] };
    const s = resolveSearchOf(q);
    expect(resolveQueryOf(new URLSearchParams(s))).toEqual(q);
  });

  it("the sorted form is one cache key for the same set", () => {
    expect(resolveSearchOf({ refs: ["trip:b", "place:a"] }, { sorted: true })).toBe(resolveSearchOf({ refs: ["place:a", "trip:b"] }, { sorted: true }));
  });

  it("no ref parameter is an empty list, which the method answers invalid_input", () => {
    const r = resolveRefsResult(INDEX, light, resolveQueryOf(new URLSearchParams("")), REVISION);
    expect(!r.ok && r.error.code).toBe("invalid_input");
  });
});
