// Golden 4: infeasible. Two builds on one catalogue: (a) too many must-sees for the days (TB_TIME, TB_TOO_FAR), and (b) a closed
// season (TB_CLOSED, January). Did not fit must list exactly the unplaced picks, each with a code, a fix and a reason with numbers.
import { mkBuild, mkInput, mkPlace, mkTown, ONT, placesMap } from "../../plan/engine-fixture.ts";
import type { GoldenCase } from "./types.ts";

const big = Array.from({ length: 8 }, (_, i) => mkPlace(`place/long-visit-${i}`, 45.33 + i * 0.01, -79.1 - i * 0.005, { kind: "sight", visitMin: 240, draw: "journey" }));
const places = [...big, mkPlace("place/parliament-hill", 45.4236, -75.7009, { kind: "sight", visitMin: 120 }), mkPlace("place/arrowhead", 45.3907, -79.2129, { kind: "lake" })];
const towns = [...ONT.towns, mkTown("ca-on-ottawa", "Ottawa", 45.4215, -75.6972, 1000000, 3)];

export const infeasibleTime: GoldenCase = {
  name: "infeasible-time",
  input: mkInput(
    mkBuild([...big.map((p) => ({ ref: p.ref, must: true })), { ref: "place/parliament-hill", must: true }], { nights: 1 }),
    { places: placesMap(places), towns },
  ),
};

// January: the three summer places are closed; the winter place and the sugar bush (Feb to Apr, a shoulder month) are not.
const winter = [
  mkPlace("place/ice-fishing-huts", 45.2, -79.4, { kind: "activity", visitMin: 120, season: [12, 1, 2, 3] }),
  mkPlace("place/sugar-bush", 45.1, -79.3, { kind: "sight", visitMin: 90, season: [2, 3, 4] }),
];
export const infeasibleClosed: GoldenCase = {
  name: "infeasible-closed",
  input: mkInput(
    mkBuild(["place/arrowhead", "place/oxtongue-lake", "place/ragged-falls", "place/ice-fishing-huts", "place/sugar-bush"], { nights: 1, month: 1 }),
    { places: placesMap([...ONT.places, ...winter]), towns },
  ),
};
