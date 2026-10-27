import { bookingCounts } from '@travel/core/export/bookings.ts';
import type { BookingKind, ExportBooking } from '@travel/core/export/types.ts';

/** The order the Bookings tab draws its groups in, the heading of each, and the line under it that says what the rows are (owner QP3: honest words). */
export const BOOKING_GROUPS: readonly { kind: BookingKind; heading: string; note: string | null }[] = [
  { kind: 'booking', heading: 'To book ahead', note: null },
  { kind: 'pass', heading: 'Passes', note: 'Bought any time before the trip; not counted as a booking to watch.' },
  { kind: 'check', heading: 'To check', note: 'Listed so you know; nothing to book, not counted.' },
  { kind: 'task', heading: 'Tasks', note: 'Your own to-dos; not counted as a booking.' },
];

export interface BookingGroup {
  kind: BookingKind;
  heading: string;
  note: string | null;
  rows: ExportBooking[];
}

/** The rows by kind, empty groups left out; inside a group the export's own order (day, then the page's row order) is kept. */
export function groupBookings(bookings: readonly ExportBooking[]): BookingGroup[] {
  return BOOKING_GROUPS.flatMap((g) => {
    const rows = bookings.filter((b) => b.kind === g.kind);
    return rows.length ? [{ ...g, rows }] : [];
  });
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/**
 * The line under the heading, from `bookingCounts` (never `bookings.length`: a check or a task is not "to book ahead"):
 * "7 to book ahead, none with a published opening date yet", "3 to book ahead, 1 with a published opening date",
 * "Nothing to book ahead" when only passes, checks or tasks are listed; the other kinds follow, counted apart.
 */
export function bookingsSummary(bookings: readonly ExportBooking[]): string {
  const c = bookingCounts(bookings);
  const dated = bookings.filter((b) => b.kind === 'booking' && b.rule).length;
  const head = c.toBook === 0 ? 'Nothing to book ahead' : `${c.toBook} to book ahead, ${dated === 0 ? 'none with a published opening date yet' : `${dated} with a published opening date`}`;
  const rest = [c.pass ? plural(c.pass, 'pass', 'passes') : '', c.check ? plural(c.check, 'check', 'checks') : '', c.task ? plural(c.task, 'task', 'tasks') : ''].filter(Boolean);
  return rest.length ? `${head}; also ${rest.join(', ')}` : head;
}

/** "Prices: not checked yet for these 7": the export holds no price, so one line says so for the rows that cost money (bookings and passes). Null when none. */
export function pricesLine(bookings: readonly ExportBooking[]): string | null {
  const n = bookings.filter((b) => b.kind === 'booking' || b.kind === 'pass').length;
  if (n === 0) return null;
  return `Prices: not checked yet for ${n === 1 ? 'this one' : `these ${n}`}.`;
}

/** An official link is drawn only when it is an http(s) address: the contract carries a string, the page never writes a `javascript:` href. */
export function safeLink(link: string | null): string | null {
  if (!link) return null;
  try {
    const u = new URL(link);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}
