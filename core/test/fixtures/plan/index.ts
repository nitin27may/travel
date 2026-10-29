// The four golden families of TB-G1 (see README.md). `GOLDENS` is the list the golden test pins; the infeasible family has two builds.
import { algonquin } from "./algonquin.ts";
import { daytrip } from "./daytrip.ts";
import { infeasibleClosed, infeasibleTime } from "./infeasible.ts";
import { quebec } from "./quebec.ts";
import type { GoldenCase } from "./types.ts";

export const GOLDENS: readonly GoldenCase[] = [quebec, algonquin, daytrip, infeasibleTime, infeasibleClosed];
export { algonquin, daytrip, infeasibleClosed, infeasibleTime, quebec };
export type { GoldenCase };
