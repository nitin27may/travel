// Resolving an edition (plan 2.3, 4.5): real dates and weekdays for every day, traveller ages on the first day,
// each booking's resolved book-by date and derived state for a given "today", and sun times per day.
import { bookByOf, deadlineOf } from "../bookings/bookBy.ts";
import type { BookByResult } from "../bookings/bookBy.ts";
import { addDays, isoWeekday } from "../checks/time.ts";
import { emptyCatalog } from "../checks/context.ts";
import type { CatalogLookup } from "../checks/context.ts";
import { sunFor } from "../sun/index.ts";

type Row = Record<string, any>;

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export type BookingState = "not-yet-open" | "open" | "urgent" | "booked" | "sold-out";

const DONE = new Set(["booked", "paid", "walk-up"]);
const GONE = new Set(["cancelled", "not-needed"]);
/** a booking is urgent when it is open and its book-by is this many days away, or past */
export const URGENT_WITHIN_DAYS = 14;

export interface ResolvedDay {
  n: number;
  date: string;
  weekday: string;
  base_id: string | null;
  sun: { sunrise: string; sunset: string } | null;
}

export interface ResolvedBooking {
  id: string;
  edition_id: string | null;
  book_by_offset: number | null;
  book_by_date: string | null;
  book_by_basis: string;
  gap: boolean;
  opens_date: string | null;
  state: BookingState | "cancelled";
  days_left: number | null;
}

export interface ResolvedEdition {
  edition: Row | null;
  start: string | null;
  days: ResolvedDay[];
  travellers: { id: string; label: string; age: number | null }[];
  bookings: ResolvedBooking[];
}

export function pickEdition(trip: Row, editionId?: string | null): Row | null {
  const eds: Row[] = trip.editions ?? [];
  if (editionId) return eds.find((e) => e.id === editionId) ?? null;
  return eds.find((e) => e.status === "chosen" || e.status === "booked") ?? null;
}

/** age on the first day of the edition, from age_years at age_as_of */
export function ageAtEdition(tv: Row, editionStart: string | null): number | null {
  if (typeof tv.age_years !== "number") return null;
  if (editionStart && typeof tv.age_as_of === "string") {
    const ms = Date.parse(editionStart) - Date.parse(tv.age_as_of);
    return tv.age_years + Math.floor(ms / 86400000 / 365.25);
  }
  return tv.age_years;
}

export function bookingState(booking: Row, r: BookByResult, editionStart: string | null, today: string): { state: BookingState | "cancelled"; deadline: string | null; opens: string | null; days_left: number | null } {
  const deadline = deadlineOf(r, editionStart);
  const opens = r.opens_offset !== null && editionStart ? addDays(editionStart, r.opens_offset) : null;
  const left = deadline ? Math.round((Date.parse(deadline) - Date.parse(today)) / 86400000) : null;
  if (GONE.has(booking.status)) return { state: "cancelled", deadline, opens, days_left: left };
  if (DONE.has(booking.status)) return { state: "booked", deadline, opens, days_left: left };
  if (booking.status === "sold-out") return { state: "sold-out", deadline, opens, days_left: left };
  if (opens && opens > today) return { state: "not-yet-open", deadline, opens, days_left: left };
  if (left !== null && left <= URGENT_WITHIN_DAYS) return { state: "urgent", deadline, opens, days_left: left };
  return { state: "open", deadline, opens, days_left: left };
}

export interface ResolveOptions {
  edition?: string | null;
  today: string;
  catalog?: CatalogLookup;
}

export function resolveEdition(trip: Row, o: ResolveOptions): ResolvedEdition {
  const catalog = o.catalog ?? emptyCatalog;
  const ed = pickEdition(trip, o.edition);
  const start: string | null = ed && typeof ed.start === "string" ? ed.start : null;
  const bases = new Map<string, Row>((trip.bases ?? []).map((b: Row) => [b.id, b]));
  const baseFor = (baseId: string | null): { lat: number; lon: number; tz: string } | null => {
    const b = baseId ? bases.get(baseId) : undefined;
    if (!b) return null;
    let lat = b.lat, lon = b.lon;
    if (typeof lat !== "number" && b.place_id) {
      const p = catalog.place(b.place_id);
      lat = p?.lat;
      lon = p?.lon;
    }
    return typeof lat === "number" && typeof lon === "number" && b.tz ? { lat, lon, tz: b.tz } : null;
  };
  const days: ResolvedDay[] = (trip.days ?? []).map((d: Row) => {
    const date = start ? addDays(start, d.n - 1) : "";
    const at = baseFor(d.base_id);
    return {
      n: d.n,
      date,
      weekday: date ? WEEKDAYS[isoWeekday(date) - 1]! : "",
      base_id: d.base_id ?? null,
      sun: date && at ? sunFor(at.lat, at.lon, date, at.tz) : null,
    };
  });
  const bookings: ResolvedBooking[] = (trip.trip_bookings ?? [])
    .filter((b: Row) => !ed || !b.edition_id || b.edition_id === ed.id)
    .map((b: Row) => {
      const r = bookByOf(b, catalog, start);
      const s = bookingState(b, r, start, o.today);
      return {
        id: b.id, edition_id: b.edition_id ?? null, book_by_offset: r.offset, book_by_date: s.deadline, book_by_basis: b.book_by_basis === "owner" ? "owner" : r.basis,
        gap: r.gap, opens_date: s.opens, state: s.state, days_left: s.days_left,
      };
    });
  return {
    edition: ed,
    start,
    days,
    travellers: (trip.travellers ?? []).map((t: Row) => ({ id: t.id, label: t.label, age: ageAtEdition(t, start) })),
    bookings,
  };
}
