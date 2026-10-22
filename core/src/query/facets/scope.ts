// Which facets a Kind scope brings (capture contract 7.1 and 7.2). The scope is a set of tokens: a type id at any depth
// (`water`, `nature.trail`, `nature.trail.hike`) or an intent (`intent:do`). A facet applies when one of its scopes names the token
// or one of the token's ancestors, so a type added under `water.motor` joins that scope with no code change.
import slice from './contract-slice.json' with { type: 'json' };
import type { ContractSlice, SliceFacet, SliceNode } from './slice.ts';

export const SLICE = slice as ContractSlice;

/** Record layers an intent shows: See = places, Walk and ride = routes, Do = offers (contract 2.7.3). */
const LAYER_OF_INTENT: Record<string, string> = { 'intent:see': 'place', 'intent:walk': 'route', 'intent:do': 'offer' };

/** The registry properties a list already has as a facet of its own (Kids, Effort, Stroller); the scope promotes those instead of repeating them. */
export const BASE_FACET_OF_PROPERTY: Record<string, string> = {
  age_band: 'kid',
  'effort.source_grade': 'effort',
  stroller: 'stroller',
};

/** The URL name of a facet: the base facet's param, or `f.<key>`. */
export const paramOf = (f: SliceFacet): string => BASE_FACET_OF_PROPERTY[f.property] ?? `f.${f.key}`;

const nodes = (slice: ContractSlice): SliceNode[] => [...slice.domains, ...slice.categories];

/** True when `token` is the same as, or below, `scope` in the type tree (ids are dotted, so below means "starts with"). */
const within = (token: string, scope: string): boolean => token === scope || token.startsWith(`${scope}.`);

/** The record layers a type id or domain allows: its category's, or the union under a domain. */
export function layersOf(token: string, s: ContractSlice = SLICE): Set<string> {
  const out = new Set<string>();
  for (const n of nodes(s)) if (within(n.id, token) || within(token, n.id)) n.records.forEach((r) => out.add(r));
  return out;
}

/** Does a facet scope take this token? */
export function scopeTakes(scope: string, token: string, s: ContractSlice = SLICE): boolean {
  if (scope.startsWith('intent:')) {
    const layer = LAYER_OF_INTENT[scope];
    return Boolean(layer) && layersOf(token, s).has(layer!);
  }
  return within(token, scope);
}

/** The contract facets a set of scope tokens brings, in the contract's order. */
export function facetsForScope(tokens: readonly string[], s: ContractSlice = SLICE): SliceFacet[] {
  if (!tokens.length) return [];
  return s.facets.filter((f) => f.scopes.some((sc) => tokens.some((t) => scopeTakes(sc, t, s))));
}

/** True when a row's type is inside one of the tokens. */
export function typeInScope(type: string | null | undefined, tokens: readonly string[], s: ContractSlice = SLICE): boolean {
  if (!type || !tokens.length) return false;
  const layers = layersOf(type, s);
  return tokens.some((t) => (t.startsWith('intent:') ? Boolean(LAYER_OF_INTENT[t]) && layers.has(LAYER_OF_INTENT[t]!) : within(type, t)));
}

/** Label of a domain or category, for the Kind pill and the chips. */
export function nodeLabel(id: string, s: ContractSlice = SLICE): string | null {
  return nodes(s).find((n) => n.id === id)?.label ?? null;
}
