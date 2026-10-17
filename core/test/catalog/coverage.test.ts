import { describe, expect, it } from "vitest";
import { loadCatalog, loadDeps } from "../../src/catalog/common.ts";
import { PROVISIONAL_TARGETS, bandOf, computeCoverage, coverageText, rowWeight } from "../../src/catalog/coverage.ts";
import { coverageFor } from "../../src/catalog/reports.ts";
import { SRC, row, seed } from "./seed.ts";
import { newStore } from "./util.ts";

const A = "AR/santa-cruz/el-chalten";
const U = "AR/tierra-del-fuego/ushuaia";
const stale = { min_age: 8, field_meta: { min_age: { kind: "operator", read: "2025-01-01", src: ["src-0001"] } } };

async function fixture() {
  const store = newStore();
  await seed(store, [
    // trails: 3 verified fresh (3.0) + 2 proposed (0.6) + 1 retired (0) = 3.6 of 6
    ...["a", "b", "c"].map((n) => ({ entity: "trails" as const, row: row("trails", `${A}/t-${n}`, A) })),
    ...["d", "e"].map((n) => ({ entity: "trails" as const, row: row("trails", `${A}/t-${n}`, A, { review_status: "proposed" }) })),
    { entity: "trails" as const, row: row("trails", `${A}/t-gone`, A, { review_status: "retired" }) },
    // stays: verified fresh (1) + verified but a stale hard limit (0.5) + proposed (0.3) = 1.8 of 3
    { entity: "stays" as const, row: row("stays", `${A}/s-1`, A, { min_age: 6, field_meta: { min_age: { kind: "operator", read: "2026-09-01", src: ["src-0001"] } } }) },
    { entity: "stays" as const, row: row("stays", `${A}/s-2`, A, stale) },
    { entity: "stays" as const, row: row("stays", `${A}/s-3`, A, { review_status: "proposed" }) },
    // activities: two have an offer: verified (1) + proposed (0.3) = 1.3 of 4; a third has none and does not count
    { entity: "activities" as const, row: row("activities", `${A}/a-1`, A) },
    { entity: "activities" as const, row: row("activities", `${A}/a-2`, A, { review_status: "proposed" }) },
    { entity: "activities" as const, row: row("activities", `${A}/a-3`, A) },
    { entity: "offers" as const, row: row("offers", "of-p-one", A, { subject_id: `${A}/a-1` }) },
    { entity: "offers" as const, row: row("offers", "of-p-two", A, { subject_id: `${A}/a-2` }) },
    // legs: 3 of the 6 (2 sights x 3 live stays) pairs covered
    ...["s-1", "s-2", "s-3"].map((s) => ({ entity: "legs" as const, row: { ...row("legs", "x", A), id: "x", from_id: "AR/santa-cruz/el-chalten/mirador-de-los-condores", to_id: `${A}/${s}`, mode: "walk", basis: "estimate", area_id: undefined } })),
    // guide
    { entity: "area_guides" as const, row: { ...row("area_guides", A, A), area_id: undefined } },
  ].map((x) => (x.entity === "legs" ? { ...x, row: fixLeg(x.row) } : x)));
  return store;
}

import { legId } from "../../src/catalog/common.ts";
function fixLeg(r: any) {
  const { area_id: _a, name: _n, ...rest } = r;
  return { ...rest, id: legId(r.from_id, r.to_id, r.mode) };
}

