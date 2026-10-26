// Booking windows in the trip export (MUST-6 of the TRP2b review; T1: "when" is part of every answer; P6: the window where the booking is
// due). One definition of the words, so the page's "To book" chip, the print, the CSV and the API's json model say the same thing.
//
// Public trips are dateless (docs/v2/design/public-trips-dateless.md): a window is a rule relative to a day ("Opens 30 days before Day 3"),
// never a calendar date. The rows come from the trip's category rows that carry a rule or a note (`CategoryItem.bookRule`, `bookNote`), the
// same rows the page's "By category" view shows; nothing is re-derived from the sources here.
//
// The export is a machine-readable copy, so its notes pass one more scrub (TRP-GL-C review F1): research markers ("INFERENCE 2029:", the
// bare "2029:" the page's marker strip leaves, a bare "GAP") are stripped, a clause that still states the household's party ("a family
// of 3", "a 6-year-old": the privacy rule `PARTY_LEAK`, core/src/privacy/party.ts, whose rewrites already ran on the page's rows) is
// dropped as a second net, and a row whose
// note says there is nothing to book ("no booking expected", "carry bear spray") is not a booking: it is left out of `bookings`, so the
// CSV never writes it as Kind "booking" and the toast never counts it "to book ahead". The page's own "By category" rows are built in
// web/lib/public/trips.ts; the data rewrite of the Rockies rows is BACKLOG 15.223b (DATA-PLAN D8-R).
import { PARTY_LEAK } from '../privacy/party.ts';
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
 * The window as the page words it: "Opens 30 days before Day 3", "Opens 60 days ahead at 08:00 local", "Opens 1 day before Day 2". The
 * trip page's chip (`bookRuleLabel` in web/components/trips/model.ts) must say exactly this; web/tests/export/trip-routes.test.ts pins
 * the two together (TRP-GL replaces the copy with this function, review F7).
 */
export function bookRuleText(r: BookRuleInput): string {
  const days = `${r.daysBefore} day${r.daysBefore === 1 ? '' : 's'}`;
  const when = r.daysBefore === 0 ? (r.dayN !== null ? `on Day ${r.dayN}` : 'on the day') : r.dayN !== null ? `${days} before Day ${r.dayN}` : `${days} ahead`;
  return `Opens ${when}${r.time ? ` at ${r.time}` : ''}${r.tz ? ' local' : ''}`;
}

/** What a "Book ahead" cell or line says for one booking: the rule, then the note; empty when it has neither. */
export function bookAheadText(b: Pick<ExportBooking, 'rule' | 'note'>): string {
  return [b.rule, b.note].filter((x): x is string => !!x && !!x.trim()).join('; ');
}

/**
 * A research marker at the head of a note or a sentence: "INFERENCE 2029:", "INFERENCE:", and the bare year the page's marker strip
 * leaves behind ("2029: buy a few weeks ahead"). A clock ("08:00") is never one: the year is four digits and a space follows the colon.
 */
const RESEARCH_PREFIX = /\bINFERENCE(?:\s+\d{4})?:\s*|(?:^|(?<=[.!?;]\s))(?:19|20)\d{2}:\s+/g;
/** A bracketed aside that only says the fact is a research gap: "(GAP)", "(GAP on lead time)", "(an unofficial report ..., GAP)". */
const GAP_ASIDE = /\s*\([^()]*\bGAP\b[^()]*\)/g;
/** A clause that is a research gap: "Child policy GAP", "whether it counts is GAP". Case-sensitive: the marker is upper case. */
const GAP_CLAUSE = /\bGAP\b/;
/** A note that says there is nothing to book ahead: not a booking (review F1). */
export const NOTHING_TO_BOOK = /\bno\s+(?:advance\s+)?booking\b|\bbuy\s+(?:\w+\s+){0,2}on\s+the\s+day\b|\bcarry\s+bear\s+spray\b|\bcheck\s+(?:\w+\s+)?bulletins\b/i;

const SENTENCE = /(?:[^.!?]|[.!?](?![\s]|$))+[.!?]*\s*/g;

/**
 * A booking note as the export may carry it: research markers stripped, gap clauses and household party clauses dropped, the rest kept
 * in its own words (each sentence starting upper case). Null when nothing is left.
 */
export function publicBookingNote(note: string | null | undefined): string | null {
  const t = (note ?? '').replace(RESEARCH_PREFIX, '').replace(GAP_ASIDE, '').trim();
  if (!t) return null;
  const kept: string[] = [];
  for (const raw of t.match(SENTENCE) ?? [t]) {
    const s = raw.trim();
    const end = /[.!?]$/.test(s) ? s.slice(-1) : '';
    const clauses = (end ? s.slice(0, -1) : s)
      .split(/\s*;\s*/)
      .map((c) => c.trim())
      .filter((c) => c && !GAP_CLAUSE.test(c) && !PARTY_LEAK.test(c));
    // a sentence whose marker was stripped starts with a capital again
    if (clauses.length) kept.push(`${clauses.join('; ')}${end}`.replace(/^[a-z]/, (c) => c.toUpperCase()));
  }
  return kept.join(' ').trim() || null;
}

/** The booking a category row is, or null: a row with no rule and no public note, or whose note says there is nothing to book, is none. */
function bookingOf(r: BookingSource): ExportBooking | null {
  const note = publicBookingNote(r.bookNote);
  if (!r.bookRule && (!note || NOTHING_TO_BOOK.test(note))) return null;
  // the day it is for: the rule's own day ("before Day 5") first, then the first day the row is for (review F10)
  const day = r.bookRule?.dayN ?? (r.days.length ? Math.min(...r.days) : null);
  return { name: r.name, rule: r.bookRule ? bookRuleText(r.bookRule) : null, note, day, ref: r.key };
}

/**
 * The trip's bookings in day order (the rule's day, else the first day the booking is for; a booking with no day goes last), then the
 * page's row order. A row is a booking when it carries a rule or a public note that is not "nothing to book"; stays and plain stops carry
 * neither.
 */
export function tripBookings(rows: readonly BookingSource[]): ExportBooking[] {
  const out = rows.flatMap((r, i) => {
    const b = bookingOf(r);
    return b ? [{ i, b }] : [];
  });
  out.sort((x, y) => (x.b.day ?? Infinity) - (y.b.day ?? Infinity) || x.i - y.i);
  return out.map((x) => x.b);
}

/**
 * Each stop with the "Book ahead" text of the bookings that belong to it: a booking row names the same place (`placeSlug`) and one of its
 * days is the stop's day. A booking with no place (every logistics row today, BACKLOG 15.223b) stays in the trip's list only; it is never
 * guessed onto a stop by its name. Returns new stop objects; a stop with no booking keeps no `bookAhead` key.
 */
export function withStopBookings<S extends Pick<ExportStop, 'day' | 'placeSlug'>>(stops: readonly S[], rows: readonly BookingSource[]): (S & { bookAhead?: string })[] {
  const linked = rows.flatMap((r) => {
    const b = r.placeSlug ? bookingOf(r) : null;
    return b ? [{ r, text: bookAheadText(b) }] : [];
  });
  return stops.map((s) => {
    if (!s.placeSlug) return s;
    const texts = linked.filter(({ r }) => r.placeSlug === s.placeSlug && r.days.includes(s.day)).map(({ text }) => text).filter(Boolean);
    return texts.length ? { ...s, bookAhead: [...new Set(texts)].join('; ') } : s;
  });
}
