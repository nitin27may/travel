import type { EngineCounts, ListEngine, ListFilter } from '@travel/core/catalogue/json/source.ts';
import { facetCounts, gapCounts, gapNotes, filterRows, scopeTotal } from '@/lib/entities/filter';
import { uncheckedRows } from '@/lib/entities/gaps';
import type { EntityDescriptor, FacetParam, ListState } from '@/lib/entities/types';
import { emptyState } from '@/lib/entities/url';

/**
 * The list engine of a store (store.ts A21, A22): the same filter, counts, gap notes and "not checked yet" rows the browser uses on the
 * list pages, behind the core `ListEngine` interface. It moves into core with the query modules in API-2 (EXECUTION-PLAN 4.9).
 */
export function engineFor<Row>(d: EntityDescriptor<Row>): ListEngine<Row> {
  const params = new Set<string>(d.facets.filter((f) => !f.hidden).map((f) => f.param));
  const stateOf = (f: ListFilter): ListState => ({ ...emptyState(), facets: f.facets as Partial<Record<FacetParam, string[]>>, bbox: f.bbox ? f.bbox.join(',') : null });
  return {
    knows: (param) => params.has(param),
    match: (rows, f) => filterRows(rows, stateOf(f), d),
    counts(rows, f, all): EngineCounts {
      const state = stateOf(f);
      return {
        facets: facetCounts(rows, state, d),
        gaps: gapCounts(rows, state, d),
        notes: gapNotes(rows, state, d),
        scope: scopeTotal(all, state, d),
        unchecked: uncheckedRows(rows, state, d).reduce((n, g) => n + g.rows.length, 0),
      };
    },
    unchecked: (rows, f, only) => uncheckedRows(rows, stateOf(f), d, only as FacetParam[] | undefined).map((g) => ({ key: g.param, label: g.label, note: g.note, rows: g.rows })),
  };
}
