// Sun anchors over a season window (spec 2.8, D7). Public pages show a range across the window; the scheduler uses the
// middle of it as the reference. Built on core/src/sun (sunDay): never a second sun formula.
import { fmtMin } from "../checks/time.ts";
import { sunDay, type SunEvent } from "../sun/index.ts";
import type { Point, SunEventId, SunWindow } from "./types.ts";

export interface SunRange {
  /** Minutes after local midnight: the earliest and the latest across the window. */
  lo: number;
  hi: number;
  mid: number;
}
export interface SunRef {
  state: "normal" | "never-sets" | "never-rises";
  sunrise: SunRange;
  sunset: SunRange;
  civilDusk: SunRange;
}

const REF_YEAR = 2027;
const iso = (m: number, d: number): string => `${REF_YEAR}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Dates sampled across the window: both ends and a step of five days between. Wraps the year for a Dec-Jan window. */
function sampleDates(w: SunWindow): string[] {
  const out: string[] = [];
  const start = Date.UTC(REF_YEAR, w.from[0] - 1, w.from[1]);
  let end = Date.UTC(REF_YEAR, w.to[0] - 1, w.to[1]);
  if (end < start) end = Date.UTC(REF_YEAR + 1, w.to[0] - 1, w.to[1]);
  for (let t = start; t < end; t += 5 * 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  out.push(new Date(end).toISOString().slice(0, 10));
  return out;
}

const range = (xs: number[]): SunRange => {
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return { lo, hi, mid: Math.round((lo + hi) / 2) };
};

/** Sunrise, sunset and civil dusk across the window at a point, or a polar state with no times. */
export function sunReference(point: Point, tz: string, window: SunWindow): SunRef {
  const rises: number[] = [];
  const sets: number[] = [];
  const dusks: number[] = [];
  let state: SunRef["state"] = "normal";
  for (const date of sampleDates(window)) {
    const d = sunDay(point.lat, point.lon, date, tz);
    const e: SunEvent = d.sunrise;
    if (e.kind !== "normal") {
      state = e.kind;
      continue;
    }
    rises.push(e.rise);
    sets.push(e.set);
    if (d.civil.kind === "normal") dusks.push(d.civil.set);
    else dusks.push(e.set + 60);
  }
  if (!rises.length) {
    const zero: SunRange = { lo: 0, hi: 0, mid: 0 };
    return { state, sunrise: zero, sunset: zero, civilDusk: zero };
  }
  return { state, sunrise: range(rises), sunset: range(sets), civilDusk: range(dusks) };
}

/** The minute and the "HH:MM" range for an anchor like "sunset, -40 min". */
export function anchorTime(ref: SunRef, to: SunEventId | "golden-pm", offsetMin: number): { mid: number; range: [string, string] } | null {
  if (ref.state !== "normal") return null;
  const r = to === "sunrise" ? ref.sunrise : to === "civil-dusk" ? ref.civilDusk : ref.sunset;
  const off = to === "golden-pm" ? offsetMin - 60 : offsetMin;
  return { mid: r.mid + off, range: [fmtMin(r.lo + off), fmtMin(r.hi + off)] };
}
