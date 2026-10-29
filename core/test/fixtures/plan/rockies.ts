// Golden 6 (TB-E2): a two-base Rockies trip the visitor shaped. Trip mode, Calgary airport, 7 nights in August, Banff pinned for 3
// nights and Jasper with its nights left open (shared out by demand: the other 4). Each pick goes to the nearer base; one move day.
// Coordinates are real public points rounded to about 1 km; they make a plausible plan, they are not catalogue data.
import { mkBuild, mkInput, mkPlace, mkTown, pt, placesMap } from "../../plan/engine-fixture.ts";
import type { GoldenCase } from "./types.ts";

const ab = { region: "alberta", season: [5, 6, 7, 8, 9, 10] };
const places = [
  mkPlace("place/lake-louise", 51.4167, -116.2167, { ...ab, kind: "lake", visitMin: 120, draw: "journey" }),
  mkPlace("place/moraine-lake", 51.3217, -116.186, { ...ab, kind: "lake", visitMin: 90, draw: "journey" }),
  mkPlace("route/johnston-canyon", 51.2453, -115.8398, { ...ab, kind: "trail", visitMin: 150, draw: "detour" }),
  mkPlace("place/banff-gondola", 51.1444, -115.5733, { ...ab, kind: "activity", visitMin: 120, draw: "detour" }),
  mkPlace("place/lake-minnewanka", 51.2486, -115.4945, { ...ab, kind: "lake", visitMin: 60, draw: "local" }),
  mkPlace("place/peyto-lake", 51.7258, -116.5097, { ...ab, kind: "viewpoint", visitMin: 45, draw: "journey" }),
  mkPlace("place/athabasca-falls", 52.6644, -117.8836, { ...ab, kind: "waterfall", visitMin: 45, draw: "detour" }),
  mkPlace("route/maligne-canyon", 52.9233, -117.9906, { ...ab, kind: "trail", visitMin: 90, draw: "detour" }),
  mkPlace("place/maligne-lake", 52.7275, -117.6353, { ...ab, kind: "lake", visitMin: 150, draw: "journey" }),
  mkPlace("place/jasper-skytram", 52.8303, -118.1064, { ...ab, kind: "activity", visitMin: 120, draw: "detour" }),
  mkPlace("place/miette-hot-springs", 53.1306, -117.77, { ...ab, kind: "activity", visitMin: 120, draw: "local" }),
];

export const rockies: GoldenCase = {
  name: "rockies-two-base",
  input: mkInput(
    mkBuild(
      [
        { ref: "place/lake-louise", must: true },
        { ref: "place/moraine-lake", must: true },
        "route/johnston-canyon",
        "place/banff-gondola",
        "place/lake-minnewanka",
        "place/peyto-lake",
        "place/athabasca-falls",
        { ref: "route/maligne-canyon", must: true },
        "place/maligne-lake",
        "place/jasper-skytram",
        "place/miette-hot-springs",
      ],
      {
        where: { mode: "trip", cc: "CA", regions: ["CA/alberta"] },
        nights: 7,
        month: 8,
        origin: { kind: "airport", iata: "YYC" },
        party: { adults: 2, children: [9], walkKm: null },
        bases: [
          { town: "ca-ab-banff", nights: 3, pinned: true },
          { town: "ca-ab-jasper", nights: null, pinned: false },
        ],
      },
    ),
    {
      places: placesMap(places),
      towns: [
        mkTown("ca-ab-banff", "Banff", 51.1784, -115.5708, 7851, 3),
        mkTown("ca-ab-canmore", "Canmore", 51.0884, -115.3479, 15990, 3),
        mkTown("ca-ab-lake-louise", "Lake Louise", 51.4254, -116.1773, 700, 2),
        mkTown("ca-ab-jasper", "Jasper", 52.8737, -118.0814, 4590, 3),
      ],
      start: null,
      gateway: pt(51.1215, -114.0076), // Calgary airport (YYC), a public point
      tz: "America/Edmonton",
    },
  ),
};
