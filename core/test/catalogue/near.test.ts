// Near (N2, store.ts A41; core/src/catalogue/near.ts): the ranking rule every store shares (order, the radius edge, the antimeridian,
// the poles, approximate rows, determinism), the point centre (rounding, refusal of a finer point, no echo) and the StubStore's answer
// (kind filter, paging with the true total). The JsonStore on the real data is web/tests/api/near.test.ts.
import { describe, expect, it } from "vitest";
import { DRIVE_BAND_EDGES_MIN, NEAR_POINT_DECIMALS, WALK_KM, nearCellSlackKm, toNearCell } from "../../src/config/nearby.ts";
import { indexDriveData } from "../../src/drive/model.ts";
import { haversineKm } from "../../src/geo/distance.ts";
import { POINT_CENTRE, bandOfMinutes, driveBander, nearRadius, pointOfToken, rankNear } from "../../src/catalogue/near.ts";
import { StubStore } from "../../src/catalogue/stub/index.ts";
import { API_LIMITS, nearPage, nearQuery, type PlaceRow } from "../../src/schema/api/index.ts";
import { mkRow } from "../plan/engine-fixture.ts";

const KM_PER_DEG_LAT = haversineKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
const north = (from: { lat: number; lon: number }, km: number) => ({ lat: from.lat + km / KM_PER_DEG_LAT, lon: from.lon });
const C = { lat: 51.18, lon: -115.57 };
const row = (slug: string, p: { lat: number; lon: number } | null, over: Partial<PlaceRow> = {}): PlaceRow => mkRow(`place/${slug}`, p?.lat ?? null, p?.lon ?? null, over);

describe("rankNear: the shared rule", () => {
  it("orders by rounded distance, then name, then ref, and carries only the near keys", () => {
    const rows = [row("b-far", north(C, 9)), row("zeta", north(C, 3)), row("alpha", north(C, 3)), row("walk", north(C, 0.5))];
    const got = rankNear(rows, C, 10);
    expect(got.rows.map((r) => r.slug)).toEqual(["walk", "alpha", "zeta", "b-far"]);
    expect(got.rows[0]).toMatchObject({ distanceKm: 0.5, bearing: "N", band: "walk", basis: "estimate", minutes: null });
    expect(Object.keys(got.rows[0]!).sort()).toEqual([...Object.keys(rows[0]!), "distanceKm", "bearing", "band", "basis", "minutes"].sort());
  });

  it("includes on the unrounded km: a row a hair over r is out even when it rounds to r", () => {
    const at = row("at-edge", north(C, 10 - 1e-6));
    const over = row("over-edge", north(C, 10 + 0.01));
    const got = rankNear([at, over], C, 10);
    expect(got.rows.map((r) => r.slug)).toEqual(["at-edge"]);
    expect(rankNear([over], C, 10.02).rows.map((r) => r.distanceKm)).toEqual([10]);
  });

  it("measures across the antimeridian", () => {
    const fiji = { lat: -17, lon: 179.95 };
    const got = rankNear([row("east", { lat: -17, lon: -179.95 }), row("west", { lat: -17, lon: 179.7 })], fiji, 50);
    expect(got.rows.map((r) => r.slug)).toEqual(["east", "west"]);
    expect(got.rows[0]!.bearing).toBe("E");
    expect(got.rows[0]!.distanceKm).toBeCloseTo(10.6, 0);
  });

  it("answers at a pole without a NaN", () => {
    const pole = { lat: 90, lon: 0 };
    const got = rankNear([row("near-pole", { lat: 89.9, lon: 120 })], pole, 50);
    expect(got.rows).toHaveLength(1);
    expect(Number.isFinite(got.rows[0]!.distanceKm)).toBe(true);
    // every direction is south from the pole; the 8-wind bearing is still one of the eight, never undefined
    expect(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]).toContain(got.rows[0]!.bearing);
  });

  it("leaves out approximate rows and counts them whatever their distance (A13); rows with no point are skipped", () => {
    const got = rankNear([row("ok", north(C, 1)), row("approx-far", north(C, 900), { approx: true }), row("approx-near", north(C, 1), { approx: true }), row("none", null)], C, 25);
    expect(got.rows.map((r) => r.slug)).toEqual(["ok"]);
    expect(got.excludedApprox).toBe(2);
  });

  it("is deterministic: any input order gives the same answer", () => {
    const rows = Array.from({ length: 60 }, (_, i) => row(`p${String(i).padStart(2, "0")}`, north(C, (i % 7) * 1.3)));
    const a = rankNear(rows, C, 25);
    const b = rankNear([...rows].reverse(), C, 25);
    const shuffled = [...rows].sort((x, y) => ((x.slug.charCodeAt(2) * 31) % 7) - ((y.slug.charCodeAt(2) * 31) % 7));
    expect(b).toEqual(a);
    expect(rankNear(shuffled, C, 25)).toEqual(a);
  });

  it("bands by the drive model's minutes on the timeline's edges; a walk is a walk", () => {
    const [a, b, c] = DRIVE_BAND_EDGES_MIN;
    expect([bandOfMinutes(WALK_KM / 2, 99), bandOfMinutes(5, a - 1), bandOfMinutes(5, a), bandOfMinutes(5, b), bandOfMinutes(5, c), bandOfMinutes(5, null)]).toEqual(["walk", "lt15", "15-30", "30-60", "60-120", null]);
    const drive = indexDriveData({ profiles: [], areas: [], crossings: [], segments: [], calibration: null });
    const got = rankNear([row("w", north(C, 0.4)), row("d", north(C, 40)), row("f", north(C, 95))], C, 100, driveBander(drive, "CA"));
    expect(got.rows.map((r) => r.band)).toEqual(["walk", expect.stringMatching(/^(15-30|30-60)$/), expect.stringMatching(/^(30-60|60-120)$/)]);
    for (const r of got.rows) expect(r.minutes).toBeNull();
  });

  it("the radius: the default by centre kind, clamped above the cap", () => {
    expect(nearRadius(undefined, "place")).toEqual({ r: API_LIMITS.nearRadius.default, clamped: false });
    expect(nearRadius(undefined, "point")).toEqual({ r: API_LIMITS.nearRadius.default, clamped: false });
    expect(nearRadius(undefined, "area")).toEqual({ r: API_LIMITS.nearRadius.areaDefault, clamped: false });
    expect(nearRadius(500, "town")).toEqual({ r: API_LIMITS.nearRadius.max, clamped: true });
  });
});

