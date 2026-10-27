// Book ahead rows from capture requirement records (protected-area-entry 5.2, 6.2; BACKLOG 15.223d: the export reads the capture
// booking rules). A requirement is an access or lodging offer with a `window` (`windowSpec`) and an `entry` block; this module turns it
// into the `BookingSource` rows `tripBookings` already words, so a derived row and a trip's own row print the same way.
//
// Pure and dateless: a rule is relative to the trip's Day N, never a date (public trips are dateless; Gotcha "never compute book-by dates
// for public trips"). The record's ref never reaches a row: the caller gives the opaque row `key` (legacy refs encode real trip folders).
import type { BookingSource, BookRuleInput, BookRulePhase } from './bookings.ts';
import type { BookingKind, BookRuleKind } from './types.ts';
import { BOOK_RULE_KINDS } from './types.ts';

type Loose = Record<string, any>;

/** A sourced value's value (`{ v, state, src }`), or the raw value of a hand-built record. */
const unwrap = (x: unknown): any => (x && typeof x === 'object' && !Array.isArray(x) && 'v' in (x as object) ? (x as { v: unknown }).v : x);
const under = (type: string, prefix: string): boolean => type === prefix || type.startsWith(`${prefix}.`);
const month = (mmdd: unknown): number | null => (typeof mmdd === 'string' && /^\d{2}-\d{2}$/.test(mmdd) ? Number(mmdd.slice(0, 2)) : null);

/** Types whose row is a `pass` when it is bought any time (protected-area-entry 6.2). */
export const PASS_TYPES: readonly string[] = ['access.pass.entry_fee', 'access.pass.park_pass', 'access.pass.vehicle_permit'];
/** Types whose row is a `check` when it cannot be booked: parking that fills (6.2, 6.3 lakelouise-lakeshore-parking). */
export const CHECK_TYPES: readonly string[] = ['access.park'];
/** Rules with a window to watch: a row with one of these is a `booking`, whatever its type. */
export const BOOKABLE_RULES: readonly BookRuleKind[] = ['fixed_date', 'rolling', 'monthly_release', 'lottery', 'same_day'];

/** The wording of a window whose rule was searched and not published (protected-area-entry 4.5). Dateless: no read date in a public row. */
export const WINDOW_NOT_PUBLISHED = 'Booking window not published; book as early as possible';
/** A check row's note when the record says nothing more: it cannot be booked. */
export const NO_RESERVATION = 'No reservation';

function phaseOf(w: Loose, dayN: number | null, tzDefault: string | null): BookRulePhase | null {
  let kind = w.rule as BookRuleKind;
  if (!BOOK_RULE_KINDS.includes(kind)) return null;
  const closes = typeof w.closes_days_before === 'number' || typeof w.closes_time === 'string';
  if (kind === 'rolling' && typeof w.days_before !== 'number') {
    // a rolling window with no lead cannot say when it opens ("Opens on Day N" would be wrong). With a close it is "on sale until ..."
    // (the seats left after a lottery draw, protected-area-entry 2.4 E); without one it is no rule, and the row keeps its note
    if (!closes) return null;
    kind = 'anytime';
  }
  const tz = typeof w.tz === 'string' ? w.tz : tzDefault;
  const from = month(w.opens_from);
  const to = month(w.opens_to) ?? from;
  const p: BookRulePhase = { kind, daysBefore: kind === 'rolling' ? w.days_before : 0, dayN, time: typeof w.opens_time === 'string' ? w.opens_time : null, tz };
  if (from !== null && to !== null && (kind === 'fixed_date' || kind === 'lottery')) p.months = [from, to];
  if (kind === 'monthly_release' && typeof w.month_lead_days === 'number') p.monthLeadDays = w.month_lead_days;
  if (closes) {
    p.closes = { daysBefore: typeof w.closes_days_before === 'number' ? w.closes_days_before : 0, time: typeof w.closes_time === 'string' ? w.closes_time : null };
  }
  if (typeof w.share_pct === 'number') p.sharePct = w.share_pct;
  return p;
}

/**
 * A capture `window` (a sourced `windowSpec`, or its bare value) as a `BookRuleInput` counted from `dayN`. Null when the window is not a
 * value (gap, `searched_none`, not applicable) or its rule cannot be said. The second phase (`then`) counts from the same day and takes
 * the first phase's zone when it names none.
 */
export function bookRuleFromWindow(window: unknown, dayN: number | null): BookRuleInput | null {
  if (window && typeof window === 'object' && 'state' in (window as object) && (window as Loose).state !== 'value') return null;
  const w = unwrap(window) as Loose | null | undefined;
  if (!w || typeof w !== 'object') return null;
  const head = phaseOf(w, dayN, null);
  if (!head) return null;
  const then = w.then && typeof w.then === 'object' ? phaseOf(w.then as Loose, dayN, head.tz) : null;
  return then ? { ...head, then } : head;
}

