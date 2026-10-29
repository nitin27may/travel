// The When chips of stage 1 (FLOW 4): next weekend, a month, dates, not sure yet. Pure; dates are local calendar days as ISO strings.
import { MONTH_NAMES } from './format';

const iso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The coming Saturday as an ISO date: the day after `from` or later (on a Saturday it is the next one). */
export function nextWeekend(from: Date): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  return iso(d);
}

export const monthOfDate = (date: string): number | null => {
  const m = /^\d{4}-(\d{2})-\d{2}$/.exec(date);
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 12 ? n : null;
};

export type WhenKind = 'weekend' | 'month' | 'dates' | 'unsure';

/** Which chip a state reads as. `weekend` is a date that is the coming Saturday. */
export function whenKind(s: { month: number | null; date: string | null }, today: Date): WhenKind {
  if (s.date) return s.date === nextWeekend(today) ? 'weekend' : 'dates';
  return s.month ? 'month' : 'unsure';
}

/** "Next weekend", "July", "12 Jul 2027", "Not sure yet". */
export function whenWords(s: { month: number | null; date: string | null }, today: Date): string {
  const k = whenKind(s, today);
  if (k === 'weekend') return 'Next weekend';
  if (k === 'dates' && s.date) {
    const [y, m, d] = s.date.split('-').map(Number);
    return `${d} ${MONTH_NAMES[m! - 1]!.slice(0, 3)} ${y}`;
  }
  if (k === 'month' && s.month) return MONTH_NAMES[s.month - 1]!;
  return 'Not sure yet';
}
