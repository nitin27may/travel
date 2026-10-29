// The trip builder's public API (trip-builder.md 5, 7, 15.1 ISO-1, ISO-4, ISO-5; owner answers QI2, QI3 of 27 Oct 2026):
//
//   GET  /api/v1/plan/regions/{cc}   region groups and regions of one country, with counts of researched places   cacheable
//   GET  /api/v1/plan/candidates     light rows scoped to regions or a drive band, 40 a page, with score parts     cacheable
//   POST /api/v1/plan/build          bases, nights, days, did-not-fit, reasons, the picks matrix                    no-store
//
// All three go through `respond()` and its privacy detector. Served by `PlanService` (the builder's own service, trip-builder 15.1 ISO-5; built by TB-API), which consumes the
// `CatalogueStore` and adds no method to it (ISO-5).
//
// NOT YET EXPORTED from ./index.ts and not in the OpenAPI file: that is the TB-C hook (extension point X3), landed after the B+C release
// commit. Until then only builder code imports this file directly.
//
// Contracts, not data tables: never registered in ../index.ts REGISTRY, so `schema.ts generate` is unchanged. They keep to the JSON
// Schema subset (no refine, transform or lazy) so the OpenAPI export can state them; the cross-field rules of a build body are
// `planBuildRules`.
//
// PRIVACY (7). The party (adults, children's ages, walk limit) is accepted in the build's POST body only: never a query parameter, never
// echoed, never logged or cached. No response schema here has a key for the party, a household field, an origin or a coordinate of the
// visitor's start: the detector's `from` rule and the party keys of hook X4 fail any body that tries. Candidate and region answers vary
// only by public query keys, so they are cacheable for everyone.
//
// CAPS (P8, TB6). Result-size caps answer `too_large` with `details.max` (a page size above 40, a build over 40 picks, 22 days or 4
// bases); request-size caps are `.max()` on the input and answer `invalid_input`. A build body above `buildBodyBytes` is `too_large`
// before it is parsed. Rate limit: 30 builds an hour per IP, `rate_limited` (429) with `Retry-After`.
import { z } from "zod";
import { API_ERROR_CODES, API_ERROR_STATUS, apiCountry, apiRevision, paged, type ApiErrorCode } from "./common.ts";
import { API_LIMITS } from "./limits.ts";
import { facetKey, PLACE_FACET_KEYS, placeRow } from "./place.ts";
import {
  PLAN_LIMITS as DRAFT_LIMITS,
  PLAN_BASIS,
  PLAN_COUNTRY_RE,
  PLAN_MOVES,
  PLAN_ORIGIN_TOKEN_RE,
  PLAN_PACES,
  planBaseChoice,
  planDayEdit,
  planInputRules,
  planOrigin,
  planOutputsShape,
  planRef,
  planRegionId,
  planSlug,
  planWhere,
} from "../plan-draft.ts";

/** The builder's caps: the draft's, plus the API's own (5, 7; design README 6). */
export const PLAN_LIMITS = {
  ...DRAFT_LIMITS,
  /** candidate rows per page (TB6): above `max` is `too_large` */
  candidatePage: { default: 40, max: 40 },
  /** the build's POST body, as bytes; above it is `too_large` before parsing */
  buildBodyBytes: 16 * 1024,
  /** the build answer, gzip (5): a budget the engine's tests hold, not a schema rule */
  buildGzipBytes: 48 * 1024,
  /** a candidate page, gzip (design README 6) */
  candidateGzipBytes: 12 * 1024,
  /** builds an hour per IP (5) */
  buildsPerHour: 30,
  /** the picks matrix side: one row and one column per pick */
  matrix: DRAFT_LIMITS.picks,
} as const;

// ---- errors -----------------------------------------------------------------------------------------------------------------------

/**
 * The public API's codes plus two of the builder's own (ISO-4, 5): `plan_paused`, the runtime kill switch `PLAN_BUILDER_PAUSED=1`
 * (503, the page shows "Planning is paused; your drafts are safe on this device"), and `rate_limited` (429, with `Retry-After`). With the
 * build flag `planBuilder` off the routes answer 404 `not_found`, as if they did not exist.
 */
