// Day-number plumbing shared by day.add, day.remove and day.swap: every table that stores a day number moves together.
import { shapeForNights } from "../validate/trip.ts";
import { OpError } from "./types.ts";
import type { Row } from "./types.ts";
import { rows } from "./helpers.ts";

/** map a day number to its new number; null drops it from lists and clears optional columns (rows of a removed day are deleted first) */
export type DayMap = (n: number) => number | null;

const mapList = (list: unknown, f: DayMap): number[] => (Array.isArray(list) ? (list as number[]).map(f).filter((x): x is number => x !== null) : []);

/**
 * Apply `f` to every stored day number. `keepLodging` leaves lodging bookings (those with a base_id) alone: they are tied to
 * the nights at a base, not to what happens on a day.
 */
export function mapDays(doc: Row, f: DayMap, opts: { keepLodging?: boolean } = {}): void {
  const one = (n: number): number => f(n) ?? n;
  for (const d of rows(doc, "days")) d.n = one(d.n);
  for (const t of rows(doc, "day_tracks")) t.day = one(t.day);
  for (const it of rows(doc, "items")) it.day = one(it.day);
  for (const a of rows(doc, "trip_activities")) if (a.day !== null) a.day = f(a.day);
  for (const w of rows(doc, "weather_rules")) {
    if (w.day !== null) w.day = f(w.day);
    if (w.plan_b_day !== null) w.plan_b_day = f(w.plan_b_day);
  }
  for (const h of rows(doc, "hazards")) h.days = mapList(h.days, f);
  for (const r of rows(doc, "routes")) r.days = mapList(r.days, f);
  for (const b of rows(doc, "trip_bookings")) if (!(opts.keepLodging && b.base_id)) b.used_days = mapList(b.used_days, f);
  for (const n of rows(doc, "notes")) if (n.scope === "day" && n.ref !== null) {
    const m = f(Number(n.ref));
    n.ref = m === null ? null : String(m);
  }
}

/** the trip's invariants that follow the day count: edition ends */
export function syncEditionEnds(doc: Row): void {
  const count = rows(doc, "days").filter((d) => d.n >= 1).length;
  for (const e of rows(doc, "editions")) {
    const [y, m, d] = String(e.start).split("-").map(Number) as [number, number, number];
    e.end = new Date(Date.UTC(y, m - 1, d + count - 1)).toISOString().slice(0, 10);
  }
}

export const baseCovering = (doc: Row, night: number): Row | undefined => rows(doc, "bases").find((b) => b.night_from <= night && night < b.night_from + b.nights);

function setNights(doc: Row): void {
  const total = rows(doc, "bases").reduce((a, b) => a + b.nights, 0);
  doc.trip.nights = total;
  doc.trip.duration_shape = shapeForNights(total);
}

/** a night was added at `night` (1-based, the night after day `night`): the base that covers it grows */
export function growNight(doc: Row, night: number): Row {
  const bases = rows(doc, "bases");
  let b = baseCovering(doc, night) ?? baseCovering(doc, night - 1) ?? bases[0];
  if (!b) {
    b = {
      id: "base-1", name: doc.trip.region_label || doc.trip.title, place_id: null, stay_id: null, lodging: null, night_from: 1, nights: 0,
      lat: null, lon: null, tz: doc.trip.origin_tz, elevation_m: null, why: "", why_not: "",
    };
    bases.push(b);
  }
  b.nights += 1;
  for (const o of bases) if (o !== b && o.night_from > b.night_from) o.night_from += 1;
  setNights(doc);
  return b;
}

/** the night at `night` was removed: its base shrinks, and disappears at zero */
export function shrinkNight(doc: Row, night: number): void {
  const b = baseCovering(doc, night);
  if (!b) return;
  b.nights -= 1;
  for (const o of rows(doc, "bases")) if (o !== b && o.night_from > b.night_from) o.night_from -= 1;
  if (b.nights === 0) {
    doc.bases = rows(doc, "bases").filter((x) => x !== b);
    for (const d of rows(doc, "days")) if (d.base_id === b.id) d.base_id = null;
    for (const it of rows(doc, "items")) if (it.base_id === b.id) it.base_id = null;
  }
  setNights(doc);
}

export function dayRow(doc: Row, n: number): Row {
  const d = rows(doc, "days").find((x) => x.n === n);
  if (!d) throw new OpError("E_NOT_FOUND", `trip "${doc.id}" has no day ${n}. Its days are ${rows(doc, "days").map((x) => x.n).join(", ")}.`);
  return d;
}
