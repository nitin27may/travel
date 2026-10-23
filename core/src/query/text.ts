// The ONE free-text rule of a list (store.ts A16, amended 23 Oct 2026 by review API3-R-7): a row matches when EVERY word of the query
// (lower case, split on white space) is a substring of the row's haystack. The haystack is the wider text a list row offers: for a place
// its name, area, region, country, tag labels, kind label and kind; for a trip its title, region, country and first base. The browser's
// list, the StaticAdapter's local count, JsonStore, StubStore and a SupabaseStore (an ILIKE ALL prefilter on a folded column, confirmed
// here) all call these functions, so a count and the rows beside it cannot disagree.
//
// Pure: no I/O, no web imports.

const lc = (s: string): string => s.toLocaleLowerCase('en');

let lastQ = '';
let lastWords: string[] = [];
/** The words of a query, split once: the same string is tested against every row. */
export function queryWords(q: string): string[] {
  if (q !== lastQ) {
    lastQ = q;
    lastWords = lc(q).split(/\s+/).filter(Boolean);
  }
  return lastWords;
}

/** The haystack of a place row (a list row or a store's `PlaceRow`). */
export const placeHaystack = (p: { name: string; area_name: string; region_name: string; country_name: string; tags: readonly { label: string }[]; kindLabel: string; kind: string }): string =>
  [p.name, p.area_name, p.region_name, p.country_name, p.tags.map((t) => t.label).join(' '), p.kindLabel, p.kind].join(' ');

/** The haystack of a trip row. */
export const tripHaystack = (t: { title: string; region: string; countryName: string; firstBase: string | null }): string =>
  [t.title, t.region, t.countryName, t.firstBase ?? ''].join(' ');

/** Does a lower-cased haystack hold every word? An empty list of words holds in everything. */
export const hasWords = (words: readonly string[], hayLower: string): boolean => words.every((w) => hayLower.includes(w));

// the lower-cased haystack of a row, made once per row and haystack function: a text search runs it for every row, several times a
// keystroke (10,000 rows, backlog 2.41)
const caches = new WeakMap<object, WeakMap<object, string>>();

/** The lower-cased haystack of `row` under `hay`, kept for the row. */
export function lowerHaystack<Row>(row: Row, hay: (row: Row) => string): string {
  if (typeof row !== 'object' || row === null) return lc(hay(row));
  let per = caches.get(hay);
  if (!per) caches.set(hay, (per = new WeakMap()));
  let h = per.get(row);
  if (h === undefined) per.set(row, (h = lc(hay(row))));
  return h;
}

/** The rule: no words (an empty or blank query) matches everything. */
export function matchesFreeText<Row>(q: string | undefined, row: Row, hay: (row: Row) => string): boolean {
  if (!q || !q.trim()) return true;
  return hasWords(queryWords(q), lowerHaystack(row, hay));
}