describe("the point centre (A41)", () => {
  it("reads two decimals at most and refuses anything else", () => {
    expect(NEAR_POINT_DECIMALS).toBe(2);
    expect(pointOfToken("point:51.18,-115.57")).toEqual({ lat: 51.18, lon: -115.57 });
    expect(pointOfToken("point:-0.5,179")).toEqual({ lat: -0.5, lon: 179 });
    for (const bad of ["point:51.183,-115.57", "point:91,0", "point:0,181", "point:+51,0", "point:1e1,0", "point:51,", "place:x"]) expect(pointOfToken(bad), bad).toBeNull();
    expect(nearQuery.safeParse({ near: "point:51.18,-115.57" }).success).toBe(true);
    for (const bad of ["point:51.183,-115.57", "point:90.5,0", "point:0,-180.5", "point:51.18;-115.57"]) expect(nearQuery.safeParse({ near: bad }).success, bad).toBe(false);
    expect(nearQuery.safeParse({ near: "point:90,180" }).success).toBe(true);
  });

  it("the client's rounding is the cell the server accepts, and the slack bounds the cell's error", () => {
    expect(`point:${toNearCell(51.182345)},${toNearCell(-115.571234)}`).toBe("point:51.18,-115.57");
    expect(toNearCell(-0.001)).toBe(0);
    expect(pointOfToken(`point:${toNearCell(-0.001)},${toNearCell(12.999)}`)).toEqual({ lat: 0, lon: 13 });
    const slack = nearCellSlackKm();
    expect(slack).toBeGreaterThan(0.7);
    expect(slack).toBeLessThan(0.8);
    // any point inside a cell is within the slack of the cell's centre
    for (const p of [{ lat: 51.184999, lon: -115.565001 }, { lat: 0.004999, lon: 0.004999 }]) {
      const cell = { lat: toNearCell(p.lat), lon: toNearCell(p.lon) };
      expect(haversineKm(p, cell)).toBeLessThanOrEqual(slack);
    }
  });

  it("the StubStore measures from the cell and never echoes it", async () => {
    const store = new StubStore();
    const got = await store.near({ near: "point:51.32,-116.19", r: 5 });
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(nearPage.safeParse(got.data).success).toBe(true);
    expect(got.data.centre).toEqual(POINT_CENTRE);
    expect(got.data.items[0]!.slug).toBe("glacier-lake");
    const text = JSON.stringify(got.data);
    expect(text).not.toContain("point:");
    expect(text).not.toMatch(/:51\.32[,}]|:-116\.19[,}]/);
  });
});

describe("StubStore.near: filters and paging", () => {
  const store = new StubStore();
  it("keeps the kind filter and pages with the true total", async () => {
    const all = await store.near({ near: "place:glacier-lake", r: 100 }, { pageSize: 100 });
    const lakes = await store.near({ near: "place:glacier-lake", r: 100, facets: { kind: ["lake"] } }, { pageSize: 100 });
    expect(all.ok && lakes.ok).toBe(true);
    if (!all.ok || !lakes.ok) return;
    expect(lakes.data.items.length).toBeGreaterThan(0);
    expect(lakes.data.items.every((r) => r.kind === "lake")).toBe(true);
    expect(lakes.data.total).toBeLessThan(all.data.total);
    const pages: string[] = [];
    for (let n: number | null = 1; n !== null; ) {
      const p = await store.near({ near: "place:glacier-lake", r: 100 }, { page: n, pageSize: 2 });
      if (!p.ok) throw new Error(p.error.message);
      expect(p.data.total).toBe(all.data.total);
      pages.push(...p.data.items.map((r) => r.slug));
      n = p.data.nextPage;
    }
    expect(pages).toEqual(all.data.items.map((r) => r.slug));
    const past = await store.near({ near: "place:glacier-lake", r: 100 }, { page: 99, pageSize: 2 });
    expect(past.ok && past.data.items).toEqual([]);
    expect(past.ok && past.data.total).toBe(all.data.total);
  });
});
