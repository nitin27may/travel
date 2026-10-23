// Trip legs (D-E5, store.ts A34): K27. One trip's routed legs, keyed by its detail's own stop keys, every coordinate through the detector.
import { expect } from "vitest";
import { API_LIMITS, decodePolyline5, encodePolyline5, tripLegsLookup, type TripDetail } from "../../../src/schema/api/index.ts";
import { expectError, expectOk, householdHits, type ContractCase } from "./kit.ts";

/** Every stop key a leg may name (legs.ts legStopKey): day and track item ids, and `base:<id>`. */
function stopKeys(d: TripDetail): Set<string> {
  const keys = new Set<string>(d.bases.map((b) => `base:${b.id}`));
  for (const day of d.days) {
    for (const item of day.items) keys.add(item.id);
    for (const track of day.tracks ?? []) for (const item of track.items) keys.add(item.id);
  }
  return keys;
}

export const tripLegsCases: ContractCase[] = [
  {
    id: "K27",
    title: "tripLegs answers per trip with stop keys of its detail and decodable lines, not_found for an unknown or unlisted trip, moved for a retired slug",
    method: "tripLegs",
    async run(store, t) {
      const slugs = [...new Set([t.facts.tripSlug, ...(t.facts.legs ? [t.facts.legs.trip] : [])])];
      for (const slug of slugs) {
        const got = expectOk(await store.tripLegs(slug), `tripLegs ${slug}`);
        expect(tripLegsLookup.safeParse(got).success, slug).toBe(true);
        if ("moved" in got) throw new Error(`${slug} answered moved`);
        expect(got.slug).toBe(slug);
        expect(got.ref).toBe(`trip/${slug}`);
        expect(got.legs.length).toBeLessThanOrEqual(API_LIMITS.tripLegs.max);
        const detail = expectOk(await store.getTrip(slug));
        if ("moved" in detail) throw new Error(`${slug} detail moved`);
        const keys = stopKeys(detail);
        const days = new Set(detail.days.map((d) => d.n));
        for (const leg of got.legs) {
          expect(keys.has(leg.from), `${slug} leg from ${leg.from}`).toBe(true);
          expect(keys.has(leg.to), `${slug} leg to ${leg.to}`).toBe(true);
          expect(days.has(leg.day), `${slug} leg day ${leg.day}`).toBe(true);
          if (leg.geometry !== null) expect(decodePolyline5(leg.geometry)?.length ?? 0, `${slug} geometry decodes`).toBeGreaterThanOrEqual(2);
        }
        if (t.facts.legs?.trip === slug) {
          expect(got.legs.length, `${slug} has routed legs`).toBeGreaterThan(0);
          expect(got.fetched).not.toBeNull();
          expect(got.attribution.length).toBeGreaterThan(0);
          if (t.facts.legs.geometry) expect(got.legs.some((l) => l.geometry !== null), `${slug} has geometry`).toBe(true);
        }
        // every coordinate, decoded, passes the detector (A39)
        expect(householdHits(got, `tripLegs ${slug}`)).toEqual([]);
      }
      expectError(await store.tripLegs("no-such-trip-anywhere"), "not_found");
      if (t.facts.unlistedTrip) expectError(await store.tripLegs(t.facts.unlistedTrip), "not_found");
      if (t.facts.tripRetired) expect(expectOk(await store.tripLegs(t.facts.tripRetired.from))).toMatchObject({ moved: t.facts.tripRetired.to });
    },
  },
  {
    id: "K27.input",
    title: "a malformed trip slug is invalid_input",
    method: "tripLegs",
    async run(store) {
      expectError(await store.tripLegs("Bad Slug!"), "invalid_input");
    },
  },
  {
    id: "K27.polyline",
    title: "the precision-5 polyline round-trips [lon, lat] to 1e-5 degrees, and the detector reads a line that passes near home",
    method: "all",
    async run() {
      const line: [number, number][] = [[-116.1858, 51.3271], [-116.186, 51.3217], [11.626, 46.541], [-19.0060, 63.4186]];
      const back = decodePolyline5(encodePolyline5(line))!;
      expect(back.length).toBe(line.length);
      for (let i = 0; i < line.length; i++) for (const k of [0, 1]) expect(Math.abs(back[i]![k]! - line[i]![k]!)).toBeLessThan(1e-5);
      // Google's own example, lat then lon in the encoding
      expect(encodePolyline5([[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]])).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
      expect(decodePolyline5("_p~iF~ps|U_ulLnn")).toBeNull();
      const { northOfHome } = await import("../../privacy/probe.ts");
      const near = northOfHome(0.5);
      expect(householdHits({ legs: [{ geometry: encodePolyline5([[-116.1, 51.3], [near.lon, near.lat]]) }] }, "probe").length).toBe(1);
      expect(householdHits({ legs: [{ geometry: encodePolyline5(line) }] }, "probe")).toEqual([]);
    },
  },
];
