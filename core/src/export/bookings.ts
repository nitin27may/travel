// Booking windows in the trip export (MUST-6 of the TRP2b review; T1: "when" is part of every answer; P6: the window where the booking is
// due). One definition of the words, so the page's "To book" chip, the print, the CSV and the API's json model say the same thing.
//
// Public trips are dateless (docs/v2/design/public-trips-dateless.md): a window is a rule relative to a day ("Opens 30 days before Day 3"),
// never a calendar date. The rows come from the trip's category rows that carry a rule or a note (`CategoryItem.bookRule`, `bookNote`), the
// same rows the page's "By category" view shows; nothing is re-derived from the sources here.
import type { ExportBooking, ExportStop } from './types.ts';

/** The rule as `CategoryItem.bookRule` holds it (core/src/schema/api/trip.ts). */
export interface BookRuleInput {
  daysBefore: number;
  dayN: number | null;
  time: string | null;
  tz: string | null;
}

/** The fields of a category row this module reads (a `CategoryItem`, from the page model or the API's trip detail). */
export interface BookingSource {
  key: string;
  name: string;
  placeSlug: string | null;
  days: number[];
  bookRule: BookRuleInput | null;
  bookNote: string | null;
}

/**
 * The window as the page words it: "Opens 30 days before Day 3", "Opens 60 days ahead at 08:00 local". The trip page's chip
 * (`bookRuleLabel` in web/components/trips/model.ts) must say exactly this; web/tests/export/trip-routes.test.ts pins the two together.
 */
export function bookRuleText(r: BookRuleInput): string {
  const when = r.dayN !== null ? `${r.daysBefore} days before Day ${r.dayN}` : `${r.daysBefore} days ahead`;
  return `Opens ${when}${r.time ? ` at ${r.time}` : ''}${r.tz ? ' local' : ''}`;
}

/** What a "Book ahead" cell or line says for one booking: the rule, then the note; empty when it has neither. */
export function bookAheadText(b: Pick<ExportBooking, 'rule' | 'note'>): string {
  return [b.rule, b.note].filter((x): x is string => !!x && !!x.trim()).join('; ');
}

/**
 * The trip's bookings in day order (first day the booking is for; a booking with no day goes last), then the page's row order. A row is
 * a booking when it carries a rule or a note; stays and plain stops carry neither.
 */
export function tripBookings(rows: readonly BookingSource[]): ExportBooking[] {
  const out = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.bookRule || (r.bookNote && r.bookNote.trim()))
    .map(({ r, i }) => ({
      i,
      b: { name: r.name, rule: r.bookRule ? bookRuleText(r.bookRule) : null, note: r.bookNote?.trim() || null, day: r.days.length ? Math.min(...r.days) : null, ref: r.key } satisfies ExportBooking,
    }));
  out.sort((x, y) => (x.b.day ?? Infinity) - (y.b.day ?? Infinity) || x.i - y.i);
  return out.map((x) => x.b);
}

/**
 * Each stop with the windows of the bookings that belong to it: a booking row names the same place (`placeSlug`) and one of its days is
 * the stop's day. A booking with no place (most logistics rows today) stays in the trip's list only; it is never guessed onto a stop by
 * its name. Returns new stop objects; a stop with no booking keeps no `bookRule` key.
 */
export function withStopBookings<S extends Pick<ExportStop, 'day' | 'placeSlug'>>(stops: readonly S[], rows: readonly BookingSource[]): (S & { bookRule?: string })[] {
  const linked = rows.filter((r) => r.placeSlug && (r.bookRule || (r.bookNote && r.bookNote.trim())));
  return stops.map((s) => {
    if (!s.placeSlug) return s;
    const texts = linked
      .filter((r) => r.placeSlug === s.placeSlug && r.days.includes(s.day))
      .map((r) => bookAheadText({ rule: r.bookRule ? bookRuleText(r.bookRule) : null, note: r.bookNote }))
      .filter(Boolean);
    return texts.length ? { ...s, bookRule: [...new Set(texts)].join('; ') } : s;
  });
}
