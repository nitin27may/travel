// Candidates and the score (TB-E1; trip-builder.md 4.3; FLOW stages 3 and 4, S9, QB9): the parts, the three lists, the order, the
// page and row caps, the near reach, a pick's strip, and the store reads behind them.
import { describe, expect, it } from "vitest";
import { BUILDER_SCAN } from "../../src/config/builder.ts";
import { durationBandOf, gatherCandidateRows, inRegion, interestsOf, placeFromRow, rankCandidates, type CandidateSource } from "../../src/plan/candidates.ts";
import { distancePoints, fitOf, profileOfBand, scorePlace, seasonOf, themePoints } from "../../src/plan/score.ts";
import type { PlaceRow } from "../../src/schema/api/place.ts";
import { planBuildInput, planCandidatePage, planCandidatesHttpQuery, planCandidatesQuery, type PlanCandidatesQuery } from "../../src/schema/api/plan.ts";
import { EMPTY_DRIVE, ONT, ageLimited, mkBuild, mkPlace, mkRow } from "./engine-fixture.ts";
import { StubStore } from "../../src/catalogue/stub/index.ts";
import { haversineKm } from "../../src/geo/distance.ts";

const near = (over: Partial<Extract<PlanCandidatesQuery, { mode: "near" }>> = {}): PlanCandidatesQuery => ({
  mode: "near",
  start: { kind: "hub", id: "toronto" },
  driveLimitMin: 240,
  ...over,
});
const trip = (over: Partial<Extract<PlanCandidatesQuery, { mode: "trip" }>> = {}): PlanCandidatesQuery => ({ mode: "trip", cc: "CA", regions: ["CA/ontario"], ...over });

const ROWS: PlaceRow[] = [
  mkRow("place/arrowhead", 45.3907, -79.2129, { badge: "Worth a detour" }),
  mkRow("place/oxtongue-lake", 45.3606, -78.9246),
  mkRow("place/high-falls", 45.0, -79.3, { badge: "Worth the journey", kind: "waterfall", tags: [{ id: "swim", label: "Swim", kind: "act" }] }),
  mkRow("place/zipline-park", 45.33, -79.1, { kids_from: 12, kids_basis: "rule", kind: "activity" }),
  mkRow("place/winter-rink", 45.32, -79.2, { season: [12, 1, 2] }),
  mkRow("place/parliament-hill", 45.4236, -75.7009),
  mkRow("place/no-point", null, null),
  mkRow("place/breadth-only", 45.39, -79.22, { researched: false }),
  mkRow("place/quebec-thing", 46.8, -71.2, { country: "CA", region: "quebec", regionAliases: ["quebec", "QC"] }),
];

describe("the score's parts (4.3)", () => {
  it("draw, fit, season, theme, distance and quality, integers summed", () => {
    const p = mkPlace("place/x", 45, -79, { draw: "journey", complete: true, tags: ["swim"], kind: "lake" });
    const s = scorePlace(p, { profile: profileOfBand("adults"), month: 7, interests: ["swim", "lake", "museum"], driveMin: 25 });
    expect(s.score).toEqual({ draw: 40, fit: 30, season: 20, theme: 20, distance: 10, quality: 5, total: 125 });
    expect(s.list).toBe("main");
  });
  it("a gap is never a yes: unknown fit and season score below a known pass", () => {
    const fam = profileOfBand("family-6");
    expect(fitOf({ suitability: null }, fam).state).toBe("unknown");
    expect(fitOf({ suitability: ageLimited(4) }, fam).state).toBe("pass");
    expect(fitOf({ suitability: ageLimited(12) }, fam)).toMatchObject({ state: "fail", why: "Needs age 12; youngest is 6" });
    expect(seasonOf({ season: [] }, 7).state).toBe("unknown");
    expect(seasonOf({ season: [6, 7] }, null).state).toBe("unknown");
    expect(seasonOf({ season: [8] }, 7).state).toBe("shoulder");
    expect(seasonOf({ season: [1] }, 12).state).toBe("shoulder");
    expect(seasonOf({ season: [1, 2] }, 7)).toEqual({ state: "closed", why: "Closed in July" });
  });
  it("bands and caps", () => {
    expect([distancePoints(null), distancePoints(10), distancePoints(45), distancePoints(90), distancePoints(200)]).toEqual([0, 10, 6, 3, 0]);
    expect(themePoints({ kind: "lake", type: null, tags: ["a", "b", "c"] }, ["a", "b", "c"])).toBe(20);
    expect([durationBandOf(null), durationBandOf(30), durationBandOf(90), durationBandOf(200), durationBandOf(300), durationBandOf(500)]).toEqual([null, "lt1h", "1to2h", "2to4h", "4to6h", "full_day"]);
    expect(interestsOf({ facets: { kind: ["lake"], tag: ["swim"], country: ["CA"] } })).toEqual(["lake", "swim"]);
  });
});

