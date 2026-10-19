// The facets a scope promotes into the bar (contract 7.2). The table is data (promote.json); this picks the most specific entry.
import promote from './promote.json';
import { SLICE, scopeTakes } from './scope';
import type { ContractSlice } from './slice';

export const PROMOTE_TABLE: Record<string, string[]> = promote.scopes;

/** Specificity: a longer type id beats a shorter one, and any type id beats an intent. */
const weight = (scope: string): number => (scope.startsWith('intent:') ? 0 : scope.split('.').length);

/** The promoted facet params for the first scope token, in the table's order. Base facets keep their own param; the rest are `f.<name>`. */
export function promotedFor(tokens: readonly string[], table: Record<string, string[]> = PROMOTE_TABLE, s: ContractSlice = SLICE): string[] {
  const token = tokens[0];
  if (!token) return [];
  const hits = Object.keys(table)
    .filter((scope) => scopeTakes(scope, token, s))
    .sort((a, b) => weight(b) - weight(a));
  const winner = hits[0];
  if (!winner) return [];
  return table[winner]!.map((id) => (id === 'effort' || id === 'kid' || id === 'stroller' ? id : `f.${id}`));
}
