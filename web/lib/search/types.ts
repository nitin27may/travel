/** One searchable thing. Plain JSON: this array is the body of /search-index.json. */
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
}
