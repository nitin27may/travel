// K7: no household string and no private key in any output of any method. The web runner adds the 2 km home-point check and runs the
// same scan over the handlers' responses (after respond()'s scrub).
import { expect } from "vitest";
import { API_LIMITS, type PlaceRow, type TripRow } from "../../../src/schema/api/index.ts";
import { allRows, expectOk, householdHits, type ContractCase } from "./kit.ts";
import { everyDetail } from "./getPlace.cases.ts";

export const householdCases: ContractCase[] = [
  {
    id: "K7",
    title: "no household string or private key in lists, details, trips, search, globe, nearby or exports",
    method: "all",
    async run(store, t) {
      const hits: string[] = [];
      const scan = (out: unknown, where: string) => hits.push(...householdHits(out, where));
      const places = await allRows<PlaceRow>((n) => store.listPlaces({}, { page: n, pageSize: API_LIMITS.pageSize.max }));
      scan(places, "listPlaces");
      scan(await everyDetail(store), "getPlace");
      const trips = await allRows<TripRow>((n) => store.listTrips({}, { page: n }));
      scan(trips, "listTrips");
      for (const tr of trips) scan(expectOk(await store.getTrip(tr.slug)), `getTrip ${tr.slug}`);
      scan(expectOk(await store.countPlaces({})), "countPlaces");
      scan(expectOk(await store.search({ q: "a", limit: API_LIMITS.searchLimit.max })), "search");
      scan(expectOk(await store.globeTree()), "globeTree");
      scan(expectOk(await store.globePins(t.facts.pinCountry)), "globePins");
      const nearby = await store.nearbyForPlace(t.facts.placeSlug);
      if (nearby.ok) scan(nearby.data, "nearbyForPlace");
      scan(expectOk(await store.getExport({ type: "trip", slug: t.facts.tripSlug, format: "csv" })), "getExport");
      expect(hits).toEqual([]);
      // the scan is live: a planted household string is found
      expect(householdHits({ notes: "Hotel idea near the lake" }, "probe").length).toBe(1);
    },
  },
];
