// name -> implementation of every write operation this phase implements
import type { WriteOp } from "./types.ts";
import { TRIP_OPS } from "./trip.ts";

export const WRITE_OPS: Record<string, WriteOp> = { ...TRIP_OPS };
