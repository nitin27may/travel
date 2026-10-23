// The HTTP side of each method (review API1a-R-5): the flat query parameters a URL carries, exactly as EXECUTION-PLAN 4.3 rule 3
// names them and as web's list URLs write them (web/lib/entities/url.ts): comma lists, an upper-case `country`, `sort` with `dir` for a
// single key, `f.<facet>` for the facets of a narrowed Kind, and the timeline's `p`, `pace`, `a`, `walk`, `split`, `d`, `add` as
// top-level keys. OpenAPI documents THESE (API-1b), and core/src/catalogue/httpCodec.ts turns them into the store input and back; no
// handler parses a query itself.
//
// Every value is a string, as in a URL. `f.<facet>` keys are not listed one by one: the codec takes every key matching FACET_KEY_RE
// that starts with `f.`, and OpenAPI states the pattern.
import { z } from "zod";
import { PLACE_FACET_KEYS } from "./place.ts";

const str = z.string().max(2000);
const facetParams = Object.fromEntries(PLACE_FACET_KEYS.map((k) => [k, str.optional()])) as Record<(typeof PLACE_FACET_KEYS)[number], z.ZodOptional<typeof str>>;

/** The list parameters: free text, every facet as a comma list, sort with dir, bbox, ids, paging. */
export const listHttpQuery = z.strictObject({
  q: str.optional(),
  ...facetParams,
  sort: str.optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  bbox: str.optional(),
  ids: str.optional(),
  page: str.optional(),
  pageSize: str.optional(),
});

/** Near mode: the list parameters plus the centre and radius. */
export const nearHttpQuery = listHttpQuery.extend({ near: str.optional(), r: str.optional() });

export const townsHttpQuery = z.strictObject({ near: str.optional(), city: str.optional(), r: str.optional(), prefix: str.optional(), cc: str.optional(), region: str.optional() });

export const searchHttpQuery = z.strictObject({ q: str.optional(), kind: str.optional(), country: str.optional(), limit: str.optional() });

export const parseHttpQuery = z.strictObject({ q: str.optional(), target: str.optional(), dropped: str.optional() });

/** The timeline's profile keys, top-level in the URL (core/src/schedule/profileCodec.ts PROFILE_KEYS). */
export const profileHttpQuery = z.strictObject({ p: str.optional(), pace: str.optional(), a: str.optional(), walk: str.optional(), split: str.optional(), d: str.optional(), add: str.optional() });

export const exportHttpQuery = profileHttpQuery.extend({ format: str.optional() });

/**
 * `GET /api/v1/places/counts` (store.ts A25): the list parameters, plus the parse to merge first as `parsed.q` and `parsed.<facet key>`
 * (comma lists, `parsed.f.<facet>` for a scoped facet). The `parsed.<facet>` keys are matched by PARSED_KEY_RE, not listed; any
 * `parsed.` key present makes the request a parsed count, and `parsed.q` absent means the parse left no words.
 */
export const countsHttpQuery = listHttpQuery.extend({ "parsed.q": str.optional() });
export const PARSED_PREFIX = "parsed.";

/** `GET /api/v1/places/unchecked` (A27): the list parameters plus `only`, a comma list of facet keys. */
export const uncheckedHttpQuery = listHttpQuery.extend({ only: str.optional() });

/** `GET /api/v1/places/cards` (A28): the list parameters (`q` required by the store) plus `limit`. `sort` is refused: cards come best first. */
export const cardsHttpQuery = listHttpQuery.omit({ sort: true, dir: true, page: true, pageSize: true }).extend({ limit: str.optional() });

/** Keys a page URL carries for the page alone (view, grouping, columns, saved view, focus, the label of an ids list): the codec drops them. */
export const PAGE_ONLY_KEYS = ["view", "group", "cols", "f", "sv", "focus", "label"] as const;

export type ListHttpQuery = z.infer<typeof listHttpQuery>;
