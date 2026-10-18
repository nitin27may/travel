// Prototype store. Every change is an operation; the store keeps the state before it so Undo works the way
// the platform's op inverses will (docs/v2/design/interactions.md section 6).
import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import { PLACE, type Place } from "../data/places";
import { TRIP, type Item, type Trip } from "../data/trip";
import { leg, type Leg } from "../lib/geo";

export type Target = { day: number } | { list: string };
export interface State {
  trip: Trip;
  custom: Record<string, Place>;
  past: { trip: Trip; custom: Record<string, Place>; label: string }[];
  selected?: string;            // item id
  focusDay?: number;
  mapDay?: number;              // the day the map is filtered to; undefined shows every day
  toast?: { id: number; text: string; undo: boolean };
}

type Action =
  | { t: "op"; label: string; trip: Trip; custom?: Record<string, Place>; select?: string; focusDay?: number }
  | { t: "undo" }
  | { t: "select"; id?: string; focusDay?: number }
  | { t: "focus"; day?: number }
  | { t: "mapDay"; day?: number }
  | { t: "toast"; text?: string };

let toastId = 0;
function reducer(s: State, a: Action): State {
  switch (a.t) {
    case "op": return { ...s, past: [...s.past.slice(-40), { trip: s.trip, custom: s.custom, label: a.label }], trip: a.trip, custom: a.custom ?? s.custom,
      selected: a.select ?? s.selected, focusDay: a.focusDay ?? s.focusDay, toast: { id: ++toastId, text: a.label, undo: true } };
    case "undo": { const p = s.past[s.past.length - 1]; if (!p) return s;
      return { ...s, trip: p.trip, custom: p.custom, past: s.past.slice(0, -1), toast: { id: ++toastId, text: `Undid: ${p.label}`, undo: false } }; }
    case "select": return { ...s, selected: a.id, focusDay: a.focusDay ?? s.focusDay };
    case "focus": return { ...s, focusDay: a.day };
    case "mapDay": return { ...s, mapDay: a.day, focusDay: a.day ?? s.focusDay };
    case "toast": return { ...s, toast: a.text ? { id: ++toastId, text: a.text, undo: false } : undefined };
  }
}

const removeFrom = (trip: Trip, id: string): Trip => ({
  ...trip,
  days: trip.days.map(d => d.itemIds.includes(id) ? { ...d, itemIds: d.itemIds.filter(x => x !== id) } : d),
  lists: trip.lists.map(l => l.itemIds.includes(id) ? { ...l, itemIds: l.itemIds.filter(x => x !== id) } : l),
});
const insertAt = (trip: Trip, id: string, to: Target, index?: number): Trip => {
  const ins = (ids: string[]) => { const c = [...ids]; c.splice(index ?? c.length, 0, id); return c; };
  return "day" in to
    ? { ...trip, days: trip.days.map(d => d.n === to.day ? { ...d, itemIds: ins(d.itemIds) } : d) }
    : { ...trip, lists: trip.lists.map(l => l.id === to.list ? { ...l, itemIds: ins(l.itemIds) } : l) };
};
export const containerOf = (trip: Trip, id: string): Target | undefined => {
  const d = trip.days.find(d => d.itemIds.includes(id)); if (d) return { day: d.n };
  const l = trip.lists.find(l => l.itemIds.includes(id)); if (l) return { list: l.id };
};
export const targetLabel = (trip: Trip, t: Target) => "day" in t ? `Day ${t.day}` : trip.lists.find(l => l.id === t.list)?.name ?? "list";

