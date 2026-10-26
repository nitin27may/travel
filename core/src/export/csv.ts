// The trip CSV: one row per stop, plus one row per booking (MUST-6), in day order.
//
// The CSV time rule (BACKLOG 15.46, settled in TRP-GL-C): the "Time" column follows the selected profile exactly as the print does (the B1
// rule of the TRP2b2 review). The browser builds the file from `forPage(model, session)` (web/lib/export/plan.ts), which writes each kept
// stop's time as the print writes it from the page's displayed timeline: "~08:45" for a suggested time (T3: never shown as fixed),
// "about 19:30" tied to the sun, "07:30 PT" over a time-zone line, the part of the day on a condensed plan, and no time for a stop the
// timeline does not time. The API export has no profile (exportQuery ignores `profile`, store.ts A31), so it uses the trip's default
// profile; until SHOULD-9 schedules the API's model (web/lib/server/exports.ts), the API's CSV writes the plan's authored HH:MM.
//
// "Book ahead" (MUST-6, T1, P6): a stop's own booking window (`ExportStop.bookRule`) on its row, and each of the trip's bookings as its own
// row ("booking" in Kind) at the head of its day, so a window tied to no stop is still in the file. Dateless, as the page words it.
import { bookAheadText } from './bookings.ts';
import { toCsv } from './csvText.ts';
import { approxNote, checkPoint, sourceLine } from './licence.ts';
import { CATEGORY_LABEL } from './publicTypes.ts';
import type { Category } from './publicTypes.ts';
import type { TripExport } from './types.ts';

export const TRIP_CSV_HEADER = ['Day', 'Time', 'Name', 'Kind', 'Category', 'Area', 'Lat', 'Lon', 'Approximate', 'Links', 'Book ahead'];

type Cell = string | number | null | undefined;

/** The clock inside a time as the page words it ("~08:45", "about 19:30", "07:30 PT"), for sorting; a part of the day sorts after. */
const clockOf = (t: string | null): string => t?.match(/\b\d{2}:\d{2}\b/)?.[0] ?? '99:99';

/** Stops and bookings in day order; in a day, its bookings first, then the stops by time, then page order. Coordinates only where the licence guard passes. */
export function tripCsv(trip: TripExport): string {
  const stops = [...trip.stops]
    .sort((a, b) => a.day - b.day || clockOf(a.time).localeCompare(clockOf(b.time)) || a.order - b.order)
    .map((s) => {
      const p = s.point && checkPoint(s.point).ok ? s.point : null;
      const row: Cell[] = [s.day, s.time, s.name, s.kind, s.category ? CATEGORY_LABEL[s.category as Category] : '', s.area, p ? p.lat : '', p ? p.lon : '', p && approxNote(p) ? 'yes' : '', s.links.join(' '), s.bookRule ?? ''];
      return { day: s.day, row };
    });
  const bookings = trip.bookings.map((b) => ({ day: b.day, row: [b.day, '', b.name, 'booking', '', '', '', '', '', '', bookAheadText(b)] as Cell[] }));
  const rows: Cell[][] = [];
  const days = [...new Set([...bookings.flatMap((b) => (b.day === null ? [] : [b.day])), ...stops.map((s) => s.day)])].sort((a, b) => a - b);
  for (const d of days) rows.push(...bookings.filter((b) => b.day === d).map((b) => b.row), ...stops.filter((s) => s.day === d).map((s) => s.row));
  // a booking the plan ties to no day closes the list, before the source line
  rows.push(...bookings.filter((b) => b.day === null).map((b) => b.row));
  return toCsv(TRIP_CSV_HEADER, [...rows, [sourceLine(trip.url)]]);
}
