// The stored sort key (D-B5; schema diff risk 10). Every paged method sorts by `sortKey(name)` with `ref` as the tiebreaker, so
// JsonStore and SupabaseStore cut page 2 at the same row: the key is part of the store's projection, SupabaseStore stores it and sorts
// with `collate "C"`, which orders UTF-8 bytes, which is code-point order. JS `<` on strings orders UTF-16 code units, which differs from
// code-point order for characters above U+FFFF, so the comparison here walks code points. Never `localeCompare`: its order depends on
// the runtime's ICU data and the locale.

/** NFKD, combining marks stripped, lower case, runs of white space as one space, trimmed. "Lac Supérieur" -> "lac superieur". */
export function sortKey(name: string): string {
  return name.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Code-point order, the order of `collate "C"` over UTF-8. */
export function compareCodePoints(a: string, b: string): number {
  if (a === b) return 0;
  const ia = a[Symbol.iterator]();
  const ib = b[Symbol.iterator]();
  for (;;) {
    const x = ia.next();
    const y = ib.next();
    if (x.done) return y.done ? 0 : -1;
    if (y.done) return 1;
    const d = x.value.codePointAt(0)! - y.value.codePointAt(0)!;
    if (d !== 0) return d < 0 ? -1 : 1;
  }
}

/** The order of every paged method: sort key, then `ref`, both in code-point order. Total: two rows never compare equal unless their refs do. */
export function compareSortable(a: { sortKey: string; ref: string }, b: { sortKey: string; ref: string }): number {
  return compareCodePoints(a.sortKey, b.sortKey) || compareCodePoints(a.ref, b.ref);
}

/** Sorts rows by the key of `name` and their `ref`, without mutating the input. */
export function sortByName<T extends { name: string; ref: string }>(rows: readonly T[]): T[] {
  return rows
    .map((row) => ({ row, sortKey: sortKey(row.name), ref: row.ref }))
    .sort(compareSortable)
    .map((x) => x.row);
}

/**
 * The free-text `q` rule of every list and of search (review R-11): a row matches when sortKey(q) is a substring of sortKey of its text
 * fields joined by one space. Places match on name, area and region; trips on title, region and country; search records on name and match
 * text. SupabaseStore stores that key as a column computed by core (`search_key`) and tests `position(sortKey(q) in search_key) > 0`.
 */
export const textKey = (fields: readonly (string | null | undefined)[]): string => sortKey(fields.filter(Boolean).join(" "));

export function matchesText(q: string | undefined, fields: readonly (string | null | undefined)[]): boolean {
  const want = sortKey(q ?? "");
  return !want || textKey(fields).includes(want);
}

/** The text fields `q` reads, per row kind: written once so every store indexes the same words. */
export const PLACE_TEXT = (r: { name: string; area_name: string; region_name: string }): string[] => [r.name, r.area_name, r.region_name];
export const TRIP_TEXT = (r: { title: string; region: string; countryName: string }): string[] => [r.title, r.region, r.countryName];
