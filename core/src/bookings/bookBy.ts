// Recommended book-by, computed (plan 2.3, "Recommended book-by, computed"). The one implementation: the day checks,
// trip_booking.upsert, the Timeline and bookings.due all call it.
//
// Offsets count days from Day 1 of an edition (Day 1 = 0, so day n is n - 1). U is the offset of the first used day.
import { addDays } from "../checks/time.ts";

type Row = Record<string, any>;

export interface BookByResult {
  /** days from Day 1 of the edition; null when the rule cannot be turned into an offset */
  offset: number | null;
  /** an absolute date, for the fixed-date, monthly-release and lottery rows */
  deadline_date?: string;
  basis: "computed" | "inference";
  /** true when no window facts exist and the conservative default was used */
  gap: boolean;
  /** offset at which booking opens, when known (the Timeline's "not yet open" state) */
  opens_offset: number | null;
  /** which row of the table applied */
  rule: "minutes-after-release" | "rolling-lead" | "fixed-date" | "never-sells-out" | "unknown";
}

export interface BookByInput {
  /** day numbers the booking is used on */
  used_days: number[];
  /** the booking's own category, used when there is no offer */
  category?: string | null;
  /** ISO date of Day 1 of the edition; needed for absolute rules and the peak-month test */
  editionStart?: string | null;
}

/** months the "unknown window" default treats as peak for flights and lodging: northern summer and the December holidays */
export const PEAK_MONTHS: readonly number[] = [6, 7, 8, 12];

const FLIGHT_OR_LODGING = new Set(["flight-intl", "flight-domestic", "lodging", "hut"]);
const TOURS = new Set(["tour", "activity", "permit", "timed-entry", "ferry"]);

function dayDiff(a: string, b: string): number {
  const t = (s: string): number => {
    const [y, m, d] = s.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(a) - t(b)) / 86400000);
}

/** the first ISO date in a free-text opening rule such as "opens 2027-03-01 at 09:00" */
function dateIn(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const m = /\b(\d{4}-\d{2}-\d{2})\b/.exec(text);
  return m ? m[1]! : null;
}

export function firstUsedOffset(usedDays: number[]): number {
  return usedDays.length > 0 ? Math.min(...usedDays) - 1 : 0;
}

export function computeBookBy(offer: Row | null, input: BookByInput): BookByResult {
  const U = firstUsedOffset(input.used_days);
  const start = input.editionStart ?? null;
  const category = offer?.category ?? input.category ?? null;

  const fallback = (): BookByResult => {
    const date = start ? addDays(start, U) : null;
    const month = date ? Number(date.slice(5, 7)) : null;
    const peak = month !== null && PEAK_MONTHS.includes(month);
    let lead = 30;
    if (category && FLIGHT_OR_LODGING.has(category) && peak) lead = 120;
    else if (category && TOURS.has(category)) lead = 60;
    return { offset: U - lead, basis: "inference", gap: true, opens_offset: null, rule: "unknown" };
  };

  if (!offer) return fallback();

  const kind = offer.opens_kind as string;
  const lead = typeof offer.opens_lead_days === "number" ? offer.opens_lead_days : null;
  const sellKind = offer.sellout_kind as string;
  const sellLead = typeof offer.sellout_lead_days === "number" ? offer.sellout_lead_days : null;

  // the opening, as an offset and (for absolute rules) a date
  let opens: number | null = null;
  let openDate: string | null = null;
  if (kind === "rolling-lead" && lead !== null) opens = U - lead;
  else if (kind === "fixed-date" || kind === "monthly-release" || kind === "lottery") {
    openDate = dateIn(offer.opens_rule);
    if (openDate && start) opens = dayDiff(openDate, start);
  } else if (kind === "always-open" || kind === "on-arrival") opens = null;

  const absolute = kind === "fixed-date" || kind === "monthly-release" || kind === "lottery";

  if (sellKind === "minutes-after-release") {
    if (opens !== null) return { offset: opens, ...(openDate ? { deadline_date: openDate } : {}), basis: "computed", gap: false, opens_offset: opens, rule: "minutes-after-release" };
    return fallback();
  }
  if (sellKind === "never" && !absolute) {
    // book late is fine: a week ahead, or the day before when walk-up tickets exist; never before it opens
    const late = U - (offer.same_day === "yes" ? 1 : 7);
    return { offset: opens !== null ? Math.max(late, opens) : late, basis: "computed", gap: false, opens_offset: opens, rule: "never-sells-out" };
  }
  if (kind === "rolling-lead" && lead !== null) {
    const offset = sellLead !== null ? Math.max(U - lead, U - sellLead - 14) : U - lead;
    return { offset, basis: "computed", gap: false, opens_offset: U - lead, rule: "rolling-lead" };
  }
  if (absolute) {
    if (openDate && opens !== null) return { offset: opens, deadline_date: openDate, basis: "computed", gap: false, opens_offset: opens, rule: "fixed-date" };
    return fallback();
  }
  if (sellKind === "never") {
    return { offset: U - (offer.same_day === "yes" ? 1 : 7), basis: "computed", gap: false, opens_offset: null, rule: "never-sells-out" };
  }
  return fallback();
}

/** The deadline as a date for an edition, from a result */
export function deadlineOf(result: Pick<BookByResult, "offset" | "deadline_date">, editionStart: string | null): string | null {
  if (result.deadline_date) return result.deadline_date;
  if (result.offset !== null && editionStart) return addDays(editionStart, result.offset);
  return null;
}

/** bookBy() for a trip_bookings row against the catalog: the stored offset when the owner set it, else the computed one */
export function bookByOf(booking: Row, catalog: { offer(id: string): Row | null }, editionStart: string | null): BookByResult {
  const stored = typeof booking.book_by_offset === "number" ? booking.book_by_offset : null;
  if (booking.book_by_basis === "owner") {
    return { offset: stored, ...(booking.deadline_date ? { deadline_date: booking.deadline_date } : {}), basis: "computed", gap: false, opens_offset: null, rule: "unknown" };
  }
  const offer = booking.offer_id ? catalog.offer(booking.offer_id) : null;
  return computeBookBy(offer, { used_days: booking.used_days ?? [], category: booking.category, editionStart });
}
