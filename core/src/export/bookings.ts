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
//
// PA-X (protected-area-entry 5.2, 6.2; BACKLOG 15.223d): a rule has a kind (rolling, fixed_date, monthly_release, lottery, same_day,
// anytime, on_arrival) and an optional second phase, and a row has a kind (booking, pass, check, task). Only booking rows count "to book
// ahead" (QP3). Rows read from capture requirement records are built in ./requirements.ts and pass through `tripBookings` like any other.
import { PARTY_LEAK } from '../privacy/party.ts';
import type { BookingKind, BookRuleKind, ExportBooking, ExportStop } from './types.ts';

/**
 * The rule as `CategoryItem.bookRule` holds it (core/src/schema/api/trip.ts), from a capture `windowSpec` by `bookRuleFromWindow`
 * (protected-area-entry 5.2). `kind` absent is `rolling`: every row written before PA-X reads exactly as it did.
 */
export interface BookRulePhase {
  kind?: BookRuleKind;
  /** rolling: days before the day the window counts from; 0 for every other kind (same_day reads "on Day N") */
  daysBefore: number;
  /** the trip day the window counts from ("before Day 10"); null when the plan ties it to no day */
  dayN: number | null;
  /** HH:MM the window opens (or, for `anytime` with `closes`, nothing: the close is in `closes`) */
  time: string | null;
  /** IANA zone of `time`; only makes the text say "local" */
  tz: string | null;
  /** the yearly month band of a launch day or a lottery, from `opens_from`/`opens_to` ("usually in March"); never a year */
  months?: [number, number] | null;
  /** monthly_release: how many days before the month the batch opens */
  monthLeadDays?: number | null;
  /** when sales stop, relative to `dayN`: `closes_days_before` and `closes_time` */
  closes?: { daysBefore: number; time: string | null } | null;
  /** the share of seats this phase releases, `share_pct` */
  sharePct?: number | null;
}

/** A window of one or two phases (a launch day, then a rolling release; a lottery, then the seats left after the draw). One level only. */
export interface BookRuleInput extends BookRulePhase {
  then?: BookRulePhase | null;
}

/** The fields of a category row this module reads (a `CategoryItem`, from the page model or the API's trip detail). */
export interface BookingSource {
  key: string;
  name: string;
  placeSlug: string | null;
  days: number[];
  bookRule: BookRuleInput | null;
  bookNote: string | null;
  /**
   * The row kind when the row knows it (a row derived from a requirement record, or a trip's own task). Absent: a row with a rule
   * whose kind is `on_arrival` is a check, every other row a booking, as before PA-X.
   */
  bookKind?: BookingKind | null;
  /** the park or zone name the row is needed for */
  park?: string | null;
  /** the requirement's booking page */
  link?: string | null;
}

const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "in April", "between March and May": a yearly band read in one season, so the caller says "usually" (T3). */
function monthsText(m: [number, number] | null | undefined): string | null {
  if (!m) return null;
  const [a, b] = m;
  const name = (n: number): string | undefined => MONTH[n - 1];
  if (!name(a) || !name(b)) return null;
  return a === b ? `in ${name(a)}` : `between ${name(a)} and ${name(b)}`;
}

const clock = (time: string | null, tz: string | null): string => (time ? ` at ${time}${tz ? ' local' : ''}` : '');

/** "2 days before Day 10", "on Day 4", "60 days ahead", "on the day": the rolling clause, without the verb. */
function relClause(daysBefore: number, dayN: number | null): string {
  const days = `${daysBefore} day${daysBefore === 1 ? '' : 's'}`;
  return daysBefore === 0 ? (dayN !== null ? `on Day ${dayN}` : 'on the day') : dayN !== null ? `${days} before Day ${dayN}` : `${days} ahead`;
}

/** "until 15:30 the day before Day 9", "23:59 on Day 12": when sales stop, relative to the row's day. */
function closesClause(c: { daysBefore: number; time: string | null }, dayN: number | null): string {
  const t = c.time ? `${c.time} ` : '';
  if (dayN === null) return c.daysBefore === 0 ? `${t}on the day`.trim() : `${t}${c.daysBefore} day${c.daysBefore === 1 ? '' : 's'} ahead`;
  if (c.daysBefore === 0) return `${t}on Day ${dayN}`;
  if (c.daysBefore === 1) return `${t}the day before Day ${dayN}`;
  return `${c.time ? `${c.time}, ` : ''}${c.daysBefore} days before Day ${dayN}`;
}

const share = (r: BookRulePhase): string => (typeof r.sharePct === 'number' ? ` (${r.sharePct}% of seats)` : '');