describe("rankCandidates", () => {
  const ctx = { centre: ONT.start, drive: EMPTY_DRIVE };

  it("near mode keeps the reach, splits the removed lists and parses as a page", () => {
    const r = rankCandidates(ROWS, near({ party: "family-6", month: 7 }), ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(planCandidatePage.safeParse(r.data).success).toBe(true);
    const refs = r.data.items.map((i) => i.ref);
    expect(refs).not.toContain("place/parliament-hill"); // beyond 4 h each way
    expect(refs).not.toContain("place/no-point");
    expect(refs).not.toContain("place/quebec-thing");
    expect(refs).not.toContain("place/zipline-park");
    expect(refs).not.toContain("place/winter-rink");
    expect(r.data.removed).toEqual({ not_for_party: 1, closed: 1 });
    // sorted by score, then name, then ref
    const totals = r.data.items.map((i) => i.score.total);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);
    expect(r.data.items[0]!.ref).toBe("place/high-falls");
    expect(r.data.items.every((i) => i.driveBasis === "estimate" && i.why === null)).toBe(true);
  });

  it("the removed lists carry their reason words", () => {
    const unfit = rankCandidates(ROWS, near({ party: "family-6", month: 7, list: "not_for_party" }), ctx);
    const closed = rankCandidates(ROWS, near({ party: "family-6", month: 7, list: "closed" }), ctx);
    expect(unfit.ok && unfit.data.items.map((i) => [i.ref, i.why])).toEqual([["place/zipline-park", "Needs age 12; youngest is 6"]]);
    expect(closed.ok && closed.data.items.map((i) => [i.ref, i.why])).toEqual([["place/winter-rink", "Closed in July"]]);
  });

  it("near regions narrow the reach", () => {
    const r = rankCandidates([...ROWS, mkRow("place/ny-thing", 43.1, -79.0, { country: "US", region: "new-york", regionAliases: ["NY"] })], near({ regions: ["US/NY"], driveLimitMin: 480 }), ctx);
    expect(r.ok && r.data.items.map((i) => i.ref)).toEqual(["place/ny-thing"]);
  });

  it("trip mode lists one country's regions, measured from their centroid", () => {
    const r = rankCandidates(ROWS, trip(), { centre: null, drive: EMPTY_DRIVE });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const refs = r.data.items.map((i) => i.ref);
    expect(refs).toContain("place/parliament-hill");
    expect(refs).not.toContain("place/quebec-thing");
    expect(r.data.items.find((i) => i.ref === "place/no-point")).toMatchObject({ driveMin: null, driveBasis: null });
  });

  it("a pick's strip: around the pick, at most `limit` rows, never the pick itself or a breadth-only record (QB9)", () => {
    const r = rankCandidates(ROWS, near({ near: "arrowhead", limit: 2, month: 7 }), { centre: null, drive: EMPTY_DRIVE });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.items).toHaveLength(2);
    expect(r.data.total).toBe(2);
    expect(r.data.nextPage).toBeNull();
    const refs = r.data.items.map((i) => i.ref);
    expect(refs).not.toContain("place/arrowhead");
    expect(refs).not.toContain("place/breadth-only");
  });

  it("pages of 40; a larger page is too_large with the cap", () => {
    const many = Array.from({ length: 45 }, (_, i) => mkRow(`place/m${String(i).padStart(2, "0")}`, 45 + i * 0.001, -79.2));
    const p1 = rankCandidates(many, trip(), ctx);
    expect(p1.ok && [p1.data.items.length, p1.data.nextPage, p1.data.total]).toEqual([40, 2, 45]);
    const p2 = rankCandidates(many, trip({ page: 2 }), ctx);
    expect(p2.ok && [p2.data.items.length, p2.data.nextPage]).toEqual([5, null]);
    expect(rankCandidates(many, trip({ pageSize: 41 }), ctx)).toMatchObject({ ok: false, code: "too_large", max: 40 });
  });

  it("is deterministic and dedupes rows", () => {
    const a = rankCandidates([...ROWS, ...ROWS], near({ month: 7 }), ctx);
    const b = rankCandidates([...ROWS].reverse(), near({ month: 7 }), ctx);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("a row maps onto an engine place: approx points are no points, badges are tiers", () => {
    expect(placeFromRow(mkRow("place/a", 45, -79, { approx: true })).point).toBeNull();
    expect(placeFromRow(mkRow("place/a", 45, -79, { badge: "Local favourite" })).draw).toBe("local");
    expect(placeFromRow(mkRow("place/a", 45, -79, { kids_from: 8, kids_basis: "advice" })).suitability).toMatchObject({ minAge: 8, rule: "advice" });
    expect(inRegion(ROWS[0]!, "CA/ON")).toBe(true);
    expect(inRegion(ROWS[0]!, "CA/quebec")).toBe(false);
    expect(inRegion(ROWS[0]!, "ca-east")).toBe(true);
  });
});

describe("the TB-C2 contract keys", () => {
  it("near regions, a pick's strip and a row limit parse; a limit above 40 does not", () => {
    expect(planCandidatesQuery.safeParse(near({ regions: ["CA/ON"] })).success).toBe(true);
    expect(planCandidatesQuery.safeParse(near({ regions: [] })).success).toBe(false);
    expect(planCandidatesQuery.safeParse(near({ near: "arrowhead", limit: 6 })).success).toBe(true);
    expect(planCandidatesQuery.safeParse(near({ limit: 41 })).success).toBe(false);
    expect(planCandidatesQuery.safeParse(near({ near: "Not A Slug" })).success).toBe(false);
    expect(planCandidatesHttpQuery.safeParse({ m: "near", from: "hub:toronto", r: "180", near: "arrowhead", limit: "6" }).success).toBe(true);
  });
  it("the build body carries the draft's driveDayMin (60 to 480, steps of 15), or none", () => {
    expect(planBuildInput.safeParse(mkBuild(["place/a"])).success).toBe(true);
    expect(planBuildInput.safeParse(mkBuild(["place/a"], { driveDayMin: 180 })).success).toBe(true);
    expect(planBuildInput.safeParse(mkBuild(["place/a"], { driveDayMin: 185 })).success).toBe(false);
    expect(planBuildInput.safeParse(mkBuild(["place/a"], { driveDayMin: 30 })).success).toBe(false);
  });
});

describe("gatherCandidateRows reads the store, bounded", () => {
  function fakeSource(rows: PlaceRow[]): CandidateSource & { calls: unknown[] } {
    const calls: unknown[] = [];
    const page = <T>(xs: T[], p: { page?: number; pageSize?: number } = {}) => {
      const size = p.pageSize ?? 48;
      const n = p.page ?? 1;
      const items = xs.slice((n - 1) * size, n * size);
      return { items, total: xs.length, page: n, pageSize: size, nextPage: n * size < xs.length ? n + 1 : null };
    };
    return {
      calls,
      listPlaces: async (q, p) => {
        calls.push({ m: "listPlaces", q, p });
        return { ok: true, data: page(rows, p), revision: "r1" };
      },
      near: async (q, p) => {
        calls.push({ m: "near", q, p });
        const items = rows.map((r) => ({ ...r, distanceKm: 1, bearing: "N" as const, band: "lt15" as const, basis: "estimate" as const, minutes: null }));
        return { ok: true, data: { ...page(items, p), centre: { kind: "place" as const, key: "place:x", name: "x", lat: 0, lon: 0 }, r: 100, clamped: false, basis: { distance: "straight_line" as const, excludedApprox: 0 } }, revision: "r1" };
      },
    };
  }

  it("trip mode: one country and its region slugs, every page", async () => {
    const rows = Array.from({ length: 230 }, (_, i) => mkRow(`place/r${i}`, 45, -79));
    const src = fakeSource(rows);
    const r = await gatherCandidateRows(src, trip(), { centre: null });
    expect(r.ok && r.data.length).toBe(230);
    expect(src.calls).toHaveLength(3);
    expect(src.calls[0]).toMatchObject({ m: "listPlaces", q: { facets: { country: ["CA"], region: ["ontario"] } }, p: { pageSize: BUILDER_SCAN.pageSize } });
  });

  it("near mode: a box around the start; a pick's strip: the near API with a clamped radius and no extra keys on the rows", async () => {
    const src = fakeSource(ROWS);
    await gatherCandidateRows(src, near(), { centre: ONT.start });
    expect((src.calls[0] as { q: { bbox: number[] } }).q.bbox).toHaveLength(4);
    const strip = await gatherCandidateRows(src, near({ near: "arrowhead" }), { centre: null, nearKm: 500 });
    expect(src.calls[1]).toMatchObject({ m: "near", q: { near: "place:arrowhead", r: 100 } });
    expect(strip.ok && Object.keys(strip.data[0]!)).not.toContain("distanceKm");
  });

  it("a pick's strip over a real near (StubStore, N2): every row within the clamped radius, nearest first, rows only", async () => {
    const store = new StubStore();
    const centre = await store.near({ near: "place:glacier-lake", r: 1 });
    expect(centre.ok).toBe(true);
    if (!centre.ok || centre.data.centre.lat === null || centre.data.centre.lon === null) return;
    const at = { lat: centre.data.centre.lat, lon: centre.data.centre.lon };
    const r = await gatherCandidateRows(store, near({ near: "glacier-lake" }), { centre: null, nearKm: 500 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.length).toBeGreaterThan(0);
    const kms = r.data.map((row) => haversineKm(at, { lat: row.lat!, lon: row.lon! }));
    for (const km of kms) expect(km).toBeLessThanOrEqual(100);
    expect(kms).toEqual([...kms].sort((a, b) => a - b));
    expect(Object.keys(r.data[0]!)).not.toContain("distanceKm");
    // the store answers not_found for a pick that is not there, and the gathering passes it through
    const gone = await gatherCandidateRows(store, near({ near: "no-such-place" }), { centre: null });
    expect(!gone.ok && gone.error.code).toBe("not_found");
  });

  it("stops at BUILDER_SCAN.maxRows", async () => {
    const rows = Array.from({ length: BUILDER_SCAN.maxRows + 250 }, (_, i) => mkRow(`place/z${i}`, 45, -79));
    const r = await gatherCandidateRows(fakeSource(rows), trip(), { centre: null });
    expect(r.ok && r.data.length).toBe(BUILDER_SCAN.maxRows);
  });
});
