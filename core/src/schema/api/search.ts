// Search and the smart-search parser (smart-search.md section 9.1; web/lib/search/types.ts and web/lib/search/parse/types.ts).
import { z } from "zod";
import { API_LIMITS } from "./limits.ts";

export const SEARCH_KINDS = ["trip", "place", "area"] as const;
export const SEARCH_GROUPS = ["trips", "places", "areas"] as const;

/** One searchable thing: labels only (P8). `h` is the page address with its trailing slash. */
export const searchRecord = z.strictObject({
  k: z.enum(SEARCH_KINDS),
  h: z.string().min(1),
  n: z.string(),
  s: z.string(),
  x: z.string(),
  kind: z.string().optional(),
  b: z.number().optional(),
  ar: z.array(z.string()).optional(),
});

/** `SearchQuery`: the words, an optional scope, and a per-group limit (the store refuses more than API_LIMITS.searchLimit.max). */
export const searchQuery = z.strictObject({
  q: z.string().max(API_LIMITS.query.textChars),
  scope: z.strictObject({
    kind: z.enum(SEARCH_KINDS).optional(),
    /** lower-case ISO alpha-2 */
    country: z.string().regex(/^[a-z]{2}$/).optional(),
  }).optional(),
  limit: z.int().min(1).optional(),
});

export const searchResult = z.strictObject({
  counts: z.strictObject({ trips: z.int().min(0), places: z.int().min(0), areas: z.int().min(0) }),
  groups: z.array(z.strictObject({
    id: z.enum(SEARCH_GROUPS),
    label: z.string(),
    total: z.int().min(0),
    hits: z.array(z.strictObject({ record: searchRecord, score: z.number() })),
  })),
  query: z.string(),
  /** a static adapter answering from part of the index says so; a store answers from all of it (false) */
  partial: z.boolean().optional(),
});

/** One reading of the query, shown as a chip; `alternatives` are the other readings (a recursive list). */
export const parseChip = z.strictObject({
  id: z.string(),
  label: z.string(),
  set: z.record(z.string(), z.array(z.string())),
  words: z.tuple([z.int().min(0), z.int().min(0)]),
  get alternatives() {
    return z.array(parseChip).optional();
  },
  implied: z.boolean().optional(),
  ask: z.boolean().optional(),
});

/** `{q}` plus the parser's options (web ParseOptions): the target list and the chips the visitor removed. */
export const parseInput = z.strictObject({
  q: z.string().max(API_LIMITS.query.textChars),
  target: z.enum(["places", "trips"]).optional(),
  dropped: z.array(z.string().max(60)).max(20).optional(),
});

/** `ParsedQuery`: chips, the URL keys they write, did-you-mean (smart-search A1 to A14). Pure: the same words give the same parse. */
export const parsedQuery = z.strictObject({
  target: z.enum(["places", "trips", "search"]),
  chips: z.array(parseChip),
  q: z.string(),
  unused: z.array(z.string()),
  notYet: z.array(z.string()),
  didYouMean: z.array(z.strictObject({ label: z.string(), href: z.string() })),
  href: z.string(),
  facets: z.record(z.string(), z.array(z.string())),
  /** the vocabulary version (content hash) that produced this parse */
  vocab: z.string(),
});

export type SearchRecord = z.infer<typeof searchRecord>;
export type SearchQuery = z.infer<typeof searchQuery>;
export type SearchResult = z.infer<typeof searchResult>;
export type ParseInput = z.infer<typeof parseInput>;
export type ParsedQuery = z.infer<typeof parsedQuery>;
