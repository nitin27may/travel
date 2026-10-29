// Golden 7 (TB-E2): a three-base road trip with a long move day. Trip mode, no airport (the trip starts and ends at its first and
// last bases), 6 nights in July, at most 4 h of driving a day: Ottawa 2 nights, Quebec City 2, Tadoussac with its nights open (2).
// Ottawa to Quebec City is over the 4 h, so that move day carries a Check; Niagara Falls is beyond every base's reach (TB_TOO_FAR,
// Ottawa the nearest, St. Catharines offered as a base near it).
import { mkBuild, mkInput, mkPlace, mkTown, placesMap } from "../../plan/engine-fixture.ts";
import type { GoldenCase } from "./types.ts";

const places = [
  mkPlace("place/parliament-hill", 45.4236, -75.7009, { kind: "sight", visitMin: 120, draw: "journey", region: "ontario" }),
  mkPlace("place/byward-market", 45.429, -75.692, { kind: "sight", visitMin: 90, draw: "local", region: "ontario" }),
  mkPlace("place/pink-lake", 45.4669, -75.8072, { kind: "lake", visitMin: 60, draw: "detour", region: "quebec" }),
  mkPlace("place/old-quebec", 46.8123, -71.2045, { kind: "sight", visitMin: 150, draw: "journey", region: "quebec" }),
  mkPlace("place/montmorency-falls", 46.8908, -71.1488, { kind: "waterfall", visitMin: 75, draw: "journey", region: "quebec" }),
  mkPlace("place/tadoussac-whale-watching", 48.14, -69.716, { kind: "activity", visitMin: 180, draw: "journey", region: "quebec" }),
  mkPlace("place/saguenay-fjord-lookout", 48.27, -69.93, { kind: "viewpoint", visitMin: 60, draw: "detour", region: "quebec" }),
  mkPlace("place/niagara-falls", 43.0896, -79.0849, { kind: "sight", visitMin: 120, draw: "journey", region: "ontario" }),
];

export const roadtrip: GoldenCase = {
  name: "roadtrip-three-base",
  input: mkInput(
    mkBuild(
      [
        { ref: "place/parliament-hill", must: true },
        "place/byward-market",
        "place/pink-lake",
        { ref: "place/old-quebec", must: true },
        "place/montmorency-falls",
        { ref: "place/tadoussac-whale-watching", must: true },
        "place/saguenay-fjord-lookout",
        "place/niagara-falls",
      ],
      {
        where: { mode: "trip", cc: "CA", regions: ["CA/ontario", "CA/quebec"] },
        nights: 6,
        month: 7,
        driveDayMin: 240,
        bases: [
          { town: "ca-on-ottawa", nights: 2, pinned: true },
          { town: "ca-qc-quebec", nights: 2, pinned: true },
          { town: "ca-qc-tadoussac", nights: null, pinned: false },
        ],
      },
    ),
    {
      places: placesMap(places),
      towns: [
        mkTown("ca-on-ottawa", "Ottawa", 45.4215, -75.6972, 1017449, 3),
        mkTown("ca-qc-montreal", "Montreal", 45.5017, -73.5673, 1762949, 3),
        mkTown("ca-qc-quebec", "Quebec City", 46.8139, -71.208, 549459, 3),
        mkTown("ca-qc-tadoussac", "Tadoussac", 48.145, -69.717, 800, 2),
        mkTown("ca-on-st-catharines", "St. Catharines", 43.1594, -79.2469, 133113, 2),
      ],
      start: null,
      gateway: null,
      tz: "America/Toronto",
    },
  ),
};
