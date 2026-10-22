// Calendar-date helpers on plain ISO strings (YYYY-MM-DD) in UTC, so a picked date never shifts with the device zone.
// Also the statutory-holiday and school-break calendar behind the date picker shading (components 2.4, F03).

export const pad = (n: number, w = 2) => String(n).padStart(w, '0');
export const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const parseIso = (s: string): Date => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Not an ISO date: ${s}`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
};
export const addDays = (s: string, n: number): string => {
  const d = parseIso(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
/** 0 = Sunday. */
export const weekday = (s: string): number => parseIso(s).getUTCDay();
export const isWeekend = (s: string): boolean => [0, 6].includes(weekday(s));

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** "Tue 13 Jul 2027" (the form the date input shows) or, without the year, "Tue 13 Jul". */
export function formatDate(s: string, withYear = true): string {
  const d = parseIso(s);
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}${withYear ? ` ${d.getUTCFullYear()}` : ''}`;
}
export const compact = (s: string): string => s.replace(/-/g, '');

// ---- season window ----------------------------------------------------------------------------------------------------

export interface SeasonWindow {
  from: string;
  to: string;
}
/** "MM-DD" of an ISO date or of an already-short value. */
const md = (s: string): string => (s.length >= 10 ? s.slice(5, 10) : s.slice(0, 5));

/** True when the calendar day (any year) sits inside the window. Windows that wrap the new year (Nov to Feb) work. */
export function inWindow(window: SeasonWindow | undefined, date: string): boolean {
  if (!window) return true;
  const day = md(date);
  const from = md(window.from);
  const to = md(window.to);
  return from <= to ? day >= from && day <= to : day >= from || day <= to;
}

export interface WindowCheck {
  ok: boolean;
  /** Which end falls outside, for the warning text. */
  startOutside: boolean;
  endOutside: boolean;
}
export function checkWindow(window: SeasonWindow | undefined, start: string, days: number): WindowCheck {
  const startOutside = !inWindow(window, start);
  const endOutside = !inWindow(window, addDays(start, Math.max(0, days - 1)));
  return { ok: !startOutside && !endOutside, startOutside, endOutside };
}

// ---- holidays and school breaks (the household's region: Ontario) ------------------------------------------------------

function nthWeekday(year: number, month: number, dow: number, n: number): string {
  const first = new Date(Date.UTC(year, month, 1));
  const shift = (dow - first.getUTCDay() + 7) % 7;
  return iso(new Date(Date.UTC(year, month, 1 + shift + (n - 1) * 7)));
}
function mondayBefore(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month, day));
  const back = (d.getUTCDay() + 6) % 7 || 7;
  d.setUTCDate(d.getUTCDate() - back);
  return iso(d);
}
/** Gregorian Easter Sunday (anonymous algorithm). */
function easter(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(new Date(Date.UTC(year, month - 1, day)));
}

export interface Holiday {
  date: string;
  name: string;
}
/** Statutory holidays that make a long weekend (a Monday or a Friday). Ontario. */
export function holidays(year: number): Holiday[] {
  const all: Holiday[] = [
    { date: nthWeekday(year, 1, 1, 3), name: 'Family Day' },
    { date: addDays(easter(year), -2), name: 'Good Friday' },
    { date: mondayBefore(year, 4, 25), name: 'Victoria Day' },
    { date: `${year}-07-01`, name: 'Canada Day' },
    { date: nthWeekday(year, 8, 1, 1), name: 'Labour Day' },
    { date: nthWeekday(year, 9, 1, 2), name: 'Thanksgiving' },
    { date: `${year}-12-25`, name: 'Christmas Day' },
    { date: `${year}-12-26`, name: 'Boxing Day' },
  ];
  return all.filter((h) => [1, 5].includes(weekday(h.date)));
}

export interface SchoolBreak {
  from: string;
  to: string;
  name: string;
}
/** Ontario public-school breaks, approximate: a family checks its own board's calendar before booking. */
export function schoolBreaks(year: number): SchoolBreak[] {
  const d = new Date(Date.UTC(year, 2, 13));
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7));
  const marchMon = iso(d);
  return [
    { from: `${year}-01-01`, to: `${year}-01-03`, name: 'Winter break' },
    { from: marchMon, to: addDays(marchMon, 4), name: 'March break' },
    { from: `${year}-07-01`, to: addDays(nthWeekday(year, 8, 1, 1), -1), name: 'Summer break' },
    { from: `${year}-12-21`, to: `${year}-12-31`, name: 'Winter break' },
  ];
}

export interface DayShade {
  weekend: boolean;
  /** Set on the holiday and on the weekend days that join it. */
  longWeekend: string | null;
  schoolBreak: string | null;
}
/** Everything the picker shades for one day. */
export function shadeOf(date: string): DayShade {
  const year = +date.slice(0, 4);
  const hs = [...holidays(year - 1), ...holidays(year), ...holidays(year + 1)];
  let longWeekend: string | null = null;
  for (const h of hs) {
    const w = weekday(h.date);
    const span = w === 1 ? [-2, -1, 0] : [0, 1, 2];
    if (span.some((o) => addDays(h.date, o) === date)) longWeekend = h.name;
  }
  const sb = schoolBreaks(year).find((b) => date >= b.from && date <= b.to);
  return { weekend: isWeekend(date), longWeekend, schoolBreak: sb?.name ?? null };
}

/** The accessible name of a cell: "Saturday 10 October, weekend, long weekend: Thanksgiving", each qualifier only when true. */
export function cellLabel(date: string, s: DayShade, inSeason: boolean | null): string {
  const d = parseIso(date);
  const parts = [`${DOW_LONG[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_LONG[d.getUTCMonth()]}`];
  if (s.weekend) parts.push('weekend');
  if (s.longWeekend) parts.push(`long weekend: ${s.longWeekend}`);
  if (s.schoolBreak) parts.push(`school break: ${s.schoolBreak}`);
  if (inSeason === true) parts.push('in the trip season');
  return parts.join(', ');
}
