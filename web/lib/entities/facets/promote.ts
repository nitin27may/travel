// The facets a scope promotes into the bar (contract 7.2). The marker is data in the registry (`promote` on a property's filter,
// core/src/schema/capture/properties.ts), carried here by the slice: the most specific scope that takes the Kind wins, and the rank
// (1, 2) orders its facets.
import { SLICE, paramOf, scopeTakes } from './scope';
import type { ContractSlice } from './slice';

/** Specificity: a longer type id beats a shorter one, and any type id beats an intent. */
const weight = (scope: string): number => (scope.startsWith('intent:') ? 0 : scope.split('.').length);

/** The promoted facet params for the first scope token, in rank order. Base facets keep their own param; the rest are `f.<name>`. */
export function promotedFor(tokens: readonly string[], s: ContractSlice = SLICE): string[] {
  const token = tokens[0];
  if (!token) return [];
  let best: { w: number; ids: { rank: number; param: string }[] } | null = null;
  const byScope = new Map<string, { rank: number; param: string }[]>();
  for (const f of s.facets) {
    for (const [scope, rank] of Object.entries(f.promote ?? {})) {
      if (!scopeTakes(scope, token, s)) continue;
      byScope.set(scope, [...(byScope.get(scope) ?? []), { rank, param: paramOf(f) }]);
    }
  }
  for (const [scope, ids] of byScope) {
    const w = weight(scope);
    if (!best || w > best.w) best = { w, ids };
  }
  return best ? best.ids.sort((a, b) => a.rank - b.rank).map((x) => x.param) : [];
}
