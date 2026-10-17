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
