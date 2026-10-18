import { normalize } from './normalize';

/**
 * Words people type for a place that the data spells another way. Each key is one normalised word; the value is the
 * words to search instead. Keep it short and exact: an alias is a promise that the query means that thing.
 */
export const ALIASES: Record<string, string> = {
  rockies: 'rocky mountains',
  rockys: 'rocky mountains',
  smokies: 'great smoky mountains',
  dolomiti: 'dolomites',
  tetons: 'grand teton',
  tuscany: 'toscana',
  bavaria: 'bayern',
  swiss: 'switzerland',
  holland: 'netherlands',
  ny: 'new york',
  usa: 'united states',
  uk: 'united kingdom',
};

/** The search words of a query, aliases applied. */
export function queryTokens(q: string): string[] {
  return normalize(q)
    .split(' ')
    .filter(Boolean)
    .flatMap((t) => (ALIASES[t] ? ALIASES[t].split(' ') : [t]));
}