describe("coverage", () => {
  it("scores the known fixture type by type (plan 0A.3)", async () => {
    const cov = await coverageFor(await fixture(), "2026-10-17");
    const a = cov.areas.find((x) => x.area_id === A && x.level === "area")!;
    expect(a.types.sights).toMatchObject({ count: 2, weighted: 0.6, target: 8, score: 0.075 });
    expect(a.types.trails).toMatchObject({ count: 5, weighted: 3.6, score: 0.6 });
    expect(a.types.activities).toMatchObject({ count: 2, weighted: 1.3, score: 0.325 });
    expect(a.types.stays).toMatchObject({ count: 3, weighted: 1.8, score: 0.6 });
    expect(a.types.eateries).toMatchObject({ count: 0, score: 0 });
    expect(a.types.legs).toMatchObject({ count: 3, weighted: 0.5, score: 0.5 });
    expect(a.types.guide).toMatchObject({ count: 1, weighted: 1, score: 1 });
    // 0.25*0.075 + 0.20*0.6 + 0.15*0.325 + 0.15*0.6 + 0.05*0 + 0.10*0.5 + 0.10*1 = 0.4275
    expect(a.total).toBeCloseTo(0.428, 5);
    expect(a.band).toBe("usable");
  });

  it("a stale verified row counts half, a proposed row 0.3, a retired row nothing", () => {
    expect(rowWeight({ review_status: "verified" }, false)).toBe(1);
    expect(rowWeight({ review_status: "verified" }, true)).toBe(0.5);
    expect(rowWeight({ review_status: "proposed" }, false)).toBe(0.3);
    expect(rowWeight({ review_status: "raw" }, false)).toBe(0.3);
    expect(rowWeight({ review_status: "retired" }, false)).toBe(0);
    expect(rowWeight({ review_status: "stale", field_meta: { stale: { was: "proposed" } } }, false)).toBe(0.3);
    expect(rowWeight({ review_status: "stale", field_meta: { stale: { was: "verified" } } }, false)).toBe(0.5);
  });

  it("bands: thin under 0.4, usable 0.4 to 0.7, good from 0.7", () => {
    expect([0, 0.399, 0.4, 0.699, 0.7, 1].map((v) => bandOf(v))).toEqual(["thin", "thin", "usable", "usable", "good", "good"]);
  });

  it("the style view re-weights the same scores: adventure counts trails and activities more", async () => {
    const cov = await coverageFor(await fixture(), "2026-10-17");
    const a = cov.areas.find((x) => x.area_id === A && x.level === "area")!;
    // 0.10*0.075 + 0.35*0.6 + 0.30*0.325 + 0.10*0.6 + 0 + 0.07*0.5 + 0.05*1 = 0.46
    expect(a.by_style.adventure!.total).toBeCloseTo(0.46, 5);
    expect(a.by_style["luxury-relax"]!.total).not.toBe(a.by_style.adventure!.total);
  });

  it("rolls up to region and country: counts add, scores average over the areas", async () => {
    const cov = await coverageFor(await fixture(), "2026-10-17");
    const region = cov.areas.find((x) => x.area_id === "AR/santa-cruz" && x.level === "region")!;
    expect(region.types.trails.count).toBe(5);
    expect(region.total).toBeCloseTo(0.428, 5);
    const country = cov.areas.find((x) => x.area_id === "AR" && x.level === "country")!;
    expect(country.areas).toBe(2);
    expect(country.types.trails.count).toBe(5);
    expect(country.types.trails.score).toBeCloseTo(0.3, 3);
    expect(country.total).toBeCloseTo(0.214, 5);
    const ushuaia = cov.areas.find((x) => x.area_id === U && x.level === "area")!;
    expect(ushuaia.total).toBe(0);
    expect(ushuaia.band).toBe("thin");
  });

  it("is deterministic for a date and sorted: the same inputs give the same bytes", async () => {
    const s = await fixture();
    const a = coverageText(await coverageFor(s, "2026-10-17"));
    expect(coverageText(await coverageFor(s, "2026-10-17"))).toBe(a);
    const ids = JSON.parse(a).areas.map((x: any) => `${x.level}:${x.area_id}`);
    expect(ids).toEqual([...ids].sort((x, y) => ["country", "region", "area"].indexOf(x.split(":")[0]) - ["country", "region", "area"].indexOf(y.split(":")[0]) || x.localeCompare(y)));
    // a later date turns the stale limit into more stale rows and the same row into less coverage
    const later = (await coverageFor(s, "2027-10-17")).areas.find((x) => x.area_id === A && x.level === "area")!;
    expect(later.types.stays.weighted).toBe(1.3);
    expect(later.total).toBeLessThan(0.428);
  });

  it("the targets live in one exported object whose weights sum to 1", () => {
    const w = Object.values(PROVISIONAL_TARGETS.types).reduce((n, t) => n + t.weight, 0);
    expect(w).toBeCloseTo(1, 10);
    for (const [style, weights] of Object.entries(PROVISIONAL_TARGETS.styles)) expect(Object.values(weights).reduce((n, v) => n + v, 0), style).toBeCloseTo(1, 10);
    expect(PROVISIONAL_TARGETS.types.sights).toEqual({ target: 8, weight: 0.25 });
  });

  it("calibration changes one place: another target moves the score", async () => {
    const s = await fixture();
    const data = await loadCatalog(s);
    const inp = { data, deps: await loadDeps(s), locations: { areas: [{ id: A, name: "x" }], places: [] } as any, placeRows: [], today: "2026-10-17" };
    const base = computeCoverage(inp).areas.find((x) => x.area_id === A)!;
    const t = { ...PROVISIONAL_TARGETS, types: { ...PROVISIONAL_TARGETS.types, trails: { target: 3, weight: 0.2 } } };
    const calibrated = computeCoverage(inp, t).areas.find((x) => x.area_id === A)!;
    expect(calibrated.types.trails.score).toBe(1);
    expect(calibrated.total).toBeGreaterThan(base.total);
  });
});