export const PLAN_ERROR_CODES = [...API_ERROR_CODES, "plan_paused", "rate_limited"] as const;
export type PlanErrorCode = (typeof PLAN_ERROR_CODES)[number];
export const PLAN_ERROR_STATUS: Readonly<Record<PlanErrorCode, number>> = {
  ...(API_ERROR_STATUS as Record<ApiErrorCode, number>),
  plan_paused: 503,
  rate_limited: 429,
};
export const planHttpStatus = (code: PlanErrorCode): number => PLAN_ERROR_STATUS[code];

export const planApiError = z.strictObject({
  code: z.enum(PLAN_ERROR_CODES),
  /** one plain sentence a developer can act on; never a stack, a path, a party value or an origin */
  message: z.string().min(1).max(500),
  /** the failing keys of an `invalid_input`, the cap of a `too_large`, `retryAfterS` of a `rate_limited` */
  details: z.record(z.string(), z.unknown()).optional(),
});

/** `Result<T>` with the builder's codes; a success carries the store revision the answer was built from. */
export function planResult<T extends z.ZodType>(data: T) {
  return z.discriminatedUnion("ok", [
    z.strictObject({ ok: z.literal(true), data, revision: apiRevision }),
    z.strictObject({ ok: z.literal(false), error: planApiError }),
  ]);
}

// ---- GET /api/v1/plan/regions/{cc} ------------------------------------------------------------------------------------------------

export const planRegionsInput = z.strictObject({ cc: z.string().regex(PLAN_COUNTRY_RE) });

export const planRegion = z.strictObject({
  id: planRegionId,
  name: z.string().min(1).max(120),
  /** researched places in it (the same count the Places page shows for the region) */
  count: z.int().min(0),
});

export const planRegionGroup = z.strictObject({
  id: planRegionId,
  /** our own label ("Northern Italy, east", QB7) */
  name: z.string().min(1).max(120),
  count: z.int().min(0),
  /** false: greyed with "Ask us" (TB9); the threshold is the coverage plan's, applied by the service */
  offered: z.boolean(),
  regions: z.array(planRegion),
});

/** One country's groups; a country with one group (step 2 skipped) answers one group. Regions in no group are `ungrouped`. */
export const planRegions = z.strictObject({
  cc: apiCountry,
  name: z.string().min(1).max(120),
  groups: z.array(planRegionGroup),
  ungrouped: z.array(planRegion),
  /** researched places in the country */
  total: z.int().min(0),
});

// ---- GET /api/v1/plan/candidates --------------------------------------------------------------------------------------------------

/** The party band a cacheable query may carry (the timeline's public `p` key: `adults` or `family-<youngest>`, never ages). */
export const PLAN_PARTY_BAND_RE = /^(?:adults|family-(?:[0-9]|1[0-7]))$/;
/** Which list the rows come from: the default list, or the rows scoring removed (4.3, shown under their own headings). */
export const PLAN_CANDIDATE_LISTS = ["main", "not_for_party", "closed"] as const;

const candidateCommon = {
  /** any Places facet (`kind`, `kid`, `season`, `f.<id>`), as the Places list reads it (2.5 `f`) */
  facets: z.record(facetKey, z.array(z.string().min(1).max(120)).max(API_LIMITS.query.valuesPerKey)).optional(),
  month: z.int().min(1).max(12).optional(),
  party: z.string().regex(PLAN_PARTY_BAND_RE).optional(),
  list: z.enum(PLAN_CANDIDATE_LISTS).optional(),
  page: z.int().min(1).optional(),
  /** above PLAN_LIMITS.candidatePage.max is `too_large` */
  pageSize: z.int().min(1).optional(),
  /**
   * TB-C2 (FLOW stage 3 "Near what you picked", stage 4 "Also within your driving"): the public slug of a pick whose surroundings the
   * rows list, measured from that place's point instead of the region centroid or the start (the engine reads `CatalogueStore.near`).
   */
  near: planSlug.optional(),
  /** TB-C2: at most this many rows in one answer (a strip of 6, "Also within your driving" up to 12); absent: a page of `pageSize` */
  limit: z.int().min(1).max(PLAN_LIMITS.candidatePage.max).optional(),
};

