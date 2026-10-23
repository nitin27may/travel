// The town guard (D-E3 as amended, store.ts A33; owner decision Q87): K26. A town planted INSIDE the household radius, with an outline
// that touches it, and a neighbour whose outline touches it, are served by every town method without a 500, with a moved centre and
// rings, and every output passes the detector (K7's scan). The home town's name comes from the home module's own pattern, so no test
// types it; the point comes from the probe (core/test/privacy/probe.ts), so none types that either.
import { expect } from "vitest";
import { nearHome, HOME_TOWN_RE } from "../../../src/privacy/home.ts";
import { town as townSchema, type GlobeCity, type Town } from "../../../src/schema/api/index.ts";
import { northOfHome } from "../../privacy/probe.ts";
import { expectError, expectOk, householdHits, type ContractCase, type Planted } from "./kit.ts";

const homeWord = HOME_TOWN_RE.source.replace(/[^a-z]/gi, "").toLowerCase();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A square ring of side ~2 x `km` around a point, as a GeoJSON polygon's coordinates ([lon, lat]). */
function square(c: { lat: number; lon: number }, km: number): [number, number][][] {
  const dLat = km / 111.19;
  const dLon = dLat / Math.cos((c.lat * Math.PI) / 180);
  return [[[c.lon - dLon, c.lat - dLat], [c.lon + dLon, c.lat - dLat], [c.lon + dLon, c.lat + dLat], [c.lon - dLon, c.lat + dLat], [c.lon - dLon, c.lat - dLat]]];
}

const at = (p: { lat: number; lon: number }, id: string, name: string): Town => ({ id, name, lat: p.lat, lon: p.lon, pop: 50_000, cc: "ca", region: null, places: null, distanceKm: null, bearing: null });

/** The planted layer: the home town (centre 0.5 km from home, an outline around it) and a neighbour 12 km off whose outline reaches 1.5 km from home. */
export function plantedTowns(): Planted & { home: Town; neighbour: Town } {
  const home = at(northOfHome(0.5), `ca-zz-${homeWord}`, cap(homeWord));
  const neighbour = at(northOfHome(12), "ca-zz-planted-neighbour", "Planted Neighbour");
  const cities: GlobeCity[] = [
    { id: home.id, name: home.name, geometry: { type: "Polygon", coordinates: square(northOfHome(0.5), 1) }, credit: "OpenStreetMap contributors (ODbL)" },
    { id: neighbour.id, name: neighbour.name, geometry: { type: "Polygon", coordinates: [[...square(northOfHome(12), 4)[0]!.slice(0, 4), [northOfHome(1.5).lon, northOfHome(1.5).lat], square(northOfHome(12), 4)[0]![0]!]] }, credit: "OpenStreetMap contributors (ODbL)" },
  ];
  return { towns: [home, neighbour], cities, home, neighbour };
}

export const townGuardCases: ContractCase[] = [
  {
    id: "K26",
    title: "no town makes a method answer 500 or carry a point near home: a planted town inside the radius is served with a moved centre and a ring",
    method: "towns",
    async run(_store, t) {
      expect(t.plant, "the target must plant towns for K26").toBeDefined();
      const p = plantedTowns();
      const store = await t.plant!(p);
      const hits: string[] = [];
      const scan = (out: unknown, where: string) => hits.push(...householdHits(out, where));
      if (!t.facts.town.layer) {
        // before the towns layer every town method answers not_available, which carries nothing
        expectError(await store.towns({ city: p.home.id }), "not_available");
        expectError(await store.near({ city: p.home.id }), "not_available");
        expectError(await store.globeCity(p.home.id), "not_available");
        return;
      }
      // the towns around the neighbour hold the home town: by id and name (the typed exemption), never at its own centre
      const around = expectOk(await store.towns({ city: p.neighbour.id, r: 50 }), "towns");
      const served = around.items.find((x) => x.id === p.home.id);
      expect(served, "the home town is served like any town (Q87: not excluded)").toBeDefined();
      expect(townSchema.safeParse(served).success).toBe(true);
      expect(nearHome(served!.lat, served!.lon), "a town centre within the household radius was served").toBe(false);
      expect(Object.keys(served!).sort(), "a guarded row carries no extra field").toEqual(Object.keys(townSchema.shape).sort());
      for (const x of around.items) expect(nearHome(x.lat, x.lon), `${x.id}: a town centre within the household radius was served`).toBe(false);
      scan(around, "towns");
      // near(city=) measures from the served centre and answers
      const near = expectOk(await store.near({ city: p.home.id, r: 25 }), "near");
      expect(nearHome(near.centre.lat, near.centre.lon), "a near centre within the household radius was served").toBe(false);
      scan(near, "near");
      // the outlines that touch the radius are rings
      for (const town of [p.home, p.neighbour]) {
        const city = expectOk(await store.globeCity(town.id), `globeCity ${town.id}`);
        expect(city.geometry, `${town.id}: an outline touching the household radius was served`).toBeNull();
        scan(city, `globeCity ${town.id}`);
      }
      // the city filter and its counts answer, and the nearby block's towns too
      scan(expectOk(await store.listPlaces({ facets: { city: [p.home.id] } }), "listPlaces city"), "listPlaces city");
      scan(expectOk(await store.countPlaces({ facets: { city: [p.home.id] } }), "countPlaces city"), "countPlaces city");
      scan(expectOk(await store.nearbyForPlace(t.facts.placeSlug), "nearbyForPlace"), "nearbyForPlace");
      expect(hits, "K7's scan over the planted outputs").toEqual([]);
    },
  },
  {
    id: "K26.exemption",
    title: "the detector lifts only the home-town text rule, only in a town's id and name and a city chip, never for a point",
    method: "all",
    async run() {
      const id = `ca-zz-${homeWord}`;
      const name = cap(homeWord);
      // the shapes the exemption covers
      expect(householdHits({ items: [{ id, name, lat: 50, lon: -100 }] }, "towns")).toEqual([]);
      expect(householdHits({ centre: { kind: "town", key: id, name, lat: 50, lon: -100 } }, "near")).toEqual([]);
      expect(householdHits({ facets: { city: [{ value: id, label: name, count: 3 }] } }, "counts")).toEqual([]);
      expect(householdHits({ chips: [{ id: "near", label: `Near ${name}`, set: { city: [id] }, words: [0, 2] }], facets: { city: [id] }, href: `/places/?city=${id}` }, "parse")).toEqual([]);
      expect(householdHits({ items: [{ slug: "x", nearTown: id }] }, "row")).toEqual([]);
      // and nothing else: prose, a name with no town id beside it, a label that is a sentence, a point near home
      expect(householdHits({ summary: `A walk out of ${name}` }, "prose").length).toBe(1);
      expect(householdHits({ items: [{ id: "some-place", name }] }, "place").length).toBe(1);
      expect(householdHits({ items: [{ id, name: `${name} 123 Main Street` }] }, "address").length).toBeGreaterThan(0);
      expect(householdHits({ items: [{ id, name, ...northOfHome(0.5) }] }, "point").length).toBe(1);
      expect(householdHits({ href: `/places/?q=${homeWord}` }, "href").length).toBe(1);
    },
  },
];
