import type { ListState } from '@/lib/entities/types';
import type { Chip, ParsedQuery } from '@/lib/search/parse/types';

/** A parse the visitor applied from the list's search box: what it read, what was typed, and the state to go back to (smart-search 6.1). */
export interface Applied {
  parsed: ParsedQuery;
  text: string;
  before: ListState;
  /** Set when the whole reading gave no rows and the list shows a relaxed one: the chips left out, and how many constraints there were. */
  relaxed?: { dropped: Chip[]; total: number };
}

const sameValues = (a: string[] | undefined, b: string[] | undefined) => (a ?? []).join(',') === (b ?? []).join(',');

/** The filters an applied parse wrote still hold in the URL (the visitor has not changed them since). */
export function stillApplies(state: ListState, a: Applied): boolean {
  return Object.entries(a.parsed.facets).every(([k, v]) => sameValues(state.facets[k as keyof ListState['facets']], v));
}

/** Put the state back as it was before the parse, with the words typed back in the box as plain text. */
export function undoState(a: Applied): ListState {
  return { ...a.before, q: a.text, focus: null };
}

/** The reading the header search hands to the list it opens (sessionStorage, one navigation): the list then holds it like a reading typed in its own box. */
export const HANDOFF_KEY = 'travel.reading';

export interface Handoff {
  text: string;
  parsed: ParsedQuery;
  relaxed?: { dropped: Chip[]; total: number };
}