/**
 * `PlanCandidatesQuery`, decoded: trip mode names a country and one or more regions or groups (no endpoint lists across countries);
 * near mode names a start and a one-way drive limit in minutes.
 */
export const planCandidatesQuery = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("trip"), cc: z.string().regex(PLAN_COUNTRY_RE), regions: z.array(planRegionId).min(1).max(DRAFT_LIMITS.regions), ...candidateCommon }),
  z.strictObject({
    mode: z.literal("near"),
    start: planOrigin,
    driveLimitMin: z.int().min(DRAFT_LIMITS.driveLimitMin.min).max(DRAFT_LIMITS.driveLimitMin.max).multipleOf(DRAFT_LIMITS.driveLimitMin.step),
    /** TB-C2 (FLOW TF5): travel regions that narrow the reach; absent: the whole reach. A region names its own country */
    regions: z.array(planRegionId).min(1).max(DRAFT_LIMITS.regions).optional(),
    ...candidateCommon,
  }),
]);

/**
 * The flat query parameters of the candidates URL (the builder's URL keys of 2.5 where they map: `m`, `cc`, `rg`, `from`, `r`, `mo`;
 * the Places facet keys verbatim; `p` the party band; `list`, `page`, `pageSize`). Every value is a string, as in a URL. `from` is an
 * origin token (`hub:<id>`, `iata:<XXX>`, `town:<id>`, PLAN_ORIGIN_TOKEN_RE), never a point. As in ./http.ts, `f.<facet>` keys are not
 * listed one by one: the codec takes every key matching FACET_KEY_RE that starts with `f.`.
 */
const str = z.string().max(2000);
const facetParams = Object.fromEntries(PLACE_FACET_KEYS.map((k) => [k, str.optional()])) as Record<(typeof PLACE_FACET_KEYS)[number], z.ZodOptional<typeof str>>;
export const planCandidatesHttpQuery = z.strictObject({
  ...facetParams,
  m: str.optional(),
  cc: str.optional(),
  rg: str.optional(),
  from: z.string().max(120).regex(PLAN_ORIGIN_TOKEN_RE).optional(),
  r: str.optional(),
  mo: str.optional(),
  p: str.optional(),
  list: str.optional(),
  page: str.optional(),
  pageSize: str.optional(),
  /** TB-C2: the pick's public slug (`near`) and the row cap (`limit`) */
  near: str.optional(),
  limit: str.optional(),
});

/** Visit length bands for the tray's "about N days" (4.3). */
export const PLAN_DURATION_BANDS = ["lt1h", "1to2h", "2to4h", "4to6h", "full_day"] as const;

/** The score's visible parts (4.3): integers, so ties are exact; `total` is their sum. */
export const planScore = z.strictObject({
  draw: z.int(),
  fit: z.int(),
  season: z.int(),
  theme: z.int(),
  distance: z.int(),
  quality: z.int(),
  total: z.int(),
});

/**
 * A candidate: a Places row (the P8 allowlist, PLACE_ROW_KEYS) plus what the builder ranks and packs with. No fact, link, time or
 * suitability block beyond these; the place page has the rest.
 */
