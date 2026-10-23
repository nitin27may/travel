// K7: no household string and no private key in any output of any method. The web runner adds the 2 km home-point check and runs the
// same scan over the handlers' responses (after respond()'s scrub).
import { expect } from "vitest";
import { API_LIMITS, EXPORT_FORMATS, type PlaceRow, type TripRow } from "../../../src/schema/api/index.ts";
import { allRows, expectOk, householdHits, type ContractCase } from "./kit.ts";
import { everyDetail } from "./getPlace.cases.ts";

export const householdCases: ContractCase[] = [
  {
    id: "K7",
    title: "no household string, private key or wishlist origin (loc:, proto:) in the output of any method, every export format included",
    method: "all",
    async run(store, t) {
      const hits: string[] = [];
      // A24: besides the detector (which reports a private origin key as a hit), every output's JSON text is searched for `loc:` and
      // `proto:` directly, so a store cannot hide an origin key from the walk (in a key, an escaped string or an export body)
      const origin: string[] = [];
      const scan = (out: unknown, where: string) => {
        hits.push(...householdHits(out, where));
        if (/\b(?:loc|proto):/.test(JSON.stringify(out) ?? "")) origin.push(where);
      };
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
      // every method (R-14); a method not built on this target answers an error, which carries no data
      const maybe = (r: { ok: boolean; data?: unknown }, where: string) => r.ok && scan(r.data, where);
      maybe(await store.nearbyForPlace(t.facts.placeSlug), "nearbyForPlace");
      maybe(await store.near({ near: t.facts.near.token, r: API_LIMITS.nearRadius.max }, { pageSize: API_LIMITS.pageSize.max }), "near");
      maybe(await store.towns({ city: t.facts.town.id, r: API_LIMITS.nearRadius.max }), "towns");
      maybe(await store.globeCity(t.facts.town.id), "globeCity");
      scan(expectOk(await store.parse({ q: `${t.facts.region.aliases[0]} lakes` })), "parse");
      // a place with no point has no pin and so no card (not_found); every card that exists is scanned
      for (const p of places) maybe(await store.globeCard(`place:${p.slug}`), `globeCard ${p.slug}`);
      for (const tr of trips) maybe(await store.globeCard(`trip:${tr.slug}`), `globeCard ${tr.slug}`);
      scan(expectOk(await store.globeFeature(t.facts.featureId)), "globeFeature");
      scan(expectOk(await store.globeLine(t.facts.featureId)), "globeLine");
      for (const format of EXPORT_FORMATS) {
        scan(expectOk(await store.getExport({ type: "place", slug: t.facts.exportPlace, format })), `getExport place ${format}`);
        for (const tr of trips) scan(expectOk(await store.getExport({ type: "trip", slug: tr.slug, format })), `getExport ${tr.slug} ${format}`);
      }
      expect(hits).toEqual([]);
      expect(origin, "a wishlist or prototype origin key (loc:, proto:) in a served body (A24)").toEqual([]);
      // the scan is live: a planted origin ref is found, as a value and as a map key, and a place/<slug> ref is not
      expect(householdHits({ items: [{ ref: "loc:CA/AB/x/y" }] }, "probe").length).toBe(1);
      expect(householdHits({ refSlugs: { "proto:x": "x" } }, "probe").length).toBe(1);
      expect(householdHits({ items: [{ ref: "place/lake-louise" }] }, "probe")).toEqual([]);
      // the scan is live: a planted household string is found
      expect(householdHits({ notes: "Hotel idea near the lake" }, "probe").length).toBe(1);
      // the owner's save metadata is a private key (PRIV1): a store that emits it fails
      expect(householdHits({ sourceTypes: ["instagram"], added: "2026-10-16" }, "probe").length).toBe(2);
    },
  },
];
