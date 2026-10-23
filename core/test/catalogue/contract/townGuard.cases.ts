// The towns layer and privacy (store.ts A33; owner ruling Q87 of 23 Oct 2026, FINAL): K26. Every town is served exactly as the public
// gazetteer holds it: a planted fixture town whose centre and outline lie inside the household radius, and a neighbour whose outline
// reaches into it, are served by every town method with the planted numbers unchanged, no 500, and a clean K7 scan WITH the store's
// gazetteer. The detector's identity rule is the only thing that lets them through: the same outputs without the gazetteer fail, and a
// planted attacker point near home that is not a gazetteer point fails with it. The home town's name comes from the home module's own
// pattern, so no test types it; the point comes from the probe (core/test/privacy/probe.ts), so none types that either.
import { expect } from "vitest";
import { HOME_TOWN_RE, nearHome } from "../../../src/privacy/home.ts";
import { gazetteerOf, publicGazetteer, type PublicGazetteer } from "../../../src/privacy/towns.ts";
import { town as townSchema, type GlobeCity, type Town } from "../../../src/schema/api/index.ts";
import { northOfHome } from "../../privacy/probe.ts";
import { expectError, expectOk, householdHits, type ContractCase, type Planted } from "./kit.ts";

export const homeWord = HOME_TOWN_RE.source.replace(/[^a-z]/gi, "").toLowerCase();
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
    title: "every town is served exactly as the gazetteer holds it, a planted town inside the radius included, with no 500, and only the identity rule lets it through",
    method: "towns",
    async run(_store, t) {
      expect(t.plant, "the target must plant towns for K26").toBeDefined();
      const p = plantedTowns();
      const store = await t.plant!(p);
      if (!t.facts.town.layer) {
        // before the towns layer every town method answers not_available, which carries nothing
        expectError(await store.towns({ city: p.home.id }), "not_available");
        expectError(await store.near({ city: p.home.id }), "not_available");
        expectError(await store.globeCity(p.home.id), "not_available");
        return;
      }
      const gazetteer = await gazetteerOf(store);
      expect(gazetteer, "a store with a towns layer says which gazetteer it loaded (PublicTownsHolder)").not.toBeNull();
      const outputs: [string, unknown][] = [];
      // the towns around the neighbour hold the home town, at its public centre, with no extra field
      const around = expectOk(await store.towns({ city: p.neighbour.id, r: 50 }), "towns");
      const served = around.items.find((x) => x.id === p.home.id);
      expect(served, "the home town is served like any town (Q87: not excluded)").toBeDefined();
      expect(townSchema.safeParse(served).success).toBe(true);
      expect({ lat: served!.lat, lon: served!.lon }, "a town is served at its gazetteer point, unmoved").toEqual({ lat: p.home.lat, lon: p.home.lon });
      expect(Object.keys(served!).sort(), "a town row carries no extra field").toEqual(Object.keys(townSchema.shape).sort());
      outputs.push(["towns", around]);
      // a method a later lane fills still answers not_available, and says so (kit.ts ContractFacts.town.notYet)
      const notYet = new Set(t.facts.town.notYet ?? []);
      // near(city=) measures from the public centre
      if (notYet.has("near")) expectError(await store.near({ city: p.home.id, r: 25 }), "not_available");
      else {
        const near = expectOk(await store.near({ city: p.home.id, r: 25 }), "near");
        expect({ lat: near.centre.lat, lon: near.centre.lon }, "near(city=) measures from the gazetteer point").toEqual({ lat: p.home.lat, lon: p.home.lon });
        outputs.push(["near", near]);
      }
      // the outlines are the public ones, not rings
      if (notYet.has("globeCity")) expectError(await store.globeCity(p.home.id), "not_available");
      else {
        for (const c of p.cities!) {
          const city = expectOk(await store.globeCity(c.id), `globeCity ${c.id}`);
          expect(city.geometry, `${c.id}: an outline is served exactly as loaded`).toEqual(c.geometry);
          outputs.push([`globeCity ${c.id}`, city]);
        }
      }
      // the city filter and its counts answer, and the nearby block's towns too
      outputs.push(["listPlaces city", expectOk(await store.listPlaces({ facets: { city: [p.home.id] } }), "listPlaces city")]);
      outputs.push(["countPlaces city", expectOk(await store.countPlaces({ facets: { city: [p.home.id] } }), "countPlaces city")]);
      if (notYet.has("nearbyForPlace")) expectError(await store.nearbyForPlace(t.facts.placeSlug), "not_available");
      else outputs.push(["nearbyForPlace", expectOk(await store.nearbyForPlace(t.facts.placeSlug), "nearbyForPlace")]);
      const hits = outputs.flatMap(([where, out]) => householdHits(out, where, { gazetteer }));
      expect(hits, "K7's scan over the planted outputs, with the store's gazetteer").toEqual([]);
      // the identity rule is what lets the public points through: without the gazetteer the same outputs fail closed
      // the outline the store would serve is the planted one, exactly (globeCity above checked that where it answers)
      const homeCity = p.cities!.find((c) => c.id === p.home.id)!;
      expect(householdHits(around, "towns").length, "without the gazetteer a town centre near home is refused").toBeGreaterThan(0);
      // outlines are loaded with GLB2b; until then the gazetteer holds none and an outline vertex near home is refused either way
      const outlines = !notYet.has("globeCity");
      if (outlines) expect(householdHits(homeCity, "globeCity").length, "without the gazetteer an outline near home is refused").toBeGreaterThan(0);
      // a planted attacker point near home that is NOT the gazetteer point is refused, under the town's own id or any other
      const moved = { ...served!, lat: served!.lat + 0.2 / 111.19 };
      expect(nearHome(moved.lat, moved.lon)).toBe(true);
      expect(householdHits({ items: [moved] }, "moved", { gazetteer }).length, "a moved centre under a real town id").toBe(1);
      expect(householdHits({ items: [{ ...served!, id: "ca-zz-not-in-gazetteer" }] }, "unknown id", { gazetteer }).length, "the public point under an id the gazetteer does not hold").toBeGreaterThan(0);
      expect(householdHits({ items: [{ slug: "x", name: "x", lat: served!.lat, lon: served!.lon }] }, "place", { gazetteer }).length, "the public point as a place's point").toBe(1);
      expect(householdHits({ centre: { kind: "town", key: p.neighbour.id, name: p.neighbour.name, lat: served!.lat, lon: served!.lon } }, "swapped", { gazetteer }).length, "one town's point under another town's id").toBe(1);
      if (!outlines) return;
      const ring = (homeCity.geometry as { coordinates: number[][][] }).coordinates[0]!;
      const planted = northOfHome(0.3);
      const tampered = { ...homeCity, geometry: { type: "Polygon", coordinates: [[...ring.slice(0, 2), [planted.lon, planted.lat], ...ring.slice(2)]] } };
      expect(householdHits(tampered, "tampered outline", { gazetteer }).length, "a vertex near home that the gazetteer outline does not hold").toBe(1);
    },
  },
  {
    id: "K26.exemption",
    title: "the detector lifts the home-town text rule only for gazetteer towns' ids, names and chips, and accepts no point by shape",
    method: "all",
    async run() {
      const id = `ca-zz-${homeWord}`;
      const name = cap(homeWord);
      const far = { lat: 50, lon: -100 };
      const gazetteer: PublicGazetteer = publicGazetteer([{ id, name, ...far }]);
      const g = { gazetteer };
      // the shapes the exemption covers, for a town the gazetteer holds
      expect(householdHits({ items: [{ id, name, ...far }] }, "towns", g)).toEqual([]);
      expect(householdHits({ centre: { kind: "town", key: id, name, ...far } }, "near", g)).toEqual([]);
      expect(householdHits({ facets: { city: [{ value: id, label: name, count: 3 }] } }, "counts", g)).toEqual([]);
      expect(householdHits({ chips: [{ id: "near", label: `Near ${name}`, set: { city: [id] }, words: [0, 2] }], facets: { city: [id] }, href: `/places/?city=${id}` }, "parse", g)).toEqual([]);
      expect(householdHits({ towns: [{ id, name, distanceKm: 3, bearing: "N" }] }, "nearby", g)).toEqual([]);
      // a row's nearTown is exempt for its own string only (review API3-R-2)
      expect(householdHits({ items: [{ slug: "x", name: "Lake", nearTown: id }] }, "row", g)).toEqual([]);
      expect(householdHits({ items: [{ slug: "x", name: `${name} Harbour`, nearTown: id }] }, "row name", g).length, "a place name holding the town's name beside nearTown").toBe(1);
      expect(householdHits({ items: [{ slug: "x", name: `${name} Harbour`, townId: id }] }, "row townId", g).length).toBe(1);
      // only gazetteer ids: a town-shaped id the gazetteer does not hold exempts nothing, and with no gazetteer nothing is exempt
      expect(householdHits({ items: [{ id: `st-${homeWord}-x`, name: `${name} X` }] }, "shape", g).length).toBe(2);
      expect(householdHits({ items: [{ id, name, ...far }] }, "no gazetteer").length).toBe(2);
      // and nothing else: prose, a name with no town id beside it, a label that is a sentence, a point near home, an href's q
      expect(householdHits({ summary: `A walk out of ${name}` }, "prose", g).length).toBe(1);
      expect(householdHits({ items: [{ id: "some-place", name }] }, "place", g).length).toBe(1);
      expect(householdHits({ items: [{ id, name: `${name} 123 Main Street` }] }, "address", g).length).toBeGreaterThan(0);
      expect(householdHits({ items: [{ id, name, ...northOfHome(0.5) }] }, "point", g).length).toBe(1);
      expect(householdHits({ href: `/places/?q=${homeWord}` }, "href", g).length).toBe(1);
    },
  },
];
