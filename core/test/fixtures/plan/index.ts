// The four golden families of TB-G1 and the three multi-base ones of TB-E2 (see README.md). `GOLDENS` is the list the golden test pins;
// the infeasible family has two builds.
import { algonquin } from "./algonquin.ts";
import { daytrip } from "./daytrip.ts";
import { infeasibleClosed, infeasibleTime } from "./infeasible.ts";
import { infeasibleMove } from "./infeasible-move.ts";
import { quebec } from "./quebec.ts";
import { roadtrip } from "./roadtrip.ts";
import { rockies } from "./rockies.ts";
import type { GoldenCase } from "./types.ts";

export const GOLDENS: readonly GoldenCase[] = [quebec, algonquin, daytrip, infeasibleTime, infeasibleClosed, rockies, roadtrip, infeasibleMove];
export { algonquin, daytrip, infeasibleClosed, infeasibleMove, infeasibleTime, quebec, roadtrip, rockies };
export type { GoldenCase };
