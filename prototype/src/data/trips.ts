// The signed-in household's trips. Only the Dolomites trip has a full plan in the prototype; the others carry
// the summary the Trips page and the trip switcher need. Bookings, tasks, budget and Today all belong to one trip.
import { useMemo } from "react";
import { useStore } from "../state/store";

export type Phase = "plan" | "book" | "prepare" | "go" | "done" | "idea";
export interface TripCard {
  id: string; title: string; start?: string; end?: string; nights?: number; region: string; kind: string; phase: Phase;
  ready: [number, number, number, number]; next?: string; mine?: boolean; tone: "relief" | "lake" | "ice" | "steppe" | "forest" | "town";
}

export const PHASE_LABEL: Record<Phase, string> = { idea: "Idea", plan: "Planning", book: "Booking", prepare: "Preparing", go: "Travelling", done: "Done" };
export const STATIC: TripCard[] = [
  { id: "whitby-day", title: "Elora Gorge day trip", start: "2026-10-24", end: "2026-10-24", nights: 0, region: "Ontario · from Whitby", kind: "Day trip", phase: "prepare", ready: [1, 1, .5, 0], next: "Leave by 08:10 for the 10:30 tubing slot", tone: "forest" },
  { id: "patagonia", title: "Patagonia", start: "2027-02-26", end: "2027-03-11", nights: 13, region: "Argentina", kind: "Family · adventure", phase: "book", ready: [1, .35, .1, 0], next: "Book the international flight and El Chaltén lodging by 31 Oct", tone: "steppe" },
  { id: "costa-rica", title: "Costa Rica", start: "2027-02-13", end: "2027-02-23", nights: 10, region: "Costa Rica", kind: "Family", phase: "plan", ready: [.8, .1, 0, 0], next: "Pick the second base: Monteverde or La Fortuna", tone: "forest" },
  { id: "iceland", title: "Iceland by camper van", start: "2027-09-04", end: "2027-09-15", nights: 11, region: "Iceland · Ring Road", kind: "Camper van", phase: "plan", ready: [.9, 0, 0, 0], next: "No campsite confirmed open for Sept 2027 yet", tone: "ice" },
  { id: "chamonix", title: "Chamonix and Mont Blanc", start: "2028-09-01", end: "2028-09-09", nights: 8, region: "France", kind: "Hiking", phase: "plan", ready: [.85, 0, 0, 0], next: "Refuge du Lac Blanc bookings open ~15 Oct 2027", tone: "ice" },
  { id: "rockies", title: "Canadian Rockies", start: "2029-09-08", end: "2029-09-22", nights: 14, region: "Alberta and BC", kind: "Family · 3 tracks", phase: "plan", ready: [1, 0, 0, 0], next: "Template published for family and friends", tone: "lake" },
  { id: "norway", title: "Norway, Arctic first", nights: 14, region: "Lofoten to Bergen", kind: "Road trip", phase: "idea", ready: [.7, 0, 0, 0], next: "Dates open: window A 24 Jun or B 29 Jul 2028", tone: "lake" },
  { id: "peru", title: "Peru: Huayhuash and Cusco", region: "Peru", kind: "Trek", phase: "idea", ready: [.2, 0, 0, 0], next: "Choose a shape: 17 days or 24-26 days", tone: "steppe" },
  { id: "algonquin", title: "Algonquin and Muskoka", start: "2026-10-10", end: "2026-10-12", nights: 2, region: "Ontario", kind: "Thanksgiving weekend", phase: "done", ready: [1, 1, 1, 1], next: "How did it go? 3 corrections to send", tone: "forest" },
  { id: "vermont", title: "Vermont fall colours", start: "2026-10-01", end: "2026-10-04", nights: 3, region: "Vermont", kind: "Fall colours", phase: "done", ready: [1, 1, 1, 1], tone: "forest" },
  { id: "quebec", title: "Île d'Orléans", start: "2026-09-29", end: "2026-10-01", nights: 2, region: "Québec", kind: "Prologue", phase: "done", ready: [1, 1, 1, 1], tone: "town" },
];

function useDolomites(): TripCard {
  const { s } = useStore();
  return useMemo(() => {
    const t = s.trip;
    const daysWith = t.days.filter(d => d.itemIds.length > 0).length;
    const booked = t.reservations.filter(r => r.status !== "to_book").length;
    const done = t.tasks.filter(k => k.done).length;
    const toBook = t.reservations.filter(r => r.status === "to_book");
    return {
      id: "dolomites", title: "Dolomites", start: t.start, end: "2027-07-26", nights: t.nights, region: "Italy · 3 bases", kind: "Family · hiking",
      phase: "book", mine: true, tone: "relief",
      ready: [daysWith / t.days.length, booked / t.reservations.length, done / t.tasks.length, 0],
      next: `${toBook.length} bookings to make · Tre Cime toll slot opens Tue 15 Jun 2027`,
    };
  }, [s.trip]);
}

/** every trip of the household, the Dolomites card derived from the live store */
export function useMyTrips(): TripCard[] {
  const dolo = useDolomites();
  return useMemo(() => [dolo, ...STATIC], [dolo]);
}
/** trips whose full plan (days, bookings, tasks, budget) is loaded in the prototype */
export const FULL_PLAN = new Set(["dolomites"]);
