// listTrips and getTrip: K1, K2, K8, plus shapes. Public trips are dateless.
import { expect } from "vitest";
import { API_LIMITS, TRIP_ROW_KEYS, tripDetail, tripRow, type TripRow } from "../../../src/schema/api/index.ts";
import { allRows, expectError, expectOk, type ContractCase } from "./kit.ts";

/** An ISO calendar date anywhere in a value: public trips never carry one (dateless templates). */
const ISO_DATE = /\b20\d\d-\d\d-\d\d\b/;

export const listTripsCases: ContractCase[] = [
  {
    id: "K1",
    title: "pageSize above the cap is too_large",
    method: "listTrips",
    async run(store) {
      expectError(await store.listTrips({}, { pageSize: API_LIMITS.pageSize.max + 1 }), "too_large");
    },
  },
  {
    id: "K2",
    title: "trip rows carry exactly the TripRow allowlist",
    method: "listTrips",
    async run(store) {
      const rows = await allRows<TripRow>((n) => store.listTrips({}, { page: n }));
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(Object.keys(r).sort(), r.slug).toEqual([...TRIP_ROW_KEYS].sort());
        expect(tripRow.safeParse(r).success, r.slug).toBe(true);
      }
    },
  },
  {
    id: "K8",
    title: "every trip row carries its ref, and a ref keeps its slug across two loads",
    method: "listTrips",
    async run(store, t) {
      const one = await allRows<TripRow>((n) => store.listTrips({}, { page: n }));
      const two = new Map((await allRows<TripRow>(async (n) => (await t.make()).listTrips({}, { page: n }))).map((r) => [r.ref, r.slug]));
      for (const r of one) expect(two.get(r.ref), r.ref).toBe(r.slug);
    },
  },
];

export const getTripCases: ContractCase[] = [
  {
    id: "getTrip.shape",
    title: "a trip parses as TripDetail, carries its row's ref, and holds no calendar date",
    method: "getTrip",
    async run(store, t) {
      const d = expectOk(await store.getTrip(t.facts.tripSlug));
      const parsed = tripDetail.safeParse(d);
      expect(parsed.success, parsed.success ? "" : parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join("; ")).toBe(true);
      expect(d.ref).toMatch(/^trip\//);
      const row = (await allRows<TripRow>((n) => store.listTrips({}, { page: n }))).find((r) => r.slug === t.facts.tripSlug);
      expect(row?.ref).toBe(d.ref);
      const { legacyUrl: _l, ...rest } = d;
      expect(JSON.stringify(rest)).not.toMatch(ISO_DATE);
    },
  },
  {
    id: "getTrip.unknown",
    title: "an unknown trip is not_found; a malformed profile is invalid_input",
    method: "getTrip",
    async run(store, t) {
      expectError(await store.getTrip("no-such-trip-anywhere"), "not_found");
      expectError(await store.getTrip(t.facts.tripSlug, { p: "x".repeat(50) }), "invalid_input");
      expectOk(await store.getTrip(t.facts.tripSlug, { p: "family-6", split: "1" }));
    },
  },
];
