// Dates to ISO 8601 (S1). Only forms that cannot be read two ways are converted:
//   2026/10/25, 25 Oct 2026, 25 October 2026, Oct 25, 2026, October 25 2026, 25.10.2026 is NOT converted (day-first or month-first).
// "10/25/2026" and "25/10/2026" are converted only when one of the two numbers is above 12; "03/04/2026" is ambiguous and is
// reported, never guessed. A date that is not valid on the calendar (31 Feb) is reported.

/** Keys that hold a date in the data files (Val.read, Val.on, source read, track fetched, ...). */
export const DATE_KEYS: ReadonlySet<string> = new Set([
  "read", "on", "researched", "fetched", "searched", "page_modified", "last_checked", "observed_on", "checked_on", "computed", "updated",
]);

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const monthOf = (w: string): number => MONTHS.indexOf(w.slice(0, 3).toLowerCase()) + 1;

function valid(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= last;
}
const iso = (y: number, m: number, d: number): string => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export interface DateResult {
  /** the ISO date, or null when the text is not a date the normaliser can read without guessing */
  iso: string | null;
}

export function normaliseDate(text: string): DateResult {
  const s = text.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { iso: valid(+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10)) ? s : null };
  let m = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(s);
  if (m) return { iso: valid(+m[1]!, +m[2]!, +m[3]!) ? iso(+m[1]!, +m[2]!, +m[3]!) : null };
  m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/.exec(s);
  if (m && monthOf(m[2]!) > 0) return { iso: valid(+m[3]!, monthOf(m[2]!), +m[1]!) ? iso(+m[3]!, monthOf(m[2]!), +m[1]!) : null };
  m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(s);
  if (m && monthOf(m[1]!) > 0) return { iso: valid(+m[3]!, monthOf(m[1]!), +m[2]!) ? iso(+m[3]!, monthOf(m[1]!), +m[2]!) : null };
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) {
    const a = +m[1]!;
    const b = +m[2]!;
    const y = +m[3]!;
    if (a > 12 && b <= 12) return { iso: valid(y, b, a) ? iso(y, b, a) : null };
    if (b > 12 && a <= 12) return { iso: valid(y, a, b) ? iso(y, a, b) : null };
  }
  return { iso: null };
}