/** The window rule of a record (first phase), or null when it has no window value. */
function ruleOf(rec: Loose): BookRuleKind | null {
  const w = unwrap(rec.window) as Loose | null | undefined;
  return w && typeof w === 'object' && BOOK_RULE_KINDS.includes(w.rule) ? (w.rule as BookRuleKind) : null;
}

/** The row kind of a requirement record (protected-area-entry 6.2). A `task` is never derived: it is the trip's own row. */
export function requirementKind(rec: Loose): Exclude<BookingKind, 'task'> {
  const rule = ruleOf(rec);
  const type = String(rec.type ?? '');
  if (rule && BOOKABLE_RULES.includes(rule)) return 'booking';
  if (rule === 'on_arrival') return 'check';
  if (PASS_TYPES.some((t) => under(type, t))) return 'pass';
  if (CHECK_TYPES.some((t) => under(type, t))) return 'check';
  return 'booking';
}

/** A requirement is valid for at most one day (`entry.valid`: a day, a night, an hour, a slot or one entry). Absent validity is not. */
export function singleDay(rec: Loose): boolean {
  const v = (unwrap(rec.entry) as Loose | undefined)?.valid as Loose | undefined;
  if (!v) return false;
  if (v.unit === 'hour' || v.unit === 'slot' || v.unit === 'entry') return true;
  return (v.unit === 'day' || v.unit === 'night') && v.span === 1;
}

/** A phase relative to the day the seat is used: rolling or same_day, in the first phase or the second. */
function dayRelative(rec: Loose): boolean {
  const w = unwrap(rec.window) as Loose | null | undefined;
  const rel = (r: unknown): boolean => r === 'rolling' || r === 'same_day';
  return !!w && typeof w === 'object' && (rel(w.rule) || rel((w.then as Loose | undefined)?.rule));
}

/** The requirement's booking page: `book_url`, else its `booking` link, else its `official` link. */
export function requirementLink(rec: Loose): string | null {
  const url = unwrap(rec.book_url);
  if (typeof url === 'string' && url) return url;
  const links = Array.isArray(rec.links) ? (rec.links as Loose[]) : [];
  const pick = (k: string): string | null => {
    const l = links.find((x) => x?.kind === k && typeof x.url === 'string');
    return l ? (l.url as string) : null;
  };
  return pick('booking') ?? pick('official');
}

export interface RequirementRowOpts {
  /** the opaque row key; per-day rows get `:d<day>` added. Never a capture ref (legacy refs name dated trip folders). */
  key: string;
  /** the trip days the requirement is used on, ascending or not */
  days: readonly number[];
  /** the park or zone name the row is needed for */
  park?: string | null;
  /** the row's name; the record's name when absent */
  name?: string;
  /** the row's note (already public); WINDOW_NOT_PUBLISHED when the window was searched and none found, else none */
  note?: string | null;
  /** the stop's place slug, so `withStopBookings` puts the text next to that stop */
  placeSlug?: string | null;
}

/**
 * The Book ahead rows of one requirement for a trip (protected-area-entry 6.2). **One row per ridden day** (the shuttle decision): a
 * requirement whose window counts from the day of use (rolling or same_day, in either phase) and that is valid for one day at most gives
 * one row per day used, each with its own Day N. Everything else gives one row for its days, counted from the first.
 */
export function requirementRows(rec: Loose, opts: RequirementRowOpts): BookingSource[] {
  const days = [...new Set(opts.days)].sort((a, b) => a - b);
  const kind = requirementKind(rec);
  const searchedNone = rec.window && typeof rec.window === 'object' && (rec.window as Loose).state === 'searched_none';
  // a check with nothing else to say still says why it is listed (6.2: "No reservation; ...")
  const note = opts.note !== undefined ? opts.note : searchedNone ? WINDOW_NOT_PUBLISHED : kind === 'check' && !ruleOf(rec) ? NO_RESERVATION : null;
  const base = { name: opts.name ?? String(rec.name ?? ''), placeSlug: opts.placeSlug ?? null, bookNote: note, bookKind: kind, park: opts.park ?? null, link: requirementLink(rec) };
  if (days.length > 1 && dayRelative(rec) && singleDay(rec)) {
    return days.map((d) => ({ ...base, key: `${opts.key}:d${d}`, days: [d], bookRule: bookRuleFromWindow(rec.window, d) }));
  }
  const first = days.length ? days[0]! : null;
  return [{ ...base, key: opts.key, days, bookRule: bookRuleFromWindow(rec.window, first) }];
}
