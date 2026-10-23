import { describe, expect, it } from "vitest";
import { privacyHits } from "../../src/privacy/detect.ts";
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
  it("leaves a far point alone, and a hit names no coordinate", () => {
    const far = northOfHome(30);
    expect(privacyHits({ lat: far.lat, lon: far.lon, g: [[far.lon, far.lat]], body: `lat="${far.lat.toFixed(5)}" lon="${far.lon.toFixed(5)}" and more text here` })).toEqual([]);
    const near = northOfHome(0.2);
    expect(JSON.stringify(privacyHits({ lat: near.lat, lon: near.lon }))).not.toContain(String(near.lat).slice(0, 6));
  });
});
