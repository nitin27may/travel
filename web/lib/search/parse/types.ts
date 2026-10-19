import type { SearchRecord } from '@/lib/search/types';

/** `public/search/vocab.json` (search-vocab/1): the words the parser reads. Labels only (principle P8). */
export interface VocabFile {
  schema: 'search-vocab/1';
  /** Content hash, so a server step can tell which vocabulary produced a parse. */
  v: string;
  /** URL key (or `$class` for a grammar class) -> value -> phrases, singular and lower case. */
  t: Record<string, Record<string, string[]>>;
  /** Chip words: `<key>=<value>` for a value, `<key>` for a facet. */
  l: Record<string, string>;
  /** Country codes whose seasons are flipped (A8). */
  south: string[];
  /** A scoped facet that brings its Kind when none was parsed (A7). */
  implied: Record<string, string>;
  /** Country code -> English name, for countries the globe tree names by their code. */
  c: Record<string, string>;
  /** Extra country names (usa, uk) -> code. */
  cx: Record<string, string>;
}

/** One reading of the query, shown as a chip. Removing it drops every key in `set`. */
export interface Chip {
  /** Stable id for the "remove" state: `where` for the place, otherwise the URL key. */
  id: string;
  label: string;
  /** The URL keys and values this chip writes. Empty for a question chip (`ask`). */
  set: Record<string, string[]>;
  /** The span of query words it came from: [first, last + 1] counted in words. */
  words: [number, number];
  /** Other readings the visitor can switch to (a tie between two areas, the ages offered for "with kids"). */
  alternatives?: Chip[];
  /** Added because another chip needs it (a length needs trails). */
  implied?: boolean;
  /** A question, not a filter: it sets nothing until an alternative is picked (A9, trips). */
  ask?: boolean;
}

export interface DidYouMean {
  label: string;
  href: string;
}

export interface ParsedQuery {
  /** `search` means a name won over the parse (A1): show the name hits and no chips. */
  target: 'places' | 'trips' | 'search';
  chips: Chip[];
  /** The words no filter used, ready to put in `q` (H3). */
  q: string;
  /** Every word that was not used, except filler. */
  unused: string[];
  /** Words that have no filter yet (relevance, Q35): shown as "Not used yet", never approximated (H4). */
  notYet: string[];
  didYouMean: DidYouMean[];
  /** The list to open, `/places/?...` or `/trips/?...`; empty when a name won. */
  href: string;
  /** The keys the chips write, merged: what the list's URL state holds. */
  facets: Record<string, string[]>;
  /** The vocabulary version that produced this parse. */
  vocab: string;
}

export interface ParseOptions {
  /** Try another answer to an open owner question (grammar.ts DECISIONS). */
  decisions?: Partial<Pick<import('./grammar').Decisions, 'kidsWithoutAge'>>;
  /** Force a list. Without it the words decide (A11). */
  target?: 'places' | 'trips';
  /** Chip ids the visitor removed: their words stay used, so the parse does not bring them back. */
  dropped?: readonly string[];
}

/** What the parser reads besides the vocabulary: the records of the search index, all kinds. */
export type ParseRecords = readonly SearchRecord[];
