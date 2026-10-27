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

// suitability/1 codes (research/method/suitability.md section 9). They live apart from ERROR_CODES because the
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

// relevance/1 codes (research/method/relevance.md sections 2.2 and 5). A block of their own, apart from the E_SUIT_*
// one, with a failing fixture each in fixtures/relevance/broken (enforced by core/test/relevance/validate.test.ts).
export const REL_ERROR_CODES = {
  E_REL_SCHEMA: "a field is missing, unknown, of the wrong type or outside its enum, or a value state contradicts its v",
  E_REL_REF: "a record ref does not resolve to a place, a legacy row or a trip item",
  E_REL_DUP_REF: "a ref appears twice in a file, or in two files of one trip",
  E_REL_SRC: "a src id is not in the file's sources table, or a value has no source and is not our_inference with a note",
  E_REL_SRC_READ: "a source has no read date",
  E_REL_LINK_ONLY_SRC: "a source is AllTrails, Komoot, Google, Tripadvisor or another link-only platform: its ratings, review counts and ranks are never data",
  E_REL_COPIED_RATING: "a quote, note or title carries a rating, a review count or a popularity rank (4.8 stars, 12,345 reviews, #3 of 41)",
  E_REL_DRAW_NOTE: "draw has a value but its note names no signal (a designation, a top-list mention, the land manager's own page, a sell-out)",
  E_REL_TYPED_DERIVED: "a derived field (draw_suggested, role, fit, badge, substitutes, detour, far_pointer, flags) is typed in a file",
  E_REL_INHERITED_DESIGNATION: "an area designation (UNESCO, national or provincial park, conservation area, dark sky, Ramsar) has scope own on a record that is not itself an area (park, region, protected_area)",
  E_REL_HOUSEHOLD: "a household origin, home address or private point is in a relevance file; day-trip fit uses public hubs only",
  E_REL_CLASS: "class_key is not in data/vocab/relevance-classes.json",
  E_REL_QID: "a Wikidata QID is not of the form Q123, or a value-state QID carries no confirmation note",
  E_REL_RANGE: "a draw_peak tier is not above the base draw, or a draw_peak window has equal start and end",
} as const;
export const REL_WARNING_CODES = {
  W_REL_NO_QID: "the record has no confirmed Wikidata QID, so the signals tool cannot read its fame",
  W_REL_DRAW_GAP: "draw and draw_suggested differ by 2 or more tiers and the draw note does not explain why",
  W_REL_DISTINCTION: "distinction is unique but a same-class catalogue place lies within 100 km",
  W_REL_NO_DETOUR: "no trip leg, base or catalogue town gives a detour for the place",
  W_REL_NO_REACH: "a top_list mention has no reach, so it cannot raise the draw floor",
  W_REL_STALE: "a judged field, designation, mention or access cost is older than its freshness class allows",
} as const;
export type RelErrorCode = keyof typeof REL_ERROR_CODES;
export type RelWarningCode = keyof typeof REL_WARNING_CODES;
export const REL_ERROR_LIST = Object.keys(REL_ERROR_CODES) as RelErrorCode[];
export const REL_WARNING_LIST = Object.keys(REL_WARNING_CODES) as RelWarningCode[];

