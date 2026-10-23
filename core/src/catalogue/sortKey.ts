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
 * The substring rule for NAMES: sortKey(q) is a substring of sortKey of the fields joined by one space. It was the list `q` rule until
 * 23 Oct 2026 (A16); lists, counts and card filters now use the list's word rule (core/src/query/text.ts, review API3-R-7). What is
 * left is the stub's stand-in for typeahead `search`.
 */
export const textKey = (fields: readonly (string | null | undefined)[]): string => sortKey(fields.filter(Boolean).join(" "));

export function matchesText(q: string | undefined, fields: readonly (string | null | undefined)[]): boolean {
  const want = sortKey(q ?? "");
  return !want || textKey(fields).includes(want);
}