let seq = 1000;
interface Ctx {
  s: State;
  place: (id: string) => Place | undefined;
  itemPlace: (it: Item) => Place | undefined;
  add: (p: Place, to: Target, opts?: { time?: string; index?: number }) => string;
  move: (id: string, to: Target, index?: number, time?: string) => void;
  remove: (id: string) => void;
  setBase: (day: number, placeId: string | undefined, through?: number) => void;
  movePin: (placeId: string, lng: number, lat: number) => void;
  setTime: (id: string, time?: string) => void;
  select: (id?: string, focusDay?: number) => void;
  focus: (day?: number) => void;
  /** filter the map to one day (and focus it), or pass nothing to show every day */
  showDay: (day?: number) => void;
  undo: () => void;
  toast: (text?: string) => void;
}
const C = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, dispatch] = useReducer(reducer, { trip: TRIP, custom: {}, past: [], focusDay: 2 });
  const place = useCallback((id: string) => PLACE[id] ?? s.custom[id], [s.custom]);
  const itemPlace = useCallback((it: Item) => place(it.placeId), [place]);

  const api = useMemo<Ctx>(() => ({
    s, place, itemPlace,
    add(p, to, opts) {
      const id = `n${++seq}`;
      const custom = p.catalog === false ? { ...s.custom, [p.id]: p } : s.custom;
      let trip: Trip = { ...s.trip, items: { ...s.trip.items, [id]: { id, placeId: p.id, time: opts?.time } } };
      trip = insertAt(trip, id, to, opts?.index);
      dispatch({ t: "op", label: `Added ${p.name} to ${targetLabel(trip, to)}`, trip, custom, select: id, focusDay: "day" in to ? to.day : s.focusDay });
      return id;
    },
    move(id, to, index, time) {
      const from = containerOf(s.trip, id);
      let trip = insertAt(removeFrom(s.trip, id), id, to, index);
      if (time) trip = { ...trip, items: { ...trip.items, [id]: { ...trip.items[id], time } } };
      const name = place(s.trip.items[id].placeId)?.name ?? "item";
      const same = from && JSON.stringify(from) === JSON.stringify(to);
      // a reordered stop keeps its place in the new order, not its old clock time: release a fixed time
      // so it follows the previous stop (Undo brings the time back)
      const released = same && !time && s.trip.items[id].time && "day" in to;
      if (released) trip = { ...trip, items: { ...trip.items, [id]: { ...trip.items[id], time: undefined } } };
      dispatch({ t: "op", label: same ? `Reordered ${name}${released ? "; its time now follows the previous stop" : ""}` : `Moved ${name} to ${targetLabel(trip, to)}`, trip });
    },
    remove(id) {
      const name = place(s.trip.items[id].placeId)?.name ?? "item";
      dispatch({ t: "op", label: `Removed ${name}`, trip: removeFrom(s.trip, id), select: undefined });
    },
    setBase(day, placeId, through) {
      const last = through ?? day;
      const trip = { ...s.trip, days: s.trip.days.map(d => d.n >= day && d.n <= last ? { ...d, base: placeId } : d) };
      const name = placeId ? place(placeId)?.name : undefined;
      dispatch({ t: "op", label: name ? `Sleeping at ${name}, night${last > day ? `s ${day}-${last}` : ` ${day}`}` : `Cleared where you sleep on night ${day}`, trip, focusDay: day });
    },
    movePin(placeId, lng, lat) {
      const p = s.custom[placeId]; if (!p) return;
      dispatch({ t: "op", label: `Moved the pin for ${p.name}`, trip: s.trip, custom: { ...s.custom, [placeId]: { ...p, lng, lat } } });
    },
    setTime(id, time) {
      const trip = { ...s.trip, items: { ...s.trip.items, [id]: { ...s.trip.items[id], time } } };
      dispatch({ t: "op", label: time ? `Set time to ${time}` : "Cleared the time", trip });
    },
    select: (id, focusDay) => dispatch({ t: "select", id, focusDay }),
    focus: day => dispatch({ t: "focus", day }),
    showDay: day => dispatch({ t: "mapDay", day }),
    undo: () => dispatch({ t: "undo" }),
    toast: text => dispatch({ t: "toast", text }),
  }), [s, place, itemPlace]);
  return <C.Provider value={api}>{children}</C.Provider>;
}
export const useStore = () => { const c = useContext(C); if (!c) throw new Error("no store"); return c; };

// ---- derived plan: legs, totals, checks ----
export interface DayPlan {
  n: number; start?: Place; end?: Place; stops: { item: Item; place: Place }[];
  legs: (Leg & { from: Place; to: Place })[]; driveMin: number; driveKm: number; walkKm: number; gainM: number;
  warnings: string[];
}
export function planDay(trip: Trip, n: number, place: (id: string) => Place | undefined): DayPlan {
  const day = trip.days.find(d => d.n === n)!;
  const prev = trip.days.find(d => d.n === n - 1);
  const start = prev?.base ? place(prev.base) : undefined;
  const end = day.base ? place(day.base) : undefined;
  const stops = day.itemIds.map(id => trip.items[id]).map(item => ({ item, place: place(item.placeId)! })).filter(x => x.place);
  // a split day routes lane A for the totals; lane B is shown as its own line on the map
  const routed = stops.filter(x => x.item.variant !== "B");
  const pts = [start, ...routed.map(x => x.place), end].filter(Boolean) as Place[];
  const legs = pts.slice(1).map((b, i) => ({ ...(b.trailhead === pts[i].id ? { mode: "walk" as const, min: 2, km: 0.1 } : leg(pts[i], b)), from: pts[i], to: b })).filter(l => l.km > 0 || l.min > 2);
  const driveLegs = legs.filter(l => l.mode === "drive");
  const walkKm = routed.reduce((a, x) => a + (x.place.km && x.place.kind !== "activity" ? x.place.km : 0), 0);
  const gainM = routed.reduce((a, x) => a + Math.max(0, x.place.gain ?? 0), 0);
  const p = { driveMin: driveLegs.reduce((a, l) => a + l.min, 0), driveKm: driveLegs.reduce((a, l) => a + l.km, 0) };
  const warnings: string[] = [];
  if (p.driveMin > trip.pace.driveMin) warnings.push(`Driving over your ${trip.pace.driveMin / 60} h limit`);
  if (walkKm > trip.pace.walkKm) warnings.push(`Walking over ${trip.pace.walkKm} km`);
  if (gainM > trip.pace.gainM) warnings.push(`Climb over ${trip.pace.gainM} m`);
  for (const x of stops) {
    if (!x.place.minAge) continue;
    const who = x.item.who?.length ? trip.travellers.filter(t => x.item.who!.includes(t.id)) : trip.travellers;
    for (const t of who) if (t.age !== undefined && t.age < x.place.minAge) warnings.push(`${x.place.name} needs ${x.place.minAge}+; ${t.name} is ${t.age}`);
  }
  if (!end && n <= trip.nights) warnings.push(`No stay for night ${n}`);
  return { n, start, end, stops, legs, ...p, walkKm: Math.round(walkKm * 10) / 10, gainM, warnings };
}