// capture/1 codes (research/method/capture-contract.md sections 3, 5 and 9; backlog 3a.12 step 3). A block of their own, with a
// failing case each in core/test/capture/validate.test.ts. The suitability and relevance codes keep their own blocks.
export const CAP_ERROR_CODES = {
  E_CAP_SCHEMA: "a field is missing, unknown, of the wrong type or outside its enum, or a value state contradicts its v",
  E_CAP_TREE: "data/vocab/types.json breaks a tree rule: an id appears twice, a parent is missing, a mark key is not in the registry, a profile or relevance class is unknown",
  E_CAP_PROFILE: "a profile row of data/vocab/types.json breaks the applicability rules (a path is missing, an extension disagrees with the marks, a pair is claimed twice)",
  E_CAP_REF: "a record ref does not resolve to a place, a legacy row, a trip item, or the part or offer of one, or it nests a part/ or offer/ wrapper inside another (one wrapper only, entity-graph 4.4 rule 3)",
  E_CAP_DUP_REF: "a ref appears twice in a file, or in two files",
  E_CAP_TYPE: "a record's type is not in the tree, or contradicts the kind and subkind of its suitability record",
  E_CAP_LAYER: "a record's layer is not one the type allows (a summit is a place, a trail is a route, a rafting trip is an offer)",
  E_CAP_REL_REF: "a relation points at a ref that no record, scope item or alias provides",
  E_CAP_REL_KIND: "a relation is not allowed on the record's layer or type (reaches is a route's, at and on are an offer's, parks_for an access place's; RELATION_RULES)",
  E_CAP_REL_DERIVED: "a derived inverse (reached_by, members, offers_at, access_points, variants, covers, included_in and the rest of CAP_RELATION_DERIVED) is typed in a file; it is computed from the stored side and never stored",
  E_CAP_REL_TARGET: "a relation points at a record of a layer or type its rule does not allow (an access place parks_for an offer, an offer on a place, a route starts_at a route); severity by the gap budget: pinned or known faults warn, new records error",
  E_CAP_REL_CYCLE: "part_of or variant_of loops back to the record (part_of counting covers_areas membership)",
  E_CAP_REL_SYM: "a symmetric relation (alternative_to, combo_with) is stored on both records; store it once, on either side",
  E_CAP_REL_CARD: "a relation holds more targets than its rule allows (ends_at names more than one place)",
  E_CAP_VARIANT: "variant_of names a record of another layer or category, or a record that is itself a variant (one level only)",
  E_CAP_REF_TOP: "a protected area's ref (or alias) is not place/<slug>, or a zone's is not part/<park ref>#<slug> (entity-graph 4.4 rule 4); severity by the gap budget",
  E_CAP_OPERATOR: "run_by names an operator that data/capture/operators.json does not have",
  E_CAP_SRC: "a src id is not in the file's sources table, or a value has no source",
  E_CAP_METHOD: "a source row says crawl or api without a run id, or names a run without saying how the page was taken",
  E_CAP_LINK_ONLY: "a source or a stored URL is on a link-only platform; AllTrails, Komoot, Google and the booking sites are only ever links",
  E_CAP_DRAW_LAYER: "a route has a relevance record (draw and class) without route_is_attraction and a reason, or the flag is on a record that is not a route; draw belongs to the place a visitor comes to see",
  E_CAP_RUN: "a crawl run record is inconsistent: a result without a ref or field in scope, a blocked result without a reason, a searched_none without the pages tried",
  E_CAP_OPERATORS: "an operators file has a duplicate ref or an operator without a name and a URL",
  E_CAP_LANE: "a file of the trip-less lane (core/src/capture/lane.ts) breaks its rules: the folder and the trip id disagree, a record is not about a pinned place/<slug> ref, or a private origin key (loc:, proto:) is in it; checked on its capture, suitability and relevance files",
  E_CAP_PHOTO_LICENCE: "a photo's licence is not on the allowlist (CC BY, CC BY-SA, CC0, public domain; DD-3): NC, ND, all rights reserved and the Unsplash and Pexels licences are refused",
  E_CAP_CHANGESET: "a capture-changeset/1 change targets a file that is not a lane file, gives a value for remove or none for set and add, cites a source the changeset does not list, or repeats a change",
} as const;
export const CAP_WARNING_CODES = {
  W_CAP_NA_FIELD: "a value is stored for a property that the type's contract marks N (never asked)",
  W_CAP_BELOW_USABLE: "required properties of the type's contract are unanswered, so the record is below usable (the suitability slice has its own warning)",
  W_CAP_REL_PARENTS: "a record names more than two part_of parents; the first is the breadcrumb default",
  W_CAP_REL_CARD: "a relation holds more targets than its rule expects (a route with more than one starts_at)",
  W_CAP_STAGE_ORDER: "the stages of one route (routes part_of it) do not chain by ends_at to starts_at, so their order cannot be derived",
  W_CAP_INHERITED_COPY: "a record stores a fact it already inherits from a container: a conditions, status or booking link with the same URL, or a requirement offer of the same type and booking page as one up its containment chain",
  W_CAP_REL_DUP: "a relation names the same target twice (by ref or by alias); the repeat never counts toward cardinality",
} as const;
// The parks contract (protected-area-entry 5.1 C10, entity-graph 5.2; PA-C), checked by core/src/validate/capture.ts on capture/1
// sidecars, each with a failing and a passing case in core/test/capture/entry-validate.test.ts. A block of its own beside the capture
// codes (their names keep the E_CAP_ prefix). E_PLACE_ORPHAN's system-pass exemption (QP1) lives in the placement block.
export const PARK_ERROR_CODES = {
  E_ENTRY_SCHEMA: "an entry block sits on a record that is not an access.pass offer, or its for_types names a type that is not in data/vocab/types.json",
  E_WINDOW_THEN: "a booking window's second phase (then) has a then of its own, or follows a rule that has no phases (anytime, on_arrival)",
  E_PARK_ZONE: "a protected-area zone (nature.protected.zone) names no protected area in part_of; a zone whose ref also breaks E_CAP_REF_TOP is reported there once",
  E_PARK_AREA: "covers_areas names an id that is not an area of the locations store (a country or region is refused: a park covers areas)",
} as const;
export const PARK_WARNING_CODES = {
  W_PARK_AREA: "the locations store has an area named after a protected area (its slug is the park's slug or name) and covers_areas does not name it",
  W_ENTRY_OVERRIDE: "a record's own sourced access_cost no_limit removes requirement offers it would inherit from a container (entity-graph 7.1); listed for review",
} as const;
export const PARK_ERROR_LIST = Object.keys(PARK_ERROR_CODES) as (keyof typeof PARK_ERROR_CODES)[];
export const PARK_WARNING_LIST = Object.keys(PARK_WARNING_CODES) as (keyof typeof PARK_WARNING_CODES)[];
// capture-supersedes/1 codes (contract 9.7), tested in core/test/capture/supersede.test.ts
export const SUP_ERROR_CODES = {
  E_SUP_BASIS: "a supersede entry's basis is not official or operator, or none of its sources is an official or operator page",
  E_SUP_STALE: "a supersede entry's `was` is not the value now stored at its ref and path",
  E_SUP_NOT_LEDGER: "a supersede entry replaces a value that is not a pre-migration ledger leaf, or sits on a capture record; edit those in place",
  E_SUP_PATH: "a supersede entry's ref has no record, or its path is not a value of the record that wins for the ref",
  E_SUP_SCHEMA: "a supersede entry's new value does not have the shape of the value it replaces",
  E_SUP_SRC: "a supersede entry has no source, or names a source that is not in the file's sources",
  E_SUP_DUP: "two supersede entries for the same ref and path",
} as const;
export const SUP_WARNING_CODES = {
  W_SUP_LANE_SRC: "a supersede entry's source page is not in the lane file's sources, so the page shows the basis without a source link",
} as const;
export type CapErrorCode = keyof typeof CAP_ERROR_CODES;
export type CapWarningCode = keyof typeof CAP_WARNING_CODES;
export const CAP_ERROR_LIST = Object.keys(CAP_ERROR_CODES) as CapErrorCode[];
export const CAP_WARNING_LIST = Object.keys(CAP_WARNING_CODES) as CapWarningCode[];
// The placement block and the tiers (META-0, research/method/capture-contract.md 3.7; nearby spec 3.4). A block of their own beside
// the capture codes, each with a failing case in core/test/capture/placement-block.test.ts. Severity is not in the name: a record
// pinned in data/capture/gap-budget.json (it existed when the rule landed) warns, a new record in data/capture errors, a draft
// outside the store warns; W_PLACE_TOWN warns for everyone until the towns layer exists (META-2).
export const PLACE_ERROR_CODES = {
  E_PLACE_AREA: "a place or route has no area_id, or its area_id is not an area, region or country of the locations store",
  E_PLACE_ORPHAN: "an offer or event whose at, on and starts_at (an event's part_of) all fail to reach a place or route",
  E_PLACE_FAR: "a point lies more than 25 km outside the box of the locations-store places of its area (a wrong area or a swapped lat and lon)",
} as const;
export const PLACE_WARNING_CODES = {
  W_PLACE_POINT: "a place or route has no point in either points sidecar (a route may use the point of its starts_at); an error once strict after the migration",
  W_PLACE_APPROX: "a point is marked approx with no approx_note saying why",
  W_PLACE_TOWN: "a place or route with a non-approximate point has no near_town (or a town without near_town_km); derived by META-2",
  W_TIER_REQUIRED: "a key of the record's required tier (the R marks of its type, R? whose condition holds, the suitability R paths) has no value and no dated searched_none",
} as const;
// The keep-or-drop rule and RowMeta (docs/v2/features/catalogue-intake-and-storage.md 2, 3.1 and 3.3; RIS-C). A block of their
// own, each with a failing case in core/test/schema/keep-meta-codes.test.ts. Codes that existing data already trips (a long Val.note)
// run in warn mode until RIS-J rewrites the files: core/src/validate/keep.ts KEEP_ENFORCEMENT, with the counts pinned by
// core/test/schema/keep-budget.json (counts may only fall).
export const KEEP_ERROR_CODES = {
  E_KEEP_UNKNOWN: "a record key that is not a registry property, a schema key of its file family, or a reserved RowMeta key",
  E_SUMMARY_LONG: "a public summary is longer than 160 characters",
  E_NOTE_LONG: "a Val.note (public, served through apiVal) is longer than 280 characters",
} as const;
export const KEEP_WARNING_CODES = {
  W_KEEP_UNREAD: "a trip-level file key that no adapter reads (listed by normalise.ts --check for review; RIS-N)",
  W_QUOTE_LONG: "a Val.quote is longer than 120 characters: still served (owner Q174 keeps 300), flagged for the owner's review",
} as const;
export const META_ERROR_CODES = {
  E_META_KEY: "a meta block holds a key RowMeta does not reserve, or a reserved key on a table it is not allowed on",
  E_META_SCHEMA: "a meta block is not an object, has no schema_version, or a key has the wrong type or an unknown freshness class",
  E_META_SIZE: "a meta block is larger than 4 KB",
  E_META_RAWREF: "raw_ref (a path into research/inbox/) or privacy_class private on a row of a table that is not private",
  E_META_SN_PROP: "a meta.searched_none entry names a registry property; a property's own search is its Val",
  E_META_PRIVACY: "a meta block holds a private origin key, a household note, an email address, a secret or page HTML",
} as const;
export const META_WARNING_CODES = {
  W_META_SIZE: "a meta block is larger than 1 KB: usually prose that belongs in the research archive",
} as const;
export const KEEP_ERROR_LIST = Object.keys(KEEP_ERROR_CODES) as (keyof typeof KEEP_ERROR_CODES)[];
export const KEEP_WARNING_LIST = Object.keys(KEEP_WARNING_CODES) as (keyof typeof KEEP_WARNING_CODES)[];
export const META_ERROR_LIST = Object.keys(META_ERROR_CODES) as (keyof typeof META_ERROR_CODES)[];
export const META_WARNING_LIST = Object.keys(META_WARNING_CODES) as (keyof typeof META_WARNING_CODES)[];
export type PlaceErrorCode = keyof typeof PLACE_ERROR_CODES;
export type PlaceWarningCode = keyof typeof PLACE_WARNING_CODES;
export const PLACE_ERROR_LIST = Object.keys(PLACE_ERROR_CODES) as PlaceErrorCode[];
export const PLACE_WARNING_LIST = Object.keys(PLACE_WARNING_CODES) as PlaceWarningCode[];
