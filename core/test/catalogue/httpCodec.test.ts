import { describe, expect, it } from "vitest";
import { fromSearchParams, toSearchParams } from "../../src/catalogue/httpCodec.ts";

const p = (s: string) => new URLSearchParams(s);

describe("the URL codec (R-5)", () => {
  it("decodes a list URL as decodeState does: comma lists, upper-case country, sort with dir, f.<facet>, bbox, ids, paging", () => {
    const got = fromSearchParams("listPlaces", p("q=lake&country=ca&region=CA-AB,alberta&k=water.body&f.swim=yes&sort=km&dir=desc&bbox=-116,50,-114,52&ids=a,b&page=2&pageSize=24&view=map&group=kind"));
    expect(got).toEqual({
      ok: true,
      args: {
        method: "listPlaces",
        q: { q: "lake", facets: { country: ["CA"], region: ["CA-AB", "alberta"], k: ["water.body"], "f.swim": ["yes"] }, sort: ["-km"], bbox: [-116, 50, -114, 52], ids: ["a", "b"] },
        page: { page: 2, pageSize: 24 },
      },
    });
  });
  it("refuses an unknown key, a repeated key, a bad number, a bad bbox and an unknown sort key, all as invalid_input", () => {
    for (const q of ["bogus=1", "country=CA&country=IT", "page=0", "pageSize=abc", "bbox=1,2,3", "sort=password"]) {
      const r = fromSearchParams("listPlaces", p(q));
      expect(r.ok, q).toBe(false);
      if (!r.ok) expect(r.error.code, q).toBe("invalid_input");
    }
  });
  it("lets an oversized page reach the store, so its 413 stays the store's (A1)", () => {
    expect(fromSearchParams("listPlaces", p("pageSize=500")).ok).toBe(true);
  });
  it("round-trips a list query through toSearchParams", () => {
    const q = { q: "falls", facets: { country: ["IS"], "f.swim": ["yes"] }, sort: ["-km"], ids: ["x"] };
    const got = fromSearchParams("listPlaces", toSearchParams(q, { page: 3 }));
    expect(got).toEqual({ ok: true, args: { method: "listPlaces", q, page: { page: 3 } } });
  });
  it("near, trips, search, parse, towns, a trip and an export", () => {
    expect(fromSearchParams("near", p("near=place:glacier-lake&r=500&country=CA"))).toMatchObject({ ok: true, args: { q: { near: "place:glacier-lake", r: 500, facets: { country: ["CA"] } } } });
    expect(fromSearchParams("near", p("city=ca-ab-canmore"))).toMatchObject({ ok: true, args: { q: { city: "ca-ab-canmore" } } });
    expect(fromSearchParams("listTrips", p("sort=nights"))).toMatchObject({ ok: true, args: { q: { sort: ["nights"] } } });
    expect(fromSearchParams("listTrips", p("sort=km")).ok).toBe(false);
    expect(fromSearchParams("search", p("q=lake&kind=place&country=CA&limit=5"))).toEqual({ ok: true, args: { method: "search", q: { q: "lake", scope: { kind: "place", country: "ca" }, limit: 5 } } });
    expect(fromSearchParams("parse", p("q=lakes&dropped=k,where"))).toEqual({ ok: true, args: { method: "parse", q: { q: "lakes", dropped: ["k", "where"] } } });
    expect(fromSearchParams("towns", p("prefix=can&cc=CA&region=AB"))).toEqual({ ok: true, args: { method: "towns", q: { prefix: "can", cc: "CA", region: "AB" } } });
    expect(fromSearchParams("getTrip", p("p=family-6&split=1"), { slug: "alps-week" })).toEqual({ ok: true, args: { method: "getTrip", slug: "alps-week", profile: { p: "family-6", split: "1" } } });
    expect(fromSearchParams("getExport", p("format=gpx&p=adults"), { type: "trip", slug: "alps-week" })).toEqual({ ok: true, args: { method: "getExport", q: { type: "trip", slug: "alps-week", format: "gpx", profile: { p: "adults" } } } });
    expect(fromSearchParams("getExport", p("format=gpx"), { type: "trip", slug: "a,b" }).ok).toBe(false);
  });
});
