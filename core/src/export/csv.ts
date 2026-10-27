// The trip CSV: one row per stop, plus one row per booking (MUST-6), in day order.
//
// The CSV time rule (BACKLOG 15.46, settled in TRP-GL-C): the "Time" column follows the selected profile exactly as the print does (the B1
// rule of the TRP2b2 review). The browser builds the file from `forPage(model, session)`, that is core's `forTimeline` (plan.ts), which
// writes each kept stop's time as the print writes it from the page's displayed timeline: "~08:45" for a suggested time (T3: never shown
// as fixed), "about 19:30" tied to the sun, "07:30 PT" over a time-zone line, the part of the day on a condensed plan, and no time for a
// stop the timeline does not time. The API export has no profile (exportQuery ignores `profile`, store.ts A31), so it uses the trip's
// default profile through the same `forTimeline`; until BACKLOG 15.223a wires that (web/lib/server/exports.ts), the API's CSV writes the
// plan's authored HH:MM.
//
// Order (TRP-GL-C review F2): day, then `order`, never the clock inside the time text. `forTimeline` numbers the stops in the timeline's
// order ("Morning" before "Afternoon", "07:30 PT" before "08:15 MT" when the timeline says so); the builder numbers the plan's authored
// HH:MM chronologically.
//
// "Book ahead" (MUST-6, T1, P6): a stop's own booking text (`ExportStop.bookAhead`) on its row, and each of the trip's bookings as its own
// row at the head of its day, so a window tied to no stop is still in the file. Dateless, as the page words it. The Kind column of a
// booking row is its row kind (PA-X; protected-area-entry 6.4 "Print and CSV"): booking, pass, check or task.
import { bookAheadText } from './bookings.ts';
import { toCsv } from './csvText.ts';
import { approxNote, checkPoint, sourceLine } from './licence.ts';
import { CATEGORY_LABEL } from './publicTypes.ts';
import type { Category } from './publicTypes.ts';
import type { TripExport } from './types.ts';

export const TRIP_CSV_HEADER = ['Day', 'Time', 'Name', 'Kind', 'Category', 'Area', 'Lat', 'Lon', 'Approximate', 'Links', 'Book ahead'];

type Cell = string | number | null | undefined;

/** Stops and bookings in day order; in a day, its bookings first, then the stops in the model's order. Coordinates only where the licence guard passes. */
export function tripCsv(trip: TripExport): string {
  const stops = [...trip.stops]
    .sort((a, b) => a.day - b.day || a.order - b.order)
    .map((s) => {
      const p = s.point && checkPoint(s.point).ok ? s.point : null;
      const row: Cell[] = [s.day, s.time, s.name, s.kind, s.category ? CATEGORY_LABEL[s.category as Category] : '', s.area, p ? p.lat : '', p ? p.lon : '', p && approxNote(p) ? 'yes' : '', s.links.join(' '), s.bookAhead ?? ''];
      return { day: s.day, row };
    });
  const bookings = trip.bookings.map((b) => ({ day: b.day, row: [b.day, '', b.name, b.kind, '', '', '', '', '', '', bookAheadText(b)] as Cell[] }));
  const rows: Cell[][] = [];
  const days = [...new Set([...bookings.flatMap((b) => (b.day === null ? [] : [b.day])), ...stops.map((s) => s.day)])].sort((a, b) => a - b);
  for (const d of days) rows.push(...bookings.filter((b) => b.day === d).map((b) => b.row), ...stops.filter((s) => s.day === d).map((s) => s.row));
  // a booking the plan ties to no day closes the list, before the source line
  rows.push(...bookings.filter((b) => b.day === null).map((b) => b.row));
  return toCsv(TRIP_CSV_HEADER, [...rows, [sourceLine(trip.url)]]);
}
