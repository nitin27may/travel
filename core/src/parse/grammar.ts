// The numeric grammar of the parser (smart-search 4.2): figures, bands and the trip-length classes. Words come from the vocabulary;
// only the structure that cannot be a word list lives here. `tests/search/parse.test.ts` pins every id below against the real facets.

export type Mod = 'max' | 'min' | null;

/**
 * Owner questions that were answered as recommended but not confirmed (smart-search.md section 14, 19 Oct 2026). Each one is read in
 * a single place, so a different answer is a small change here and one branch there. A test runs the other answer for Q40.
 */
export interface Decisions {
  /** Q36: distances are the existing bands, and the chip names the band. `exact` (km= and gain= keys) needs new URL keys, so it is not built in phase 1. */
  distance: 'bands';
  /** Q40: what "with kids" does when no age is given. `yes` sets kid=yes; `ask` shows a question chip and sets nothing; `none` lists the words as not used. */
  kidsWithoutAge: { places: 'yes' | 'ask' | 'none'; trips: 'ask' | 'none' };
  /** Q39: where the parser runs. Read by the UI wiring, which is not built yet. */
  runsIn: 'all-search-boxes' | 'header-only';
  /** Q39: the list pages show "Read 'x' as 4 filters - Search the words instead" under the box. */
  undoLine: boolean;
}
export const DECISIONS: Decisions = { distance: 'bands', kidsWithoutAge: { places: 'ask', trips: 'ask' }, runsIn: 'all-search-boxes', undoLine: true };

/** [id, label, from, to): the bands the Places list filters on. A band holds a value v when from <= v < to. */
export type Band = readonly [id: string, label: string, from: number, to: number];

export const LENGTH_BANDS: readonly Band[] = [
  ['lt3', 'Under 3 km', 0, 3],
  ['3-6', '3 to 6 km', 3, 6],
  ['6-10', '6 to 10 km', 6, 10],
  ['10+', '10 km and more', 10, Infinity],
];
export const CLIMB_BANDS: readonly Band[] = [
  ['lt150', 'Under 150 m', 0, 150],
  ['150-400', '150 to 400 m', 150, 400],
  ['400-800', '400 to 800 m', 400, 800],
  ['800+', '800 m and more', 800, Infinity],
];
/** Minutes. Half a day is 4 to 6 hours, a full day 6 to 12. */
export const TIME_BANDS: readonly Band[] = [
  ['<1h', 'Under 1 hour', 0, 60],
  ['1-2h', '1 to 2 hours', 60, 120],
  ['2-4h', '2 to 4 hours', 120, 240],
  ['half-day', 'Half a day', 240, 360],
  ['full-day', 'A full day', 360, 720],
  ['multi-day', 'Several days', 720, Infinity],
];

export interface BandPick {
  ids: string[];
  /** True when the figure sits on the edge of the bands taken, so the chip needs no "nearest band" note (A10, H6). */
  exact: boolean;
  /** The upper edge of the last band for `max`, the lower edge of the first for `min`, the holding band's label for none. */
  edge: number;
  label: string;
}

/**
 * The bands a figure asks for (A10). "under 5 km" takes every band that can hold a value below 5; "over 5 km" every band that can hold
 * a value above 5; a bare figure takes the band that holds it. Nothing is invented between the bands, so a chip says when it rounded.
 */
export function pickBands(bands: readonly Band[], mod: Mod, n: number): BandPick | null {
  if (mod === 'max') {
    const hit = bands.filter((b) => b[2] < n);
    if (!hit.length) return null;
    const edge = hit[hit.length - 1]![3];
    return { ids: hit.map((b) => b[0]), exact: edge === n, edge, label: '' };
  }
  if (mod === 'min') {
    const hit = bands.filter((b) => b[3] > n);
    if (!hit.length) return null;
    const edge = hit[0]![2];
    return { ids: hit.map((b) => b[0]), exact: edge === n, edge, label: '' };
  }
  const b = bands.find((x) => n >= x[2] && n < x[3]);
  return b ? { ids: [b[0]], exact: false, edge: b[2], label: b[1] } : null;
}

/** Trips: a stay of this many nights is in this class of the Length filter. */
export function lengthClass(nights: number): string {
  if (nights <= 0) return 'day';
  if (nights === 1) return 'overnight';
  if (nights === 2) return 'weekend';
  if (nights === 3) return 'long-weekend';
  if (nights <= 8) return '4-8';
  if (nights <= 14) return '9-14';
  return '15+';
}

export const KID_AGES: readonly number[] = [4, 6, 8, 10, 12];
/** The Kids filter of a trip is "a plan for a child of this age": a plan for a 6-year-old suits a 7-year-old, so take the largest age not above N. */
export const tripAge = (n: number): number | null => [...KID_AGES].reverse().find((a) => a <= n) ?? null;

/** Trips write the effort in their own words. */
export const TRIP_EFFORT: Record<string, string> = { stroll: 'easy', easy: 'easy', moderate: 'moderate', hard: 'strenuous', technical: 'strenuous' };

export const TRIP_LENGTH_LABEL: Record<string, string> = {
  day: 'Day trip', overnight: 'Overnight', weekend: 'Weekend (2 nights)', 'long-weekend': 'Long weekend (3 nights)', '4-8': '4 to 8 nights', '9-14': '9 to 14 nights', '15+': '15 nights and more',
};

export const HUB_MAX = 4;

/** Words that point at the climb in "500 m climb" (the unit `m` alone is not a climb). */
export const CLIMB_WORDS: readonly string[] = ['climb', 'gain', 'ascent', 'elevation', 'up', 'climbing'];

/** A figure in a token: `5`, `1dot5`, or null. The parser turns "1.5" into "1dot5" before it folds punctuation away. */
export function figure(tok: string | undefined): number | null {
  if (!tok || !/^\d+(dot\d+)?$/.test(tok)) return null;
  return Number(tok.replace('dot', '.'));
}

/** "5km" -> ["5", "km"], "6yo" -> ["6", "yo"]; other tokens stay. */
export function splitFused(tok: string): string[] {
  const m = /^(\d+(?:dot\d+)?)([a-z]{1,3})$/.exec(tok);
  return m ? [m[1]!, m[2]!] : [tok];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthShort = (m: number): string => MONTHS[m - 1]!;

/** The calendar months from a to b, wrapping over the year end (November to February). */
export function monthRange(a: number, b: number): number[] {
  const out = [a];
  for (let m = a; m !== b && out.length < 12; ) {
    m = (m % 12) + 1;
    out.push(m);
  }
  return out;
}

/** Edit distance is exactly one: a letter changed, added, dropped or two swapped (A13). */
export function oneEdit(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  return s.slice(i) === l.slice(i + 1);
}
