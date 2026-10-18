// Structural error codes (plan 2.4). Errors block a write. Every code needs a broken fixture in
// core/test/fixtures/broken/<CODE>.json; the validate test fails when one is missing.
export const ERROR_CODES = {
  E_SCHEMA: "a column is missing, unknown, of the wrong type, outside its enum or pattern",
  E_KEY_ORDER: "root keys are out of the plan 2.2 order",
  E_PK_DUP: "duplicate primary key in a table",
  E_FK: "a foreign key misses its target",
  E_SRC: "an id in src or sources is not in the sources table",
  E_DAYS_CONTIGUOUS: "days.n is not 0..N or 1..N without gaps",
  E_SEQ_CONTIGUOUS: "items.seq is not 1..n per day and track",
  E_BASE_COVER: "a night is covered by no base or by two",
  E_NIGHTS_SUM: "trip.nights differs from the sum of bases.nights",
  E_DURATION_SHAPE: "duration_shape does not match nights",
  E_EDITION_LENGTH: "end - start + 1 differs from the number of days with n >= 1",
  E_EDITION_CHOSEN: "more than one edition is chosen or booked",
  E_STYLE_TAG: "primary_style is not in trip_tags",
  E_ITEM_REF: "an item breaks the reference rule",
  E_ITEM_TIME: "both start and a window, or window_end before window_start",
  E_PLAN_B: "plan_b_item_id does not target a track P item on the same day",
  E_COST_PAIR: "an amount without its currency (or cost_per), or the reverse",
  E_BOOKING_OFFER: "a booking with neither offer_id nor item and category",
  E_OFFER_WINDOW: "an offer with opens_kind rolling-lead and no opens_lead_days",
  E_TZ: "a tz value is not an IANA zone",
  E_RESEARCH_PATH: "a research_refs path does not exist",
  E_SLUG: "slug pattern, reserved slug, or slug differs from the folder",
  E_ID_ENCODING: "a catalog id contains __ or a character outside [A-Za-z0-9/-]",
  E_LEG_ID: "a leg id is not the hash of its from_id, to_id and mode",
  E_VISIBILITY: "web_published is true on a private trip",
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;
export const ERROR_CODE_LIST = Object.keys(ERROR_CODES) as ErrorCode[];

export interface Issue {
  code: string;
  /** JSON pointer inside the document, e.g. /items/3/trail_id */
  path: string;
  message: string;
}

export interface Result {
  errors: Issue[];
  warnings: Issue[];
}

// suitability/1 codes (docs/v2/research/suitability.md section 9). They live apart from ERROR_CODES because the
// broken-fixture test of that list expects one fixture per code in fixtures/broken; these have theirs in
// fixtures/suitability/broken (one failing file each, enforced by core/test/suitability/validate.test.ts).
// ---- S0b: suitability applicability (kept in its own block so the relevance lane can add its codes beside it) ----
const APPLICABILITY_ERROR_CODES = {
  E_SUIT_SUBKIND: "a record's subkind is missing, outside the closed vocabulary, or not a subkind of its kind",
  E_SUIT_PROFILE_MAP: "in the applicability file, a profile list is incomplete, a (kind, subkind) pair maps to no profile or to two, or a profile misses a field path",
  E_SUIT_EXT_KIND: "a record's ext.kind is not the extension its profile allows",
  E_SUIT_NA_EXEMPT: "a not_applicable state on a field the profile asks for (R or A) has no note saying why",
} as const;
const APPLICABILITY_WARNING_CODES = {
  W_SUIT_NA_FIELD: "a field the profile marks not applicable (N) holds a value; remove it, or correct the record's kind",
  W_SUIT_BELOW_USABLE: "required (R) fields of the profile are unanswered, so the record is draft",
  W_SUIT_OPERATED_DEFAULT: "operated is set on a profile where it is fixed (always or never)",
} as const;
// ---- end S0b block ----

export const SUIT_ERROR_CODES = {
  E_SUIT_SCHEMA: "a field is missing, unknown, of the wrong type or outside its enum, or a value state contradicts its v",
  E_SUIT_REF: "a record ref does not resolve to a place, a legacy row or a trip item",
  E_SUIT_DUP_REF: "a ref appears twice in a file, or in two files of one trip",
  E_SUIT_SRC: "a src id is not in the file's sources table, or a value has no source and is not our_inference with a note",
  E_SUIT_SRC_READ: "a source has no read date",
  E_SUIT_LINK_ONLY_SRC: "a source is a link-only platform (AllTrails, Komoot, Gaia, Outdooractive, Wikiloc, Google, Tripadvisor, a booking host)",
  E_SUIT_LIMIT_BASIS: "a hard limit rests on anything but an operator rule or an official rule",
  E_SUIT_SEARCHED_NONE: "searched_none without the date searched (on) or the pages tried",
  E_SUIT_UNIT: "a quote in lb, in, ft or mi has no note with the conversion",
  E_SUIT_RANGE: "a minimum above its maximum, or a range that runs backwards",
  E_SUIT_GRADE: "a source grade is not a grade of its system",
  E_SUIT_TYPED_EFFORT: "family_effort, terrain, band or effort_km is typed in a file; they are computed",
  E_SUIT_STEP_FREE: "wheelchair step_free without official_info",
  E_SUIT_FLAT_DRIFT: "the flat catalogue copy differs from what derive computes; run: node core/bin/suitability.ts derive --write",
  ...APPLICABILITY_ERROR_CODES,
} as const;
export const SUIT_WARNING_CODES = {
  W_SUIT_STALE: "a value was read longer ago than its freshness class allows",
  W_SUIT_CONFLICT: "a value keeps conflicting figures from other sources",
  W_SUIT_COMMUNITY_ONLY: "a value rests on community reports alone",
  W_SUIT_MARGINAL_CONVERSION: "a limit was converted from imperial units; the household check treats within 1 kg or 2 cm as marginal",
  W_SUIT_FLAT_MISSING: "the record has no flat catalogue copy yet; run: node core/bin/suitability.ts derive --write",
  ...APPLICABILITY_WARNING_CODES,
} as const;
export type SuitErrorCode = keyof typeof SUIT_ERROR_CODES;
export type SuitWarningCode = keyof typeof SUIT_WARNING_CODES;
export const SUIT_ERROR_LIST = Object.keys(SUIT_ERROR_CODES) as SuitErrorCode[];
export const SUIT_WARNING_LIST = Object.keys(SUIT_WARNING_CODES) as SuitWarningCode[];
