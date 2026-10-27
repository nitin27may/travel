// The modifiers of driving-time-model.md 4.4, as pure functions with their parameters passed in (read from data/reference/drive by
// load.ts). Each answers the minutes it adds (or the factor it applies) and the flag it raises; none reads a file, a clock or the network.
// The model (model.ts) applies them to L2; TB-L applies the same functions on top of routed values (L0, L1), except city entry.
import { DRIVE_MODEL } from "../config/drive.ts";
import type { AreaRow, CrossingRow, ProfileRow, SegmentRow } from "./schema.ts";
import type { DriveFlag, DriveVehicle, ModelPoint } from "./types.ts";

export interface ModifierResult {
  minutes: number;
  flags: DriveFlag[];
  note: string;
}

const none = (): ModifierResult => ({ minutes: 0, flags: [], note: "" });

/** True when the rule holds in `month`; a rule with no months holds all year. Unknown month: null (caller decides). */
export function inMonths(months: readonly number[] | undefined | null, month: number | undefined): boolean | null {
  if (!months || months.length === 0) return true;
  if (month === undefined) return null;
  return months.includes(month);
}

/** City entry (L2 only): minutes per end inside a large town (spec 4.4). */
export function cityEntryMin(populations: readonly (number | null | undefined)[], rows: readonly { pop: number; min: number }[] = DRIVE_MODEL.cityEntry): ModifierResult {
  let minutes = 0;
  for (const p of populations) {
    if (typeof p !== "number") continue;
    const hit = rows.find((r) => p >= r.pop);
    if (hit) minutes += hit.min;
  }
  return { minutes, flags: [], note: minutes ? `city entry +${minutes} min` : "" };
}

/**
 * Border wait when the two ends are in different countries: the destination's minutes for the origin neighbour, else the origin's
 * row for the destination; a pair no row names adds nothing but still raises the chip (the wait is unknown, the crossing is not).
 */
export function borderMin(fromCc: string | null, toCc: string | null, fromRow: ProfileRow | null, toRow: ProfileRow | null): ModifierResult {
  if (!fromCc || !toCc || fromCc === toCc) return none();
  const m = toRow?.borderDefaultMin[fromCc] ?? fromRow?.borderDefaultMin[toCc] ?? 0;
  return { minutes: m, flags: ["border"], note: `border ${fromCc} to ${toCc} +${m} min` };
}

/** The crossing row for an area pair (either direction when symmetric), or null. */
export function crossingFor(rows: readonly CrossingRow[], fromArea: string | null | undefined, toArea: string | null | undefined): CrossingRow | null {
  if (!fromArea || !toArea || fromArea === toArea) return null;
  return rows.find((r) => (r.from === fromArea && r.to === toArea) || (r.symmetric && r.from === toArea && r.to === fromArea)) ?? null;
}

/** Ferry: sailing + check-in (the row's, else the country's, else the default) + half the headway of the month. */
export function ferryMin(row: CrossingRow, month: number | undefined, countryCheckin: number | null): ModifierResult {
  const checkin = row.checkinMin ?? countryCheckin ?? DRIVE_MODEL.ferryCheckinDefaultMin;
  const headway = month !== undefined ? (row.headwayMin?.[String(month)] ?? 0) : 0;
  const minutes = row.minutes + checkin + Math.round(headway / 2);
  return { minutes, flags: ["ferry"], note: `ferry ${row.id} +${minutes} min` };
}

/** A direct way closed in some months: the way round in those months; the chip alone when the month is unknown. */
export function closedSeasonMin(row: CrossingRow, month: number | undefined): ModifierResult {
  const holds = inMonths(row.months, month);
  if (holds === false) return none();
  return { minutes: holds ? row.minutes : 0, flags: ["closed-season"], note: holds ? `closed in season, the way round +${row.minutes} min` : "may be closed in season" };
}

/**
 * Winter: the driving minutes are divided by the factor in the country's winter months. An area's own factor (mountain areas)
 * replaces the country's when it is lower. Returns the factor (1 when none applies).
 */
export function winterFactor(month: number | undefined, profiles: readonly (ProfileRow | null)[], areas: readonly (AreaRow | null)[]): { factor: number; flags: DriveFlag[] } {
  if (month === undefined) return { factor: 1, flags: [] };
  let factor = 1;
  for (const p of profiles) if (p?.winter && p.winter.months.includes(month)) factor = Math.min(factor, p.winter.factor);
  if (factor === 1) return { factor, flags: [] };
  for (const a of areas) if (a?.winterFactor != null) factor = Math.min(factor, a.winterFactor);
  return { factor, flags: ["winter"] };
}

/** The share of road km on unpaved roads (the mean of the two ends' areas) and the time of a leg at `kmh` with that share capped. */
export function unpavedMinutes(roadKm: number, kmh: number, share: number, cap: number = DRIVE_MODEL.unpavedCapKmh): number {
  const s = Math.min(1, Math.max(0, share));
  return roadKm * ((1 - s) / kmh + s / Math.min(kmh, cap)) * 60;
}

/** What an authored segment does to a leg (spec 5.5). `stop` ends the estimate (no road for this vehicle or season). */
export type SegmentEffect =
  | { kind: "stop"; flags: DriveFlag[]; note: string }
  | { kind: "fixed"; minutes: number; flags: DriveFlag[]; note: string }
  | { kind: "factor"; factor: number; flags: DriveFlag[]; note: string }
  | { kind: "warn"; flags: DriveFlag[]; note: string };

/** The segments that serve either end of a leg: a row whose refs hold an end's `r:` key. */
export function segmentsFor(rows: readonly SegmentRow[], a: ModelPoint, b: ModelPoint): SegmentRow[] {
  const refs = [a.key, b.key].filter((k): k is NonNullable<typeof k> => typeof k === "string" && k.startsWith("r:")).map((k) => k.slice(2));
  if (refs.length === 0) return [];
  return rows.filter((r) => r.refs?.some((x) => refs.includes(x)));
}

export function segmentEffect(row: SegmentRow, month: number | undefined, vehicle: DriveVehicle): SegmentEffect | null {
  const holds = inMonths(row.months, month);
  if (holds === false) return null;
  const seasonal = row.months !== undefined;
  if (holds === null) return { kind: "warn", flags: seasonal && row.rule === "closed" ? ["closed-season"] : [], note: `${row.note} (month unknown)` };
  switch (row.rule) {
    case "closed":
      return { kind: "stop", flags: [seasonal ? "closed-season" : "no-road"], note: row.note };
    case "4x4":
      return vehicle === "4x4" ? { kind: "warn", flags: ["4x4"], note: row.note } : { kind: "stop", flags: ["4x4", "no-road"], note: row.note };
    case "slow":
      return { kind: "factor", factor: row.factor ?? 1, flags: [], note: row.note };
    case "fixed":
      return { kind: "fixed", minutes: row.minutes ?? 0, flags: [], note: row.note };
  }
}
