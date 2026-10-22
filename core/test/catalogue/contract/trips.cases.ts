// listTrips and getTrip: K1, K2, K8, plus shapes. Public trips are dateless.
import { expect } from "vitest";
import { API_LIMITS, TRIP_ROW_KEYS, tripDetail, tripRow, type TripRow } from "../../../src/schema/api/index.ts";
import { allRows, expectError, expectOk, type ContractCase } from "./kit.ts";

/** An ISO calendar date: public trips never carry one in prose (dateless templates). */
const ISO_DATE = /\b20\d\d-\d\d-\d\d\b/;
/** The prose fields of a trip detail, at any depth (R-21: photo file names and URLs may hold dates; prose may not). */
const PROSE = new Set(["title", "subtitle", "summary", "note", "notes", "why", "label", "plain", "light", "writtenFor"]);
function prose(x: unknown, out: string[] = []): string[] {
  if (Array.isArray(x)) x.forEach((y) => prose(y, out));
  else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) typeof v === "string" && PROSE.has(k) ? out.push(v) : prose(v, out);
  return out;
}

export const listTripsCases: ContractCase[] = [
  {
    id: "K1",
    title: "pageSize above the cap is too_large",
    method: "listTrips",
    async run(store) {
      expectError(await store.listTrips({}, { pageSize: API_LIMITS.pageSize.max + 1 }), "too_large");
      expectError(await store.listTrips({ sort: ["km"] }), "invalid_input");
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
      const got = expectOk(await store.getTrip(t.facts.tripSlug));
      if ("moved" in got) throw new Error(`${t.facts.tripSlug} answered moved`);
      const d = got;
      const parsed = tripDetail.safeParse(d);
      expect(parsed.success, parsed.success ? "" : parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join("; ")).toBe(true);
      expect(d.ref).toMatch(/^trip\//);
      const row = (await allRows<TripRow>((n) => store.listTrips({}, { page: n }))).find((r) => r.slug === t.facts.tripSlug);
      expect(row?.ref).toBe(d.ref);
      for (const text of prose(d)) expect(text).not.toMatch(ISO_DATE);
    },
  },
  {
    id: "K9.trip",
    title: "a retired trip slug answers moved with the current slug (R-18)",
    method: "getTrip",
    async run(store, t) {
      const r = t.facts.tripRetired!;
      expect(expectOk(await store.getTrip(r.from))).toMatchObject({ moved: r.to });
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
