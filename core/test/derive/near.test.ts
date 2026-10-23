// META-2: the nearest town of a point (core/src/derive/near.ts): the nearest settlement of 1,000 people within 50 km, else `none_within_50km`.
// Pure rows in, an answer out; the committed towns layer is checked in core/test/derive/towns-data.test.ts.
import { describe, expect, it } from "vitest";
import { PLACEMENT_RULES } from "../../src/capture/placementBlock.ts";
import { deriveNearTown, nearestTown, roundKm, type NearTown } from "../../src/derive/near.ts";
import { haversineKm } from "../../src/geo/distance.ts";
import { NEAR_TOWN_NONE } from "../../src/schema/capture/points.ts";

const centre = { lat: 46.5, lon: 12.1 };
/** A town `km` due north of the centre. */
const north = (km: number, id: string, pop = 5000, geonamesId = 1): NearTown => ({ id, pop, geonamesId, lat: centre.lat + km / 111.19, lon: centre.lon });

describe("nearestTown", () => {
  it("takes the nearest town, not the largest", () => {
    const hit = nearestTown(centre, [north(30, "xx-00-big", 900_000), north(8, "xx-00-small", 1500), north(20, "xx-00-mid", 40_000)])!;
    expect(hit.town.id).toBe("xx-00-small");
    expect(hit.km).toBeCloseTo(8, 0);
  });
  it("ignores a settlement under the population floor", () => {
    expect(nearestTown(centre, [north(3, "xx-00-hamlet", PLACEMENT_RULES.townMinPopulation - 1)])).toBeNull();
    expect(nearestTown(centre, [north(3, "xx-00-village", PLACEMENT_RULES.townMinPopulation)])?.town.id).toBe("xx-00-village");
  });
  it("stops at the radius, using the unrounded distance", () => {
    const edge = north(PLACEMENT_RULES.townRadiusKm, "xx-00-edge");
    const d = haversineKm(centre, edge);
    expect(nearestTown(centre, [edge], d)?.town.id).toBe("xx-00-edge");
    expect(nearestTown(centre, [edge], d - 1e-9)).toBeNull();
  });
  it("breaks a tie by the larger town, then by the lower id, so two runs agree", () => {
    const a = { ...north(10, "xx-00-b", 2000) };
    const b = { ...north(10, "xx-00-a", 2000) };
    const c = { ...north(10, "xx-00-c", 9000) };
    expect(nearestTown(centre, [a, b])?.town.id).toBe("xx-00-a");
    expect(nearestTown(centre, [a, b, c])?.town.id).toBe("xx-00-c");
    expect(nearestTown(centre, [c, b, a])?.town.id).toBe("xx-00-c");
  });
});

describe("deriveNearTown", () => {
  it("gives the id, the km to one decimal and the GeoNames id", () => {
    const d = deriveNearTown(centre, [north(12.34, "xx-00-town", 3000, 777)]);
    expect(d).toEqual({ town: "xx-00-town", km: roundKm(haversineKm(centre, north(12.34, "x"))), geonamesId: 777 });
    expect(d.km).toBe(12.3);
  });
  it("answers none_within_50km, never a gap, when nothing is near", () => {
    expect(deriveNearTown(centre, [north(80, "xx-00-far")])).toEqual({ town: NEAR_TOWN_NONE, km: null, geonamesId: null });
    expect(deriveNearTown(centre, [])).toEqual({ town: NEAR_TOWN_NONE, km: null, geonamesId: null });
  });
  it("uses the rules the placement block states, in one place", () => {
    expect(PLACEMENT_RULES.townRadiusKm).toBe(50);
    expect(PLACEMENT_RULES.townMinPopulation).toBe(1000);
  });
});
