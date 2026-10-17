// name -> implementation of every write operation this phase implements
import { PLAN_OPS } from "./plan.ts";
import { makeProposalOps } from "./proposals.ts";
import { ROW_OPS } from "./rows.ts";
import { TRIP_OPS } from "./trip.ts";
import type { WriteOp } from "./types.ts";

export const WRITE_OPS: Record<string, WriteOp> = { ...TRIP_OPS, ...PLAN_OPS, ...ROW_OPS };
Object.assign(WRITE_OPS, makeProposalOps(() => WRITE_OPS));
