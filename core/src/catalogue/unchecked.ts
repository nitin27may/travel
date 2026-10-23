// The "not checked yet" page (D-E7, store.ts A27), written once for every store that holds the groups as lists of rows: a row sits in
// the first group it qualifies for, each group runs in the list's sort order (A15), the groups run in the order the engine gives, and
// the whole is one paged list whose `groups` carry the counts across every page.
import type { PlaceRow, UncheckedPage } from "../schema/api/index.ts";
import { PLACE_SORT_VALUES, sortRows } from "./sorting.ts";

export interface UncheckedGroupRows {
  key: string;
  label: string;
  /** the facet's own words for the gap ("not checked yet") */
  note: string;
  rows: readonly PlaceRow[];
}

/** One page of the groups' rows: `page` and `pageSize` are already within the caps. */
export function uncheckedPageOf(groups: readonly UncheckedGroupRows[], sort: readonly string[], page: number, pageSize: number): UncheckedPage {
  const live = groups.filter((g) => g.rows.length);
  const rows = live.flatMap((g) => sortRows(g.rows, sort, PLACE_SORT_VALUES, (r) => r.name).map((r) => ({ ...r, gap: g.key })));
  const start = (page - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    total: rows.length,
    page,
    pageSize,
    nextPage: start + pageSize < rows.length ? page + 1 : null,
    groups: live.map((g) => ({ key: g.key, label: g.label, note: g.note, count: g.rows.length })),
  };
}
