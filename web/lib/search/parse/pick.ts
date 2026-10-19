import { hrefFor } from './href';
import type { Chip, ParsedQuery } from './types';

/** The keys the chips write, merged: what the list's URL state holds. A later chip wins a key, as in the parser. */
export function mergeSets(chips: readonly Chip[]): Record<string, string[]> {
  const facets: Record<string, string[]> = {};
  for (const c of chips) for (const [k, v] of Object.entries(c.set)) facets[k] = v;
  return facets;
}

/**
 * Switches one chip to another reading of the same words (a tie between two areas, the age picked for "with kids"). The chip keeps its
 * id and its place in the row; the keys, the link and the list it opens follow. A question chip becomes an ordinary chip once an age is picked.
 */
export function pickAlternative(parsed: ParsedQuery, chipId: string, alt: Chip): ParsedQuery {
  const chips = parsed.chips.map((c) => (c.id === chipId ? { id: c.id, label: alt.label, set: alt.set, words: c.words } : c));
  const facets = mergeSets(chips);
  return { ...parsed, chips, facets, href: parsed.target === 'search' ? '' : hrefFor(parsed.target, facets, parsed.q) };
}

/** The reading without the chips the visitor removed, before the parser has run again: the row and the link update at once. */
export function withoutChips(parsed: ParsedQuery, ids: readonly string[]): ParsedQuery {
  if (!ids.length || !parsed.chips.some((c) => ids.includes(c.id))) return parsed;
  const chips = parsed.chips.filter((c) => !ids.includes(c.id));
  const facets = mergeSets(chips);
  return { ...parsed, chips, facets, href: parsed.target === 'search' ? '' : hrefFor(parsed.target, facets, parsed.q) };
}
