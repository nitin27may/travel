// The type-aware facet engine (capture contract 7). A list that has a Kind (Places) is narrowed to a scope; the scope brings its
// facets, promotes up to two into the bar and hides the ones that cannot split the results.
import type { EntityDescriptor, FacetParam, ListState } from '../types';
import { coverageOf, hiddenNote } from './coverage';
import type { Coverage } from './coverage';
import { promotedFor } from './promote';
import { SLICE, facetsForScope, paramOf, typeInScope } from './scope';
import type { ContractSlice } from './slice';

export * from './answers';
export * from './coverage';
export * from './fromContract';
export * from './promote';
export * from './scope';
export * from './slice';

/** The scope tokens a state narrows to: `k=` values, and what an old `kind=` value stands for. */
export function scopeTokens<Row>(d: EntityDescriptor<Row>, state: ListState): string[] {
  if (!d.scope) return [];
  const out = new Set<string>(state.facets.k ?? []);
  for (const v of state.facets.kind ?? []) for (const t of d.scope.legacyKind(v)) out.add(t);
  return [...out];
}

/** Facets hidden by their own guard (not by a Kind scope): the 60% rule on the rows they apply to, and "no row has a value". */
export function guardHidden<Row>(d: EntityDescriptor<Row>, rows: readonly Row[], state: ListState): { params: Set<FacetParam>; notes: string[] } {
  const params = new Set<FacetParam>();
  const notes: string[] = [];
  for (const f of d.facets) {
    if ((state.facets[f.param]?.length ?? 0) > 0) continue;
    if (f.hideIfEmpty && !rows.some((r) => f.options(r).length)) params.add(f.param);
    if (f.guard) {
      const among = rows.filter(f.guard.among);
      const c = coverageOf(f, among);
      if (!c.shows) {
        params.add(f.param);
        if (f.guard.what) notes.push(`${f.label} hidden: ${f.guard.what}`);
      }
    }
  }
  return { params, notes };
}

export interface ScopeState {
  tokens: string[];
  /** Params of every facet the scope brings (scoped and base), in contract order. */
  inScope: Set<FacetParam>;
  /** Scoped params that show: in scope and answered by enough of the results. */
  shown: Set<FacetParam>;
  /** Promoted params, in the table's order, whether or not they show. The bar takes the first two that do. */
  promoted: FacetParam[];
  hidden: Coverage[];
  note: string | null;
  /** Facets their own guard hides (see `guardHidden`), and the sentences that say why. */
  guarded: Set<FacetParam>;
  guardNotes: string[];
}

const EMPTY: ScopeState = { tokens: [], inScope: new Set(), shown: new Set(), promoted: [], hidden: [], note: null, guarded: new Set(), guardNotes: [] };

const memo = new WeakMap<object, Map<string, ScopeState>>();

/** `scopeState`, remembered per rows array and scope, so the counts, the notes and the bar compute it once per change. */
export function scopeOf<Row>(d: EntityDescriptor<Row>, rows: readonly Row[], state: ListState): ScopeState {
  const tokens = scopeTokens(d, state);
  const picked = d.facets.filter((f) => (f.scoped || f.guard || f.hideIfEmpty) && (state.facets[f.param]?.length ?? 0) > 0).map((f) => f.param);
  const key = `${d.type}|${tokens.join(',')}|${picked.join(',')}`;
  let byKey = memo.get(rows);
  if (!byKey) memo.set(rows, (byKey = new Map()));
  let hit = byKey.get(key);
  if (!hit) {
    const g = guardHidden(d, rows, state);
    hit = { ...(tokens.length ? scopeState(d, rows, state) : EMPTY), guarded: g.params, guardNotes: g.notes };
    byKey.set(key, hit);
  }
  return hit;
}

/** Pure. `rows` are the list's rows; coverage is measured on the rows inside the scope, not on the other filters. */
export function scopeState<Row>(d: EntityDescriptor<Row>, rows: readonly Row[], state: ListState, slice: ContractSlice = SLICE): ScopeState {
  const cfg = d.scope;
  const tokens = scopeTokens(d, state);
  if (!cfg || !tokens.length) return EMPTY;
  const facets = facetsForScope(tokens, slice);
  const params = new Set<FacetParam>(facets.map((f) => paramOf(f) as FacetParam));
  const scopeRows = rows.filter((r) => typeInScope(cfg.typeOf(r), tokens, slice));
  const shown = new Set<FacetParam>();
  const hidden: Coverage[] = [];
  for (const f of d.facets) {
    if (!f.scoped || !params.has(f.param)) continue;
    const c = coverageOf(f, scopeRows);
    if (c.shows || (state.facets[f.param]?.length ?? 0) > 0) shown.add(f.param);
    else if (c.total > 0) hidden.push(c);
  }
  return { tokens, inScope: params, shown, promoted: promotedFor(tokens, slice) as FacetParam[], hidden, note: hiddenNote(hidden), guarded: new Set(), guardNotes: [] };
}

/** Does this facet take part now? Unscoped facets always do; a scoped one only while the Kind brings it and enough rows answer it. */
export const facetShows = (f: { param: FacetParam; scoped?: boolean }, scope: ScopeState): boolean =>
  (!f.scoped || scope.shown.has(f.param)) && !scope.guarded.has(f.param);
