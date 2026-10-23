import { describe, expect, it } from "vitest";
import { privacyHits } from "../../src/privacy/detect.ts";
import { HOME_TOWN_RE } from "../../src/privacy/home.ts";
import { encodePolyline5 } from "../../src/schema/api/legs.ts";
import { HOME_PROBE, northOfHome } from "./probe.ts";

describe("privacy detector", () => {
  it("finds the home town, a planning note, a street address, a private key and a status word", () => {
    const whys = (x: unknown) => privacyHits(x).map((h) => h.why);
    expect(whys({ a: "Drive from Whitby" })).toEqual(["the home town"]);
    expect(whys({ a: "Hotel idea near the lake" })).toEqual(["a household planning note"]);
    expect(whys({ a: "Meet at 123 Maple Street" })).toEqual(["a household planning note"]);
    expect(whys({ sourceTypes: ["x"] })).toEqual(["a private key"]);
    expect(whys({ status: "planned" })).toEqual(["a private key"]);
    expect(whys({ status: "open", hours: "30 min each way" })).toEqual([]);
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
  it("lifts the home-town text rule only in the typed town slots (A33), and keeps it with townSlots off", () => {
    const word = HOME_TOWN_RE.source.replace(/[^a-z]/gi, "").toLowerCase();
    const row = { items: [{ id: `ca-zz-${word}`, name: word.toUpperCase() }] };
    expect(privacyHits(row)).toEqual([]);
    expect(privacyHits(row, 20, { townSlots: false }).map((h) => h.why)).toEqual(["the home town", "the home town"]);
    // a sentence is never a slot, and a planning note in a name slot is still found
    expect(privacyHits({ items: [{ id: `ca-zz-${word}`, name: `Hotel idea in ${word}` }] }).map((h) => h.why)).toEqual(["a household planning note"]);
  });
  it("decodes an encoded line under `geometry` and finds a vertex near home, and never reads its characters as words (A39)", () => {
    const p = northOfHome(0.5);
    expect(privacyHits({ geometry: encodePolyline5([[-116.1, 51.3], [p.lon, p.lat]]) }).map((h) => h.why)).toEqual(["a coordinate near the home town in an encoded line"]);
    expect(privacyHits({ geometry: encodePolyline5([[-116.1, 51.3], [-116.2, 51.4]]) })).toEqual([]);
  });
  it("leaves a far point alone, and a hit names no coordinate", () => {
    const far = northOfHome(30);
    expect(privacyHits({ lat: far.lat, lon: far.lon, g: [[far.lon, far.lat]], body: `lat="${far.lat.toFixed(5)}" lon="${far.lon.toFixed(5)}" and more text here` })).toEqual([]);
    const near = northOfHome(0.2);
    expect(JSON.stringify(privacyHits({ lat: near.lat, lon: near.lon }))).not.toContain(String(near.lat).slice(0, 6));
  });
});
