// The built plan's two summary lines (FLOW stage 5 "Checks" and TF16 "Known costs"; edit-mode-spec Summary; task TB-E1), derived
// from a build, never stored: "1 h 25 driving a day ≈ · 1 move · 2 to check" and "3 of 9 places priced · 2 free". Pure.
import type { PlanOutputs } from "../schema/plan-draft.ts";
import { warnCounts } from "./warnings.ts";

type Outputs = Pick<PlanOutputs, "basis" | "bases" | "days" | "didNotFit"> & Partial<Pick<PlanOutputs, "areas">>;

export interface BuildChecks {
  days: number;
  /** driving on every day, in all, minutes (into each stop and back) */
  driveTotalMin: number;
  /** the mean over the days that drive at all, rounded; 0 when none does */
  driveDayAvgMin: number;
  driveDayMaxMin: number;
  /** move days (K = 1 plans have none) */
  moves: number;
  /** true when any figure is a straight-line estimate (≈) */
  estimated: boolean;
  /** day checks, did-not-fit codes and area checks (TB_AREA_EMPTY) at the shown levels (warnings.ts) */
  fix: number;
  check: number;
  didNotFit: number;
}

const dayDrive = (d: Outputs["days"][number]): number => d.items.reduce((n, i) => n + (i.driveMin ?? 0), 0) + (d.returnMin ?? 0);

export function buildChecks(b: Outputs): BuildChecks {
  const drives = b.days.map(dayDrive);
  const driving = drives.filter((x) => x > 0);
  const total = drives.reduce((n, x) => n + x, 0);
  const areaCodes = (b.areas ?? []).flatMap((a) => (a.code ? [a.code] : []));
  const counts = warnCounts([...b.days.flatMap((d) => d.warnings), ...b.didNotFit.map((m) => m.code), ...areaCodes]);
  return {
    days: b.days.length,
    driveTotalMin: total,
    driveDayAvgMin: driving.length ? Math.round(total / driving.length) : 0,
    driveDayMaxMin: driving.length ? Math.max(...driving) : 0,
    moves: b.days.filter((d) => d.move).length,
    estimated: b.basis !== "routed",
    fix: counts.fix,
    check: counts.check,
    didNotFit: b.didNotFit.length,
  };
}

export interface KnownCosts {
  /** placed stops with a known price band */
  priced: number;
  /** of the placed stops */
  of: number;
  /** placed stops known to be free (the Free chip) */
  free: number;
}

/** Known costs over the placed stops only (TF16): a band is known or not; a total over gaps is never made. */
export function knownCosts(b: Pick<PlanOutputs, "days">, priceBand: (ref: string) => string | null): KnownCosts {
  const refs = b.days.flatMap((d) => d.items.map((i) => i.ref));
  const bands = refs.map(priceBand);
  return { priced: bands.filter((x) => x !== null).length, of: refs.length, free: bands.filter((x) => x === "free").length };
}
