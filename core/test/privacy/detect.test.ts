import { describe, expect, it } from "vitest";
import { privacyHits } from "../../src/privacy/detect.ts";
import { HOME_TOWN_RE } from "../../src/privacy/home.ts";
import { publicGazetteer } from "../../src/privacy/towns.ts";
import { encodePolyline5 } from "../../src/schema/api/legs.ts";
import { HOME_PROBE, northOfHome } from "./probe.ts";

const WORD = HOME_TOWN_RE.source.replace(/[^a-z]/gi, "").toLowerCase();
const NAME = WORD.charAt(0).toUpperCase() + WORD.slice(1);

describe("privacy detector", () => {
  it("finds the home town, a planning note, a street address, a private key and a status word", () => {
    const whys = (x: unknown) => privacyHits(x).map((h) => h.why);
    expect(whys({ a: `Drive from ${NAME}` })).toEqual(["the home town"]);
    expect(whys({ a: "Hotel idea near the lake" })).toEqual(["a household planning note"]);
    expect(whys({ a: "Meet at 123 Maple Street" })).toEqual(["a household planning note"]);
    expect(whys({ sourceTypes: ["x"] })).toEqual(["a private key"]);
    expect(whys({ status: "planned" })).toEqual(["a private key"]);
    expect(whys({ status: "open", hours: "30 min each way" })).toEqual([]);
  });
  it("finds the internal research columns in a served body: meta, notes_private and doc (RI-6, RIS-C); notes stays public", () => {
    const whys = (x: unknown) => privacyHits(x).map((h) => h.why);
    expect(whys({ place: { ref: "place/x", meta: { schema_version: 1, run_id: "DATA-D7R" } } })).toEqual(["a private key"]);
    expect(whys({ items: [{ ref: "place/x", notes_private: "lead to follow" }] })).toEqual(["a private key"]);
    expect(whys({ entity: { ref: "place/x", doc: {} } })).toEqual(["a private key"]);
    expect(privacyHits({ items: [{ meta: {} }] })[0]!.where).toBe("$.items[0].meta");
    expect(whys({ notes: "Bring a jacket", trip: { notes: [] } })).toEqual([]);
  });
  it("finds a point near home as an object, as a coordinate array in either order, and inside an export body", () => {
    const p = northOfHome(0.5);
    expect(privacyHits({ lat: p.lat, lon: p.lon }).length).toBe(1);
    expect(privacyHits({ geometry: [[p.lon, p.lat], [-115.5, 51.1]] }).length).toBe(1);
    expect(privacyHits({ geometry: [[p.lat, p.lon]] }).length).toBe(1);
    expect(privacyHits({ body: `<gpx><wpt lat="${p.lat.toFixed(5)}" lon="${p.lon.toFixed(5)}"><name>x</name></wpt></gpx>` }).length).toBe(1);
    expect(privacyHits({ body: `<kml><coordinates>${p.lon.toFixed(5)},${p.lat.toFixed(5)},0 ${HOME_PROBE.lon.toFixed(1)},9.0</coordinates></kml>` }).length).toBe(1);
  });
  it("finds a private origin key (store.ts A24) as a value, inside text and as a map key, and leaves wikiloc and place refs alone", () => {
    const whys = (x: unknown) => privacyHits(x).map((h) => h.why);
    const origin = "a private origin key (wishlist or prototype id)";
    expect(whys({ ref: "loc:CA/AB/x/y" })).toEqual([origin]);
    expect(whys({ ref: "proto:braies" })).toEqual([origin]);
    expect(whys({ body: '{"items":[{"ref":"loc:IT/x"}]}' })).toEqual([origin]);
    expect(whys({ refSlugs: { "proto:x": "x" } })).toEqual([origin]);
    expect(JSON.stringify(privacyHits({ refSlugs: { "loc:CA/AB/secret": "x" } }))).not.toContain("secret");
    expect(whys({ ref: "place/lake-louise", note: "wikiloc: 12345 tracks", s: "proto: ", t: "prototype_approx", u: "trip/x/sight:ragged falls" })).toEqual([]);
  });
  it("lifts the home-town text rule only for gazetteer towns (A33), and lifts nothing without a gazetteer", () => {
    const id = `ca-zz-${WORD}`;
    const gazetteer = publicGazetteer([{ id, name: NAME, lat: 50, lon: -100 }]);
    const row = { items: [{ id, name: WORD.toUpperCase() }] };
    expect(privacyHits(row, 20, { gazetteer })).toEqual([]);
    expect(privacyHits(row).map((h) => h.why)).toEqual(["the home town", "the home town"]);
    // a sentence is never a slot, and a planning note in a name slot is still found
    expect(privacyHits({ items: [{ id, name: `Hotel idea in ${WORD}` }] }, 20, { gazetteer }).map((h) => h.why)).toEqual(["a household planning note"]);
    // review API3-R-2: nearTown exempts its own string only
    expect(privacyHits({ items: [{ slug: "x", name: "Lake", nearTown: id }] }, 20, { gazetteer })).toEqual([]);
    expect(privacyHits({ items: [{ slug: "x", name: `${NAME} Harbour`, nearTown: id }] }, 20, { gazetteer }).map((h) => h.why)).toEqual(["the home town"]);
  });
  it("does not read the request's own words back as household text under an echo key (A40), and reads them everywhere else", () => {
    for (const q of [NAME, "hotel ideas", "base camp: x", "100 Queen Street", `${NAME} hotel ideas`]) {
      expect(privacyHits({ query: q, q, unused: q.split(" "), terms: [q] }, 20, { echo: [q] })).toEqual([]);
      expect(privacyHits({ query: q }).length).toBe(1);
      expect(privacyHits({ query: q, summary: q }, 20, { echo: [q] }).map((h) => h.where)).toEqual(["$.summary"]);
    }
    // an href's query parameter echoing the request, and a city= gazetteer id, are not read; another parameter is
    expect(privacyHits({ href: `/places/?q=${encodeURIComponent(`${NAME} hotel ideas`)}` }, 20, { echo: [`${NAME} hotel ideas`] })).toEqual([]);
    expect(privacyHits({ href: `/places/?q=${WORD}` }, 20, { echo: ["lake"] }).length).toBe(1);
    // a coordinate pair the visitor typed is an echo too: refusing it would answer 500 for exactly the points near home
    const p = northOfHome(0.4);
    const typed = `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)} lookout above the lake`;
    expect(privacyHits({ query: typed }, 20, { echo: [typed] })).toEqual([]);
    expect(privacyHits({ note: typed }, 20, { echo: [typed] }).length).toBe(1);
  });
  it("decodes an encoded line under `geometry` and finds a vertex near home, and never reads its characters as words (A39)", () => {
    const p = northOfHome(0.5);
    expect(privacyHits({ geometry: encodePolyline5([[-116.1, 51.3], [p.lon, p.lat]]) }).map((h) => h.why)).toEqual(["a coordinate near the home town in an encoded line"]);
    expect(privacyHits({ geometry: encodePolyline5([[-116.1, 51.3], [-116.2, 51.4]]) })).toEqual([]);
  });
  it("walks a JSON body (the json export) as a structure: a polyline or a point near home inside it is found (A39, review API3-R-6)", () => {
    const p = northOfHome(0.5);
    const line = encodePolyline5([[-116.1, 51.3], [p.lon, p.lat]]);
    const body = JSON.stringify({ title: "x", days: [{ legs: [{ geometry: line }] }] });
    expect(privacyHits({ filename: "x.json", mime: "application/json", body }).map((h) => h.why)).toEqual(["a coordinate near the home town in an encoded line"]);
    expect(privacyHits({ body: JSON.stringify({ stops: [{ point: { lat: p.lat, lon: p.lon } }] }) }).map((h) => h.why)).toContain("a point near the home town");
    expect(privacyHits({ body: JSON.stringify({ days: [{ legs: [{ geometry: encodePolyline5([[-116.1, 51.3], [-116.2, 51.4]]) }] }] }) })).toEqual([]);
    expect(privacyHits({ body: "{not json" })).toEqual([]);
  });
  it("leaves a far point alone, and a hit names no coordinate", () => {
    const far = northOfHome(30);
    expect(privacyHits({ lat: far.lat, lon: far.lon, g: [[far.lon, far.lat]], body: `lat="${far.lat.toFixed(5)}" lon="${far.lon.toFixed(5)}" and more text here` })).toEqual([]);
    const near = northOfHome(0.2);
    expect(JSON.stringify(privacyHits({ lat: near.lat, lon: near.lon }))).not.toContain(String(near.lat).slice(0, 6));
  });
});
