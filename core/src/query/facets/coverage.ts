// The 60% rule (capture contract 7.1 rule 3): a facet shows only when at least 60% of the records in scope answer it and at least
// two values occur. Otherwise it is hidden and the count line says why. This keeps gaps from producing empty filters (P1, P4).
import type { FacetDef } from '../types.ts';

export const MIN_COVERAGE = 0.6;
export const MIN_VALUES = 2;

export interface Coverage {
  param: string;
  label: string;
  answered: number;
  total: number;
  values: number;
  /** Whether the facet can split the results. */
  shows: boolean;
}

export function coverageOf<Row>(facet: FacetDef<Row>, scopeRows: readonly Row[]): Coverage {
  const seen = new Set<string>();
  let answered = 0;
  for (const row of scopeRows) {
    const opts = facet.options(row);
    if (opts.length) answered += 1;
    for (const o of opts) seen.add(o.value);
  }
  const total = scopeRows.length;
  return { param: facet.param, label: facet.label, answered, total, values: seen.size, shows: total > 0 && answered / total >= MIN_COVERAGE && seen.size >= MIN_VALUES };
}

/** The count-line text for hidden facets: "Duration hidden: not known for most results". */
export function hiddenNote(hidden: readonly Coverage[]): string | null {
  // nothing in scope, nothing to say; a long list is shortened so the count line stays a line
  const real = hidden.filter((h) => h.total > 0);
  if (!real.length) return null;
  const names = real.length > 3 ? [...real.slice(0, 2).map((h) => h.label), `${real.length - 2} more`] : real.map((h) => h.label);
  const list = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `${list} hidden: not known for most results`;
}
