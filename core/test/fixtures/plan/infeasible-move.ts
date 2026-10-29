// Golden 8 (TB-E2): an infeasible move. Two bases the visitor pinned, Huntsville and Thunder Bay, 2 nights each in August: the move
// between them is longer than a whole day at the standard pace. The move day stays (never a silent drop), carries no stop, a Check
// (W_DRIVE_LIMIT) and "add a base between"; each base's picks are still planned on its own days.
import { mkBuild, mkInput, mkPlace, mkTown, placesMap } from "../../plan/engine-fixture.ts";
import type { GoldenCase } from "./types.ts";

const places = [
  mkPlace("place/arrowhead", 45.3907, -79.2129, { kind: "lake", draw: "detour" }),
  mkPlace("place/ragged-falls", 45.3897, -78.9123, { kind: "waterfall", visitMin: 40, draw: "local" }),
  mkPlace("place/kakabeka-falls", 48.4033, -89.6236, { kind: "waterfall", visitMin: 60, draw: "journey" }),
  mkPlace("route/top-of-the-giant-trail", 48.3833, -88.85, { kind: "trail", visitMin: 300, draw: "journey" }),
];

export const infeasibleMove: GoldenCase = {
  name: "infeasible-move",
  input: mkInput(
    mkBuild(["place/arrowhead", "place/ragged-falls", { ref: "place/kakabeka-falls", must: true }, "route/top-of-the-giant-trail"], {
      where: { mode: "trip", cc: "CA", regions: ["CA/ontario"] },
      nights: 4,
      month: 8,
      bases: [
        { town: "ca-on-huntsville", nights: 2, pinned: true },
        { town: "ca-on-thunder-bay", nights: 2, pinned: true },
      ],
    }),
    {
      places: placesMap(places),
      towns: [
        mkTown("ca-on-huntsville", "Huntsville", 45.3269, -79.2168, 19816, 2),
        mkTown("ca-on-thunder-bay", "Thunder Bay", 48.3809, -89.2477, 108843, 3),
      ],
      start: null,
      gateway: null,
    },
  ),
};
