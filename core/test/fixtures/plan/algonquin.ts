// Golden 2: Algonquin, two nights from the Toronto hub, October (shoulder season for the trails). The park itself is picked as the
// trip's AREA (TB-PIN R1, BACKLOG 15.354): it is never a stop with a visit time. Coordinates are approximate (about 1 km); this is a
// fixture, not the catalogue.
import { mkBuild, mkInput, mkPlace, mkTown, ONT, placesMap } from "../../plan/engine-fixture.ts";
import type { GoldenCase } from "./types.ts";

export const ALGONQUIN_PARK = "place/algonquin-provincial-park";

const SHOULDER = [5, 6, 7, 8, 9];
const places = [
  mkPlace(ALGONQUIN_PARK, 45.55, -78.4, { kind: "park", type: "protected-area", visitMin: null, draw: "journey", season: [], complete: true }),
  mkPlace("route/hardwood-lookout-trail", 45.5458, -78.6942, { kind: "trail", visitMin: 45, distanceKm: 1.0, gainM: 40, draw: "detour", season: SHOULDER }),
  mkPlace("route/track-and-tower-trail", 45.5877, -78.5546, { kind: "trail", visitRange: [90, 150], distanceKm: 7.7, gainM: 100, draw: "journey", season: SHOULDER }),
  mkPlace("route/mizzy-lake-trail", 45.5925, -78.5517, { kind: "trail", visitMin: 180, distanceKm: 11, gainM: 60, draw: "detour", season: SHOULDER }),
  mkPlace("route/lookout-trail", 45.5478, -78.7125, { kind: "trail", visitMin: 60, distanceKm: 2.1, gainM: 80, draw: "local", season: SHOULDER }),
  mkPlace("place/oxtongue-lake", 45.3606, -78.9246, { kind: "lake", visitMin: 60, season: [6, 7, 8, 9, 10] }),
];

export const algonquin: GoldenCase = {
  name: "algonquin",
  input: mkInput(
    mkBuild(
      [{ ref: ALGONQUIN_PARK, must: true }, "route/hardwood-lookout-trail", "route/track-and-tower-trail", "route/mizzy-lake-trail", "route/lookout-trail", "place/oxtongue-lake"],
      { nights: 2, month: 10 },
    ),
    {
      places: placesMap(places),
      towns: [...ONT.towns, mkTown("ca-on-whitney", "Whitney", 45.4994, -78.2269, 200, 1)],
    },
  ),
};
