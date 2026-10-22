// Contract facets as FacetDefs (contract 7): one per facet that is not already a base facet of the list, all under "More filters",
// all `scoped`. A new facet is a registry change plus a regenerated slice; a new type is a types.json change.
import { FLAG_OF_PROPERTY } from '../../capture/bandKeys.ts';
import type { FacetDef, ScopedParam } from '../types.ts';
import { answersOf, orderOf } from './answers.ts';
import type { FacetRow } from './answers.ts';
import { BASE_FACET_OF_PROPERTY } from './scope.ts';
import { SLICE } from './scope.ts';
import type { ContractSlice } from './slice.ts';

export function scopedFacets<Row extends FacetRow>(s: ContractSlice = SLICE): FacetDef<Row>[] {
  return s.facets
    .filter((f) => !(f.property in BASE_FACET_OF_PROPERTY))
    .map((f): FacetDef<Row> => ({
      param: `f.${f.key}` as ScopedParam,
      label: f.label,
      // a range or enum facet may take several values ("Under 1 hour or 1 to 2 hours"); a yes/no facet takes one
      type: f.control === 'bool' || FLAG_OF_PROPERTY[f.property] ? 'single' : 'multi',
      tier: 'more',
      scoped: true,
      order: orderOf(f),
      options: (row) => answersOf(f, row),
    }));
}
