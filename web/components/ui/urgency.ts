/**
 * The one urgency rule (tokens.md 3.1). Every due date, deadline and booking window in the product goes
 * through this function; no component keeps its own threshold.
 *
 *   urgent  due within 7 days (today is day 0), or missed, or a window that opens within 48 hours
 *   caution due in 8 to 30 days, or a window that is open now
 *   neutral beyond 30 days, no date, or a window that opens later
 */
export type Urgency = 'urgent' | 'caution' | 'neutral';

export const URGENT_DAYS = 7;
export const CAUTION_DAYS = 30;
export const WINDOW_OPENS_HOURS = 48;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export interface UrgencyInput {
  /** Book-by or due date (ISO date or Date). */
  due?: string | Date | null;
  /** When a booking window opens, and whether it is open now. */
  windowOpens?: string | Date | null;
  windowOpen?: boolean;
  /** Defaults to now. The household's local date is what the caller should pass. */
  now?: Date;
}

const asDate = (v: string | Date): Date => (v instanceof Date ? v : new Date(v.length === 10 ? `${v}T00:00:00` : v));
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole local days from today to `due`; negative once missed. */
export function daysUntil(due: string | Date, now: Date = new Date()): number {
  return Math.round((startOfDay(asDate(due)) - startOfDay(now)) / DAY_MS);
}

export function urgency({ due, windowOpens, windowOpen, now = new Date() }: UrgencyInput): Urgency {
  if (windowOpens) {
    const ms = asDate(windowOpens).getTime() - now.getTime();
    if (ms > 0 && ms <= WINDOW_OPENS_HOURS * HOUR_MS) return 'urgent';
  }
  if (due) {
    const days = daysUntil(due, now);
    if (days <= URGENT_DAYS) return 'urgent';
    if (days <= CAUTION_DAYS) return 'caution';
    return windowOpen ? 'caution' : 'neutral';
  }
  return windowOpen ? 'caution' : 'neutral';
}
