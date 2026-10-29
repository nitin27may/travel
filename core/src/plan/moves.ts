// The days of a plan with several bases, and the check on each move (trip-builder.md 4.5, 4.6; FLOW stage 5 "1 move"; task TB-E2).
// Pure. Base i sleeps its nights in a row, in the visitor's order; the day after a base's last night is a MOVE DAY that starts at that
// base and ends at the next one (`transfer` for the scheduler), so a move day only ever sits between two consecutive bases. Day 1 is
// the arrival at the first base, the last day the departure from the last base.
//
// Each day belongs to one base for packing (its picks go on that base's days): the base slept at after it, and the last day to the
// last base. A move day therefore takes stops of the base it moves INTO, on the way or near it. The move's own drive is the day's
// direct way, so the packer's budgets are what is left of the day after it, and its drive cap is `driveDayMin` less the move.
import { BUILDER_PACK } from "../config/builder.ts";
import type { DayKind } from "../schedule/types.ts";
import type { PlanReason } from "../schema/plan-draft.ts";
import type { DriveTable } from "./driveTable.ts";
import type { PackDay } from "./pack.ts";
import * as R from "./reasons.ts";

export interface MultiDay extends PackDay {
  kind: DayKind;
  /** the route index whose picks this day takes */
  owner: number;
  /** the route index slept at after this day; null on the last day */
  sleeps: number | null;
  move: boolean;
  /** a move day's direct drive from base to base (null: no road we know of), and whether it is routed */
  moveMin: number | null;
  moveRouted: boolean;
}

/**
 * The day frame of a route of bases with their nights (each at least 1, summing to `nights`). `inNode` is where day 1 starts (the
 * start, the gateway, else the first base) and `outNode` where the last day ends (the start, the gateway, else the last base).
 */
export function routeFrame(a: {
  route: readonly { node: string; nights: number }[];
  nights: number;
  inNode: string;
  outNode: string;
  /** the day's cap less the lunch allowance */
  dayMin: number;
  /** the longest drive in one day (`driveDayMin`, else the pace's) */
  driveMin: number;
  /** an arrival or departure day's share of the day (BUILDER_PACK.edgeDayShare) */
  edgeShare: number;
  table: DriveTable;
}): MultiDay[] {
  const sleepsAt: number[] = [];
  a.route.forEach((r, i) => {
    for (let k = 0; k < r.nights; k++) sleepsAt.push(i);
  });
  const last = a.route.length - 1;
  const edgeBudget = (from: string, to: string): number => Math.max(0, Math.round(a.dayMin * a.edgeShare) - (from === to ? 0 : a.table.minutes(from, to) ?? 0));
  const out: MultiDay[] = [];
  for (let day = 1; day <= a.nights + 1; day++) {
    const before = day === 1 ? null : sleepsAt[day - 2]!;
    const after = day <= a.nights ? sleepsAt[day - 1]! : null;
    const from = before === null ? a.inNode : a.route[before]!.node;
    const to = after === null ? a.outNode : a.route[after]!.node;
    const owner = after ?? last;
    const common = { day, from, to, owner, sleeps: after };
    if (day === 1) {
      out.push({ ...common, kind: "arrival", budgetMin: edgeBudget(from, to), driveCapMin: a.driveMin, move: false, moveMin: null, moveRouted: false });
    } else if (after === null) {
      out.push({ ...common, kind: "departure", budgetMin: edgeBudget(from, to), driveCapMin: a.driveMin, move: false, moveMin: null, moveRouted: false });
    } else if (before !== after) {
      const c = a.table.get(from, to);
      const room = c.min === null ? 0 : Math.max(0, a.dayMin - c.min);
      out.push({ ...common, kind: "transfer", budgetMin: room, driveCapMin: c.min === null ? 0 : Math.max(0, a.driveMin - c.min), move: true, moveMin: c.min, moveRouted: c.routed });
    } else {
      out.push({ ...common, kind: "normal", budgetMin: a.dayMin, driveCapMin: a.driveMin, move: false, moveMin: null, moveRouted: false });
    }
  }
  return out;
}

/**
 * What a move day says (4.9) and the checks it raises: the move with its drive; a move over the day's driving (`driveDayMin`) is a
 * Check (W_DRIVE_LIMIT, "break the drive"); a move longer than the whole day at the party's pace is infeasible as one day (W_DRIVE_LIMIT,
 * "add a base between"), and no road at all is W_NO_ROUTE (Fix). Never a silent drop: the move day stays, with nothing else on it.
 */
export function moveCheck(m: { fromName: string; toName: string; min: number | null; routed: boolean; driveMin: number; dayMin: number }): { reasons: PlanReason[]; warnings: string[] } {
  if (m.min === null) return { reasons: [R.moveNoRoad(m.fromName, m.toName)], warnings: ["W_NO_ROUTE"] };
  const est = !m.routed;
  const reasons = [R.dayMove(m.fromName, m.toName, m.min, est)];
  const warnings: string[] = [];
  if (m.min > m.dayMin) {
    reasons.push(R.moveOverDay(m.min, m.dayMin, est));
    warnings.push("W_DRIVE_LIMIT");
  } else if (m.min > m.driveMin) {
    reasons.push(R.moveLong(m.min, m.driveMin, est));
    warnings.push("W_DRIVE_LIMIT");
  }
  return { reasons, warnings };
}

/** Kept here so a client re-flow (TB-E4) reads the same share as the server. */
export const edgeShareOf = (near: boolean): number => BUILDER_PACK.edgeDayShare[near ? "near" : "trip"];
