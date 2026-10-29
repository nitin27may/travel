// Golden 3: a day trip. Near mode, nights 0, one day, from the Toronto hub (a public point). The start anchors the drive out and
// back; it is not a base, not a cache key and not in the answer.
import { mkBuild, mkInput, mkPlace, ONT, placesMap } from "../../plan/engine-fixture.ts";
import type { GoldenCase } from "./types.ts";

const places = [
  mkPlace("place/elora-gorge", 43.6828, -80.4297, { kind: "park", visitMin: 120, draw: "detour" }),
  mkPlace("place/st-jacobs-market", 43.5388, -80.5603, { kind: "sight", visitMin: 90, draw: "detour" }),
  mkPlace("place/rattlesnake-point", 43.4912, -79.9606, { kind: "viewpoint", visitMin: 90, draw: "local" }),
  mkPlace("place/bruce-peninsula-tobermory", 45.2557, -81.6652, { kind: "park", visitMin: 180, draw: "journey" }), // far beyond a day's reach
];

export const daytrip: GoldenCase = {
  name: "daytrip",
  input: mkInput(
    mkBuild(["place/elora-gorge", "place/st-jacobs-market", "place/rattlesnake-point", "place/bruce-peninsula-tobermory"], {
      nights: 0,
      month: 8,
      where: { mode: "near", start: { kind: "hub", id: "toronto" }, driveLimitMin: 150 },
    }),
    { places: placesMap(places), towns: ONT.towns },
  ),
};
