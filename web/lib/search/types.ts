/** One searchable thing. Plain JSON: a part file is an array of these. */
export interface SearchRecord {
  /** trip, place or area (a country, state or district of the globe). */
  k: 'trip' | 'place' | 'area';
  /** Page address, with the trailing slash. */
  h: string;
  /** Display name. */
  n: string;
  /** Second line: region and kind, or counts for an area. */
  s: string;
  /** More text to match on (region, area chain, kind), never shown. */
  x: string;
  /** Place kind, for the glyph. */
  kind?: string;
  /** Extra rank for a notable range, sea or ocean, so it sits above a plain prefix match. */
  b?: number;
  /**
   * Trips only: the areas (`cc/region/district`, lower-case slugs) its places lie in. A range word such as "Rockies" or "Dolomites" reads
   * its places through the trips that carry the word (smart-search 4.21). Area slugs only: no place, fact or note (principle P8).
   */
  ar?: string[];
}

export type SearchGroupId = 'trips' | 'places' | 'areas';

export interface SearchHit {
  record: SearchRecord;
  score: number;
}

export interface SearchResult {
  /** Total matches per group, before the per-group display limit. */
  counts: Record<SearchGroupId, number>;
  /** Top hits per group, in display order. */
  groups: { id: SearchGroupId; label: string; total: number; hits: SearchHit[] }[];
  /** Normalised query. */
  query: string;
  /** True while parts that could still add a match are loading (a typo or a mid-word match may come in late). */
  partial?: boolean;
}

/** One part of the split index: the records of one kind in one country. */
export interface SearchPartRef {
  /** `<kind>-<cc>`, also the file name under /search/. */
  id: string;
  k: SearchRecord['k'];
  /** Lower-case ISO alpha-2, or `xx` for a trip with no country. */
  cc: string;
  /** Number of records in the part. */
  n: number;
  /** First three letters of every word in the part's names and match text: a query that matches none of them cannot hit this part. */
  w?: string[];
}

/** The list of parts, loaded first. */
export interface SearchManifest {
  v: 1;
  parts: SearchPartRef[];
}
