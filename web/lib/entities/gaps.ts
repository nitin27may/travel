// Honesty rule H1 (smart-search 7): a row with no answer for a constraint is never a yes. A row that fails a selection only because
// it has no answer for it leaves the main results and is listed apart, per constraint, as "not checked yet". The facets already say
// what a gap is (`gap.isGap`, or no option at all for a Kind-scoped facet); this reads that, so there is one definition of a gap.
import { matchesRow } from './filter';
import type { EntityDescriptor, FacetDef, FacetParam, ListState } from './types';

export interface UncheckedGroup<Row> {
  param: FacetParam;
  label: string;
  /** The facet's own words for the gap ("not checked yet"). */
  note: string;
  rows: Row[];
}

/** Does this row have no answer for the facet, given the selection? A known "no" is an answer and is not a gap (H2). */
export function isGapRow<Row>(row: Row, facet: FacetDef<Row>, selected: readonly string[]): boolean {
  const gap = facet.gap;
  if (gap) {
    if (selected.includes(gap.value)) return false;
    return gap.isGap ? gap.isGap(row, [...selected]) : facet.options(row).some((o) => o.value === gap.value);
  }
  // a Kind-scoped facet answers or it does not: a row with no option for it has not been checked
  return Boolean(facet.scoped) && facet.options(row).length === 0;
}

/**
 * The rows left out of the answer only because of a gap. A row appears once, under the first constraint it is a gap for, and only if
 * it passes every other filter. `only` limits the groups to those constraints (the ones a parse wrote); without it every selected
 * constraint is considered.
 */
export function uncheckedRows<Row>(rows: readonly Row[], state: ListState, d: EntityDescriptor<Row>, only?: readonly FacetParam[]): UncheckedGroup<Row>[] {
  const out: UncheckedGroup<Row>[] = [];
  const seen = new Set<Row>();
  for (const facet of d.facets) {
    const selected = state.facets[facet.param] ?? [];
    if (!selected.length || facet.hidden || (only && !only.includes(facet.param))) continue;
    if (!facet.gap && !facet.scoped) continue;
    const hit: Row[] = [];
    for (const row of rows) {
      if (seen.has(row) || !matchesRow(row, state, d, facet.param) || !isGapRow(row, facet, selected)) continue;
      seen.add(row);
      hit.push(row);
    }
    if (hit.length) out.push({ param: facet.param, label: facet.label, note: facet.gap?.note ?? 'not checked yet', rows: hit });
  }
  return out;
}
