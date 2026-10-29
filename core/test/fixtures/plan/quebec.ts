// Golden 1: Quebec City short stay. Near mode from the Montreal hub, two nights, one base, a family with a 7-year-old, July.
// Coordinates are real public points; nothing here is a visitor's home.
import { mkBuild, mkInput, mkPlace, mkTown, ageLimited, pt, placesMap } from "../../plan/engine-fixture.ts";
import type { GoldenCase } from "./types.ts";

const places = [
  mkPlace("place/old-quebec", 46.8123, -71.2045, { kind: "sight", visitMin: 150, draw: "journey", region: "quebec" }),
  mkPlace("place/plains-of-abraham", 46.8004, -71.2174, { kind: "park", visitMin: 90, draw: "detour", region: "quebec" }),
  mkPlace("place/montmorency-falls", 46.8908, -71.1488, { kind: "waterfall", visitMin: 75, draw: "journey", region: "quebec" }),
  mkPlace("place/ile-d-orleans", 46.9, -70.95, { kind: "sight", visitMin: 180, draw: "detour", region: "quebec" }),
  mkPlace("place/sainte-anne-de-beaupre", 47.0166, -70.9285, { kind: "sight", visitMin: 60, draw: "local", region: "quebec" }),
  mkPlace("place/canyon-sainte-anne", 47.1243, -70.9127, { kind: "waterfall", visitMin: 90, draw: "detour", region: "quebec", suitability: ageLimited(10) }),
  mkPlace("place/chute-montmorency-zipline", 46.89, -71.15, { kind: "activity", visitMin: 90, draw: "detour", region: "quebec", suitability: ageLimited(12) }),
];

export const quebec: GoldenCase = {
  name: "quebec",
  input: mkInput(
    mkBuild(
      [{ ref: "place/old-quebec", must: true }, "place/plains-of-abraham", "place/montmorency-falls", "place/ile-d-orleans", "place/sainte-anne-de-beaupre", "place/canyon-sainte-anne", "place/chute-montmorency-zipline"],
      {
        where: { mode: "near", start: { kind: "hub", id: "montreal" }, driveLimitMin: 240 },
        nights: 2,
        month: 7,
        party: { adults: 2, children: [7], walkKm: null },
      },
    ),
    {
      places: placesMap(places),
      towns: [
        mkTown("ca-qc-quebec", "Quebec City", 46.8139, -71.208, 549459, 3),
        mkTown("ca-qc-beaupre", "Beaupre", 47.0457, -70.9, 3600, 1),
        mkTown("ca-qc-levis", "Levis", 46.8032, -71.1779, 143414, 2),
      ],
      start: pt(45.5017, -73.5673), // the Montreal hub, a public point
      tz: "America/Toronto",
    },
  ),
};
