// Turns a day's ordered stops into a timeline: when each stop starts and ends, the legs between them,
// free time, clashes, and when you leave and get back. Fixed times win; others flow from the previous end.
import type { Place } from "../data/places";
import type { Item } from "../data/trip";
import { leg, type Leg } from "./geo";

export interface Slot {
  item: Item; place: Place;
  start: number; end: number;          // minutes after midnight
  fixed: boolean;                      // the time was set by the user (or a booking)
  legIn?: Leg & { from: Place };       // travel to reach this stop
  free?: number;                       // idle minutes before travel to this stop starts
  late?: number;                       // minutes this stop starts after its fixed time because travel doesn't fit
}
export interface Timeline { leave?: number; back?: number; legHome?: Leg; slots: Slot[] }

export const hm = (t?: string) => { if (!t) return undefined; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const clock = (m: number) => { const x = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };

export function timeline(stops: { item: Item; place: Place }[], start?: Place, end?: Place): Timeline {
  const slots: Slot[] = [];
  let at: number | undefined; let prev = start;
  for (const s of stops) {
    // starting a walk from its own trailhead or car park is a short walk, not a drive to the destination
    const l = prev ? (s.place.trailhead === prev.id ? { mode: "walk" as const, min: 2, km: 0.1 } : leg(prev, s.place)) : undefined;
    const fixedAt = hm(s.item.time);
    const arrive = at !== undefined ? at + (l?.min ?? 0) : undefined;
    let begin: number; let free: number | undefined; let late: number | undefined;
    if (fixedAt !== undefined) {
      begin = fixedAt;
      if (arrive !== undefined) { if (arrive > fixedAt) late = arrive - fixedAt; else free = fixedAt - arrive; }
    } else begin = arrive ?? 9 * 60;
    const dur = s.place.durationMin ?? 60;
    slots.push({ item: s.item, place: s.place, start: begin, end: begin + dur, fixed: fixedAt !== undefined, legIn: l && prev ? { ...l, from: prev } : undefined, free: free && free >= 20 ? free : undefined, late });
    at = begin + dur; prev = s.place;
  }
  const first = slots[0];
  const leave = first?.legIn ? first.start - first.legIn.min : first?.start;
  const legHome = prev && end && prev !== end ? leg(prev, end) : undefined;
  const back = at !== undefined ? at + (legHome?.min ?? 0) : undefined;
  return { leave, back, legHome, slots };
}