export const planCandidateRow = z.strictObject({
  ...placeRow.shape,
  score: planScore,
  /** visit length in minutes from `resolveDuration` or the type's rule, and its band; null when neither knows */
  visitMin: z.int().min(0).max(1440).nullable(),
  durationBand: z.enum(PLAN_DURATION_BANDS).nullable(),
  /** one-way drive from the region centroid (trip mode) or the start (near mode); null without a point (TB_UNKNOWN) */
  driveMin: z.int().min(0).nullable(),
  driveBasis: z.enum(PLAN_BASIS).nullable(),
  fit: z.enum(["pass", "unknown", "fail"]),
  seasonState: z.enum(["in", "shoulder", "unknown", "closed"]),
  /** the reason words of a `not_for_party` or `closed` row ("Needs age 12", "Closed in July"); null on the main list */
  why: z.string().max(240).nullable(),
});
/** The keys of a candidate row, in schema order: the row allowlist `respond()` checks. */
export const PLAN_CANDIDATE_ROW_KEYS = Object.keys(planCandidateRow.shape) as (keyof typeof planCandidateRow.shape)[];

/** One page of candidates, sorted by score, then name, then ref (4.3), with the sizes of the two removed lists. */
export const planCandidatePage = z.strictObject({
  ...paged(planCandidateRow).shape,
  list: z.enum(PLAN_CANDIDATE_LISTS),
  /** rows the default list left out, per list, for the headings "Not for your party" and "Closed in <month>" */
  removed: z.strictObject({ not_for_party: z.int().min(0), closed: z.int().min(0) }),
});

// ---- POST /api/v1/plan/build ------------------------------------------------------------------------------------------------------

/**
 * The party, as the build receives it: in this body only (7). Read on the device from the one party store and never written into a
 * draft, a URL, a log or a cache. `walkKm` is the timeline's walk limit (5, 8 or 12; null: from the ages).
 */
export const planParty = z.strictObject({
  adults: z.int().min(1).max(12),
  children: z.array(z.int().min(0).max(17)).max(12),
  walkKm: z.union([z.literal(5), z.literal(8), z.literal(12)]).nullable(),
});

/**
 * `PlanBuildInput`: the draft's inputs (plan-draft/1, the same sub-schemas, so a draft maps onto a body field by field) plus the party.
 * Picks are refs and must flags only; names and slugs stay on the device.
 */
export const planBuildInput = z.strictObject({
  where: planWhere,
  nights: z.int().min(0).max(DRAFT_LIMITS.nights),
  pace: z.enum(PLAN_PACES),
  moves: z.enum(PLAN_MOVES),
  month: z.int().min(1).max(12).nullable(),
  /** at least one pick; above PLAN_LIMITS.picks is `too_large` */
  picks: z.array(z.strictObject({ ref: planRef, must: z.boolean() })).min(1),
  /** pinned and accepted bases; above PLAN_LIMITS.bases is `too_large` */
  bases: z.array(planBaseChoice),
  edits: z.array(planDayEdit).max(DRAFT_LIMITS.days),
  /** trip mode's Getting there; null when not chosen */
  origin: planOrigin.nullable(),
  party: planParty,
  /** TB-C2 (FLOW TF7, stage 4): the draft's `driveDayMin`, the longest drive in one day; absent: the pace's limit */
  driveDayMin: z.int().min(DRAFT_LIMITS.driveDayMin.min).max(DRAFT_LIMITS.driveDayMin.max).multipleOf(DRAFT_LIMITS.driveDayMin.step).optional(),
});

/**
 * The cross-field and result-size rules of a build body: the draft's input rules, and the caps that answer `too_large` (they come back
 * as `{ path, max }` so the handler can set `details.max`). Paths and rules only, never a value.
 */
export function planBuildRules(b: PlanBuildInput): { invalid: string[]; tooLarge: { path: string; max: number }[] } {
  const tooLarge: { path: string; max: number }[] = [];
  if (b.picks.length > DRAFT_LIMITS.picks) tooLarge.push({ path: "$.picks", max: DRAFT_LIMITS.picks });
  if (b.bases.length > DRAFT_LIMITS.bases) tooLarge.push({ path: "$.bases", max: DRAFT_LIMITS.bases });
  return { invalid: planInputRules(b), tooLarge };
}