/** One phase in words, starting with its verb ("Opens ...", "Lottery: ...", "Buy ...", "Pay on arrival"). */
function phaseText(r: BookRulePhase): string {
  const kind = r.kind ?? 'rolling';
  const band = monthsText(r.months);
  switch (kind) {
    case 'fixed_date':
      return `Opens on a launch day each year${band ? `, usually ${band}${r.time ? ',' : ''}` : ''}${clock(r.time, r.tz)}${share(r)}`;
    case 'lottery':
      return `Lottery: apply${band ? ` usually ${band}` : ' before the draw'}${share(r)}`;
    case 'monthly_release':
      return `Opens in a monthly batch${typeof r.monthLeadDays === 'number' ? ` about ${r.monthLeadDays} days before the month` : ''}${r.time ? `,${clock(r.time, r.tz)}` : ''}${share(r)}`;
    case 'anytime':
      if (r.closes) return `Buy by ${closesClause(r.closes, r.dayN)}`;
      return r.dayN !== null ? `Buy any time before Day ${r.dayN}` : 'Buy any time before the trip';
    case 'on_arrival':
      return 'Pay on arrival';
    case 'same_day':
      return `Opens ${relClause(0, r.dayN)}${clock(r.time, r.tz)}${share(r)}`;
    default:
      return `Opens ${relClause(r.daysBefore, r.dayN)}${clock(r.time, r.tz)}${share(r)}`;
  }
}

/** The close of a phase that is not `anytime` (where the close is the whole text): ", until 15:30 the day before Day 9". */
function untilText(r: BookRulePhase): string {
  return r.closes && r.kind !== 'anytime' ? `, until ${closesClause(r.closes, r.dayN)}` : '';
}

/** The second phase: "then 2 days before Day 10 at 08:00 local"; after a lottery, "seats left after the draw until 15:30 the day before Day 9". */
function thenText(first: BookRulePhase, t: BookRulePhase): string {
  const kind = t.kind ?? 'rolling';
  const rel = kind === 'rolling' || kind === 'same_day';
  if (first.kind === 'lottery') {
    const open = rel && (kind === 'same_day' ? t.dayN !== null : t.daysBefore > 0) ? ` from ${relClause(kind === 'same_day' ? 0 : t.daysBefore, t.dayN)}${clock(t.time, t.tz)}` : '';
    const until = t.closes ? ` until ${closesClause(t.closes, t.dayN)}` : '';
    return `seats left after the draw${open}${until}${share(t)}`;
  }
  if (rel) return `then ${relClause(kind === 'same_day' ? 0 : t.daysBefore, t.dayN)}${clock(t.time, t.tz)}${share(t)}${untilText(t)}`;
  const p = phaseText(t);
  return `then ${p.charAt(0).toLowerCase()}${p.slice(1)}${untilText(t)}`;
}

/**
 * The window as the page words it (protected-area-entry 5.2): "Opens 30 days before Day 3", "Opens on a launch day each year, usually in
 * April, at 08:00 local; then 2 days before Day 10 at 08:00 local", "Lottery: apply usually in March; seats left after the draw until
 * 15:30 the day before Day 9", "Buy by 23:59 on Day 12", "Pay on arrival". The trip page's chip and rows import this function (TRP-GL,
 * review F7); there is no second wording. Dateless: a month band is "usually in March", never a year or a calendar date.
 */
export function bookRuleText(r: BookRuleInput): string {
  const head = `${phaseText(r)}${untilText(r)}`;
  return r.then ? `${head}; ${thenText(r, r.then)}` : head;
}

/** The kind of a row: its own when it knows it, else a check for "pay on arrival", else a booking (every row before PA-X). */
export function bookingKindOf(r: Pick<BookingSource, 'bookKind' | 'bookRule'>): BookingKind {
  if (r.bookKind) return r.bookKind;
  return r.bookRule?.kind === 'on_arrival' ? 'check' : 'booking';
}

/**
 * The counts a Bookings tab or toast says (owner QP3): `toBook` counts `booking` rows only ("5 to book ahead"); passes, checks and tasks
 * are counted apart, and a check is never "to book".
 */
export function bookingCounts(bookings: readonly Pick<ExportBooking, 'kind'>[]): Record<'toBook' | BookingKind, number> {
  const n = (k: BookingKind): number => bookings.filter((b) => b.kind === k).length;
  return { toBook: n('booking'), booking: n('booking'), pass: n('pass'), check: n('check'), task: n('task') };
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

/**
 * The booking a category row is, or null. A row with no rule and no public note is none. A row whose note says there is nothing to book
 * is none too, unless the row names its own kind (a `check` derived from a parking offer says "No reservation; lot fills before sunrise"
 * and is listed as a check, never counted).
 */
function bookingOf(r: BookingSource): ExportBooking | null {
  const note = publicBookingNote(r.bookNote);
  if (!r.bookRule && !note) return null;
  if (!r.bookRule && !r.bookKind && NOTHING_TO_BOOK.test(note!)) return null;
  // the day it is for: the rule's own day ("before Day 5") first, then the first day the row is for (review F10)
  const day = r.bookRule?.dayN ?? (r.days.length ? Math.min(...r.days) : null);
  return { name: r.name, rule: r.bookRule ? bookRuleText(r.bookRule) : null, note, day, ref: r.key, kind: bookingKindOf(r), park: r.park ?? null, link: r.link ?? null };
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
