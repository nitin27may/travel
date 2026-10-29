// Words for minutes and drive figures (FLOW "≈" rule: every estimate carries it). Pure.
export const APPROX = '≈';

/** 150 -> "2 h 30", 120 -> "2 h", 45 -> "45 min". */
export function durationText(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`;
}

/** "2 h 20 ≈" for an estimate, "2 h 20" for a routed figure. */
export const driveText = (min: number, basis: 'routed' | 'estimate' | null): string => (basis === 'routed' ? durationText(min) : `${durationText(min)} ${APPROX}`);

/** "3 h" for the reach pills: whole hours when they are, else "2 h 30". */
export const reachText = (min: number): string => durationText(min);

export const plural = (n: number, one: string, many: string = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
export const monthName = (m: number): string => MONTHS[m - 1] ?? '';
export const MONTH_NAMES = MONTHS;