/**
 * The picks' drive matrix (4.10): one row and column per pick in `refs` order, minutes from row to column; `estimated` lists the
 * flat indices (`row * n + col`) of cells that are straight-line estimates (≈). At most 40 × 40. The client re-flows edits with it.
 */
export const planMatrix = z.strictObject({
  refs: z.array(planRef).max(PLAN_LIMITS.matrix),
  minutes: z.array(z.array(z.int().min(0)).max(PLAN_LIMITS.matrix)).max(PLAN_LIMITS.matrix),
  estimated: z.array(z.int().min(0)).max(PLAN_LIMITS.matrix * PLAN_LIMITS.matrix),
});

/** The build answer: the outputs a draft keeps (plan-draft/1 `lastBuild`, without its time) plus the matrix. No polylines (Review). */
export const planBuild = z.strictObject({ ...planOutputsShape, matrix: planMatrix });

/** What `POST /api/v1/plan/build` answers (TB-API): the engine's build plus the time the service built it (a draft's `lastBuild.builtAt`). */
export const planBuildAnswer = z.strictObject({ ...planBuild.shape, builtAt: z.iso.datetime() });

/** The matrix's rules: square, one row and one column per ref, unique refs, estimate indices inside it. Paths only. */
export function planMatrixRules(m: PlanMatrix): string[] {
  const n = m.refs.length;
  const out: string[] = [];
  if (new Set(m.refs).size !== n) out.push("$.matrix.refs: each pick once");
  if (m.minutes.length !== n || m.minutes.some((row) => row.length !== n)) out.push("$.matrix.minutes: one row and one column per ref");
  if (m.estimated.some((i) => i >= n * n)) out.push("$.matrix.estimated: an index inside the matrix");
  return out;
}

/** Where a request failed and which rule, never the value (a build body holds the party; a query holds a start): at most 20 entries. */
export type PlanIssue = { path: string; code: string };
export type PlanChecked<T> = { ok: true; data: T } | { ok: false; issues: PlanIssue[] };
const issueList = (e: z.ZodError): PlanIssue[] =>
  e.issues.slice(0, 20).map((i) => ({ path: `$${i.path.map((p) => (typeof p === "number" ? `[${p}]` : `.${String(p)}`)).join("")}`, code: i.code }));

/** The one way to read a build body (the plan-draft rule: no bare `.parse` on a raw plan schema outside the contract files). */
export function parsePlanBuildInput(x: unknown): PlanChecked<PlanBuildInput> {
  const r = planBuildInput.safeParse(x);
  return r.success ? { ok: true, data: r.data } : { ok: false, issues: issueList(r.error) };
}
/** The one way to read a decoded candidates query. */
export function parsePlanCandidatesQuery(x: unknown): PlanChecked<PlanCandidatesQuery> {
  const r = planCandidatesQuery.safeParse(x);
  return r.success ? { ok: true, data: r.data } : { ok: false, issues: issueList(r.error) };
}

export type PlanApiError = z.infer<typeof planApiError>;
export type PlanRegionsInput = z.infer<typeof planRegionsInput>;
export type PlanRegion = z.infer<typeof planRegion>;
export type PlanRegionGroup = z.infer<typeof planRegionGroup>;
export type PlanRegions = z.infer<typeof planRegions>;
export type PlanCandidatesQuery = z.infer<typeof planCandidatesQuery>;
export type PlanCandidatesHttpQuery = z.infer<typeof planCandidatesHttpQuery>;
export type PlanScore = z.infer<typeof planScore>;
export type PlanCandidateRow = z.infer<typeof planCandidateRow>;
export type PlanCandidatePage = z.infer<typeof planCandidatePage>;
export type PlanParty = z.infer<typeof planParty>;
export type PlanBuildInput = z.infer<typeof planBuildInput>;
export type PlanMatrix = z.infer<typeof planMatrix>;
export type PlanBuild = z.infer<typeof planBuild>;
export type PlanBuildAnswer = z.infer<typeof planBuildAnswer>;
export type PlanResult<T> = { ok: true; data: T; revision: string } | { ok: false; error: PlanApiError };
