// Places: the list row (the P8 allowlist), the query, the facet counts and the detail (the page model) of the public API
// (EXECUTION-PLAN 4.2; schema diff 13.1 items 1 to 5).
import { z } from "zod";
import { API_LIMITS } from "./limits.ts";
import { apiCountry, apiPoint, apiRef, apiSlug } from "./common.ts";
import { apiAnyVal, apiCitation, apiSourceId } from "./val.ts";

// ---- vocabularies the public model uses (web/lib/public/types.ts holds the same lists; web typecheck ties them, see rows.ts) ----

export const PLACE_KINDS = ["trail", "lake", "viewpoint", "waterfall", "sight", "town", "area", "activity", "lift", "stay", "eatery"] as const;
export const PLACE_CATEGORIES = ["stays", "trails", "sights", "activities", "food", "logistics"] as const;
export const HONESTY_IDS = [
  "estimate", "not_known", "sources_disagree", "low_confidence", "location_unconfirmed", "unverified", "no_source", "dates_open",
  "condensed", "overview_only", "drive_estimated", "pattern_2026",
] as const;
export const COMPLETENESS_LEVELS = ["draft", "usable", "complete"] as const;
/** Where a place's facts came from (the page's origin list, not a citation). */
export const PLACE_ORIGINS = ["locations", "prototype", "trail", "capture"] as const;

// ---- the list row -----------------------------------------------------------------------------------------------------------

const tag = z.strictObject({ id: z.string(), label: z.string(), kind: z.string() });
const tripRef = z.strictObject({ slug: apiSlug, title: z.string() });
const listHonesty = z.strictObject({ id: z.enum(HONESTY_IDS), label: z.string() });

/**
 * One row of the Places list as the site ships it today: card and filter fields only (principle P8, backlog 2.24). Exactly the 41
 * keys of `PLACE_LIST_KEYS` in web/components/places/rows.ts, which derives the type and the key list from this schema, and
 * web/tests/data/light-data.test.ts pins them. The descriptions live on the web type's history; the schema is the allowlist.
 */
export const placeListRowShape = {
  id: apiSlug,
  slug: apiSlug,
  name: z.string(),
  kind: z.enum(PLACE_KINDS),
  kindLabel: z.string(),
  legacyKind: z.string().nullable(),
  country: apiCountry,
  country_name: z.string(),
  /** the canonical region key: the kebab of the region's English name (`alberta`), pinned in the slug registry (D-B3) */
  region: z.string(),
  region_name: z.string(),
  /** every spelling of the region a URL may carry: the slug, the name, the legacy code, the ISO 3166-2 code */
  regionAliases: z.array(z.string()),
  area: z.string(),
  area_name: z.string(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  km: z.number().nullable(),
  gain_m: z.number().nullable(),
  elevation_m: z.number().nullable(),
  season: z.array(z.int().min(1).max(12)),
  kid_fit: z.string(),
  tags: z.array(tag),
  image: z.string().nullable(),
  trips: z.array(tripRef),
  honesty: z.array(listHonesty),
  completeness: z.strictObject({ level: z.enum(COMPLETENESS_LEVELS), label: z.string() }),
  sourceTypes: z.array(z.string()),
  statsState: z.enum(["verified", "unverified"]).nullable(),
  researched: z.boolean(),
  added: z.string(),
  type: z.string().nullable(),
  effort: z.string().nullable(),
  kids_from: z.number().nullable(),
  kids_basis: z.enum(["rule", "advice"]).nullable(),
  time_band: z.string().nullable(),
  price_band: z.string().nullable(),
  booking: z.string().nullable(),
  flags: z.array(z.string()),
  walk_band: z.string().nullable(),
  shape: z.string().nullable(),
  best_time: z.string().nullable(),
  badge: z.string().nullable(),
};
export const placeListRow = z.strictObject(placeListRowShape);

/**
 * `PlaceRow`: the API's list row. The shipped row plus `ref` (D-B2; schema diff 13.1 items 1 and 2), and nothing else: these 42 keys are
 * the allowlist `respond()` checks every row against (contract case K2).
 */
export const placeRow = z.strictObject({ ...placeListRowShape, ref: apiRef });

/** The keys of a row, in schema order: the allowlist. */
export const PLACE_ROW_KEYS = Object.keys(placeRow.shape) as (keyof typeof placeRow.shape)[];
export const PLACE_LIST_ROW_KEYS = Object.keys(placeListRow.shape) as (keyof typeof placeListRowShape)[];

// ---- the query ----------------------------------------------------------------------------------------------------------------

/**
 * The facet keys of the Places list (web/lib/entities/types.ts FACET_PARAMS, plus `city` from the nearby spec 4.2), and the scoped
 * facets `f.<id>` of a narrowed Kind (capture contract 7.1). A key outside this list is `invalid_input`.
 */
export const PLACE_FACET_KEYS = [
  "country", "region", "area", "city", "kind", "k", "style", "grade", "kid", "season", "tag", "trip", "due", "effort", "stroller",
  "length", "around", "perday", "shape", "drive",
] as const;
export const FACET_KEY_RE = new RegExp(`^(?:${PLACE_FACET_KEYS.join("|")}|f\\.[a-z][a-z0-9_]*)$`);
export const facetKey = z.string().regex(FACET_KEY_RE);

/** A sort key of the descriptor, `-` for descending (`name`, `-km`). */
export const sortSpec = z.string().regex(/^-?[a-z][a-z0-9_]*$/);

/** [west, south, east, north] in degrees. */
export const apiBbox = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90), z.number().min(-180).max(180), z.number().min(-90).max(90)]);

/**
 * `PlaceQuery`: the list's URL state as the API reads it (EXECUTION-PLAN 4.3 rule 3: the same keys in the page URL, the API and every
 * adapter). `facets.region` accepts every alias of a region (the slug, the name, the ISO 3166-2 code, the legacy code); the store
 * normalises it to the canonical slug before filtering (D-B3, case K14). `facets.city` takes a town id (`ca-on-whitby`) and answers
 * `not_available` until the towns layer exists (META-2, case K15).
 */
export const placeQuery = z.strictObject({
  q: z.string().max(API_LIMITS.query.textChars).optional(),
  facets: z.record(facetKey, z.array(z.string().min(1).max(120)).max(API_LIMITS.query.valuesPerKey)).optional(),
  sort: z.array(sortSpec).max(API_LIMITS.query.sortKeys).optional(),
  bbox: apiBbox.optional(),
  /** a hand-picked set (`ids=`): slugs */
  ids: z.array(apiSlug).max(API_LIMITS.query.ids).optional(),
});

/** One option of a facet with its live count. */
export const facetCount = z.strictObject({
  value: z.string(),
  label: z.string(),
  count: z.int().min(0),
  group: z.string().optional(),
  hint: z.string().optional(),
});

/**
 * `FacetCounts`: counts only, no rows (countPlaces). `n` rows match; `unchecked` more fail only on a gap ("not checked yet", H1);
 * `scope` is the denominator of the count line; `total` the catalogue.
 */
export const facetCounts = z.strictObject({
  n: z.int().min(0),
  unchecked: z.int().min(0),
  scope: z.int().min(0),
  total: z.int().min(0),
  facets: z.record(facetKey, z.array(facetCount)),
  /** per facet with a "not known" state, the rows in it that match every other filter */
  gaps: z.record(z.string(), z.int().min(0)),
  /** extra words for the count line ("12 not checked yet") */
  notes: z.array(z.string()),
});

// ---- the detail: the page model ------------------------------------------------------------------------------------------------

const refLinkShape = { ref: apiRef, name: z.string() };
const refLink = z.strictObject(refLinkShape);

const photo = z.strictObject({
  file: z.string(),
  url: z.string(),
  width: z.int().min(1),
  caption: z.string(),
  author: z.string(),
  licence: z.string(),
  licenceUrl: z.string().nullable(),
  sourceUrl: z.string(),
  group: z.string().nullable(),
});

const areaRef = z.strictObject({ level: z.enum(["country", "state", "district"]), name: z.string(), slug: z.string() });

const accessPoint = z.strictObject({
  ...apiPoint.shape,
  name: z.string(),
  note: z.string().nullable(),
  elevationM: z.number().nullable(),
  fee: z.string().nullable().optional(),
  capacity: z.string().nullable().optional(),
});

const profile = z.strictObject({
  samples: z.array(z.tuple([z.number(), z.number()])),
  km: z.number(),
  gainM: z.number(),
  lossM: z.number(),
  highM: z.number(),
  lowM: z.number(),
  dem: z.string(),
});

const placeLine = z.strictObject({
  ref: z.string(),
  label: z.string(),
  source: z.string(),
  exportable: z.boolean(),
  geometry: z.array(z.tuple([z.number(), z.number()])).optional(),
  segments: z.array(z.array(z.tuple([z.number(), z.number()]))).optional(),
  dashed: z.boolean().optional(),
  profile: profile.nullable().optional(),
  credit: z.string().optional(),
});

const fact = z.strictObject({
  label: z.string(),
  value: z.string(),
  provenance: z.string(),
  conflicts: z.array(z.strictObject({ value: z.string(), provenance: z.string() })),
});

const linkGroup = z.strictObject({
  group: z.string(),
  links: z.array(z.strictObject({ kind: z.string(), label: z.string(), url: z.string(), linkOnly: z.boolean() })),
});
const linkNone = z.strictObject({ group: z.string(), kind: z.string(), label: z.string(), date: z.string() });

const completeness = z.strictObject({
  level: z.enum(COMPLETENESS_LEVELS),
  passed: z.int().min(0),
  total: z.int().min(0),
  notTracked: z.int().min(0),
  failed: z.array(z.strictObject({ id: z.string(), label: z.string(), hint: z.string() })),
  label: z.string(),
  tooltip: z.string(),
});

const honesty = z.strictObject({ id: z.enum(HONESTY_IDS), label: z.string(), reason: z.string() });

// sections (capture contract S1; web/lib/public/sections.ts)
const LOOKS = ["rule", "advice", "info", "sentence", "gap"] as const;
const sectionRow = z.strictObject({
  key: z.string(),
  label: z.string(),
  valueType: z.string(),
  mark: z.string(),
  home: z.string(),
  echo: z.boolean(),
  text: z.string().nullable(),
  value: z.unknown(),
  val: apiAnyVal.nullable(),
  state: apiAnyVal.shape.state,
  gap: z.boolean(),
  gapWording: z.string(),
  unit: z.string().nullable(),
  links: z.array(refLink),
  look: z.enum(LOOKS),
});
const sectionModel = z.strictObject({
  n: z.int(),
  id: z.string(),
  title: z.string(),
  drawn: z.boolean(),
  rows: z.array(sectionRow),
  closing: z.string().nullable(),
  empty: z.boolean(),
  delegate: z.enum(["suitability", "relevance"]).nullable(),
  lines: z.array(z.strictObject({ kind: z.string(), text: z.string(), home: z.string() })),
});
const pageModel = z.strictObject({
  ref: apiRef,
  type: z.string(),
  layer: z.string(),
  name: z.string(),
  typeLabel: z.string(),
  sections: z.array(sectionModel),
  glance: z.array(z.string()),
  suitabilityRef: z.string().nullable(),
  ticket: refLink.nullable(),
  payoff: refLink.nullable(),
  partOf: z.array(refLink),
  parts: z.array(z.strictObject({ ...refLinkShape, type: z.string() })),
  ways: z.array(z.strictObject({ ...refLinkShape, type: z.string(), layer: z.string() })),
  routeStops: z.array(z.strictObject({ ...refLinkShape, role: z.enum(["starts_at", "reaches", "passes", "ends_at"]), atKm: z.number().nullable() })),
  accessPoints: z.array(z.strictObject({ ...refLinkShape, role: z.enum(["starts_here", "parks_for", "serves", "starts_at"]), type: z.string() })),
  offers: z.array(z.strictObject({
    ...refLinkShape,
    offerClass: z.string().nullable(),
    type: z.string(),
    at: refLink.nullable(),
    operator: refLink.nullable(),
    rows: z.array(sectionRow),
    closing: z.string().nullable(),
  })),
  around: z.array(z.strictObject({
    domain: z.string(),
    at: refLink.nullable(),
    items: z.array(z.strictObject({ ...refLinkShape, type: z.string(), offerClass: z.string().nullable(), where: refLink.nullable() })),
  })),
  links: z.array(z.strictObject({
    kind: z.string(),
    state: z.enum(["filled", "searched_none", "found_in_search", "not_checked"]),
    url: z.string().nullable(),
    required: z.enum(["R", "R?", "A"]),
    searched: z.string().nullable(),
  })),
  directions: z.union([
    z.strictObject({ mode: z.literal("drive"), ref: apiRef, name: z.string(), lat: z.number(), lon: z.number(), pointSource: z.string(), role: z.enum(["parks_for", "serves", "starts_at"]) }),
    z.strictObject({ mode: z.literal("transit"), stops: z.array(z.strictObject({ ref: apiRef, name: z.string() })) }),
  ]).nullable().optional(),
  legacyMapped: z.array(z.string()).optional(),
  checks: z.strictObject({ done: z.int().min(0), total: z.int().min(0), read: z.string().nullable(), level: z.string() }),
});

// "Who it suits" (suitability-display; web/lib/public/suitability.ts)
const chip = z.strictObject({
  kind: z.string(),
  text: z.string(),
  glyph: z.string(),
  label: z.string(),
  field: z.string().nullable(),
  extra: z.int().min(0),
  textNoTime: z.string().optional(),
});
const suitability = z.strictObject({
  ref: apiRef,
  chips: z.tuple([chip.nullable(), chip.nullable(), chip.nullable()]),
  warning: z.string().nullable(),
  research: z.strictObject({
    done: z.int().min(0),
    total: z.int().min(0),
    read: z.string().nullable(),
    level: z.string(),
    levelLabel: z.string(),
    text: z.string(),
    softSafety: z.array(z.string()),
  }),
  groups: z.array(z.strictObject({
    id: z.string(),
    title: z.string(),
    open: z.boolean(),
    rows: z.array(z.strictObject({
      key: z.string(),
      label: z.string(),
      text: z.string(),
      look: z.enum(LOOKS),
      val: apiAnyVal.nullable(),
      gap: z.boolean(),
      honesty: z.string().nullable(),
      short: z.string(),
    })),
    closing: z.string().nullable(),
  })),
  card: z.strictObject({ kids: chip.nullable(), effort: chip.nullable() }),
  accessChips: z.array(chip),
  adultTime: z.strictObject({ text: z.string(), basis: z.string() }).nullable(),
  kidsFrom: z.number().nullable(),
  familyEffort: z.strictObject({ grade: z.int().min(1).max(5), name: z.string(), sourceGrade: z.string().nullable() }).nullable(),
  allMissing: z.boolean(),
});

// relevance (web/lib/public/relevance.ts); the popover's sources are registry ids, resolved through `citations`
const badge = z.strictObject({ kind: z.enum(["journey", "detour", "local"]), label: z.string() });
const similarPlace = z.strictObject({
  ...refLinkShape,
  km: z.number(),
  badge: badge.nullable(),
  effortName: z.string().nullable(),
  access: z.string(),
  planB: z.boolean(),
});
const relevance = z.strictObject({
  ref: apiRef,
  judgedRef: apiRef,
  fromPayoff: z.boolean(),
  payoff: refLink.nullable(),
  payoffMissing: z.boolean(),
  badge: badge.nullable(),
  notJudged: z.boolean(),
  why: z.string().nullable(),
  provenance: z.strictObject({
    judgement: z.strictObject({ note: z.string().nullable(), basis: apiAnyVal.shape.basis, read: z.string().nullable() }),
    designations: z.array(z.strictObject({ type: z.string(), label: z.string(), name: z.string(), scope: z.enum(["own", "parent"]), scopeText: z.string().nullable() })),
    mentions: z.array(z.strictObject({ publisher: z.string(), title: z.string(), year: z.int(), list: z.enum(["top_list", "listed"]), reach: z.string().nullable() })),
    fame: z.strictObject({ wikipediaLanguages: z.int().min(0), read: z.string() }).nullable(),
    volume: z.strictObject({ count: z.number(), unit: z.string(), scope: z.string(), year: z.int() }).nullable(),
    src: z.array(apiSourceId),
    noRatings: z.string(),
    read: z.string().nullable(),
  }).nullable(),
  partOf: z.array(refLink),
  similar: z.array(similarPlace),
  similarArea: z.array(similarPlace),
  pairs: z.array(z.strictObject({
    ...refLinkShape,
    km: z.number().nullable(),
    how: z.string().nullable(),
    extraMin: z.number().nullable(),
    onSiteMin: z.number().nullable(),
    onSiteEstimated: z.boolean(),
    handPicked: z.boolean(),
    reason: z.string().nullable(),
    badge: badge.nullable(),
    relation: z.literal("starts_here").nullable(),
  })),
  pointer: z.strictObject({ ...refLinkShape, km: z.number(), draw: z.string(), sameClass: z.boolean(), text: z.string() }).nullable(),
  planB: z.strictObject({
    ...refLinkShape,
    km: z.number(),
    access: z.string(),
    effortName: z.string().nullable(),
    risk: z.string(),
    reason: z.string().nullable(),
    source: z.strictObject({ label: z.string(), url: z.string() }).nullable(),
  }).nullable(),
  role: z.string().nullable(),
  flags: z.strictObject({ go_clear_day: z.boolean(), rainy_day: z.boolean(), en_route: z.boolean(), hidden_gem: z.boolean() }).nullable(),
  fromHubs: z.record(z.string(), z.number()),
});

/**
 * `PlaceDetail`: the page model of one place (getPlace). The public place of web/lib/public/types.ts `PublicPlace`, with three changes
 * the contract makes: `ref` beside `slug` (D-B2); every point is an `apiPoint` with `pointRole` and `approx` (13.1 item 3, case K16);
 * every sourced value is an `apiVal` whose `src` are registry ids, resolved through `citations` (D-B4, cases K12 and K13). The card
 * fields `type` and `badge` ride along so a client needs no second call.
 */
export const placeDetail = z.strictObject({
  ref: apiRef,
  slug: apiSlug,
  name: z.string(),
  kind: z.enum(PLACE_KINDS),
  kindLabel: z.string(),
  subkind: z.string().nullable(),
  category: z.enum(PLACE_CATEGORIES),
  type: z.string().nullable(),
  badge: z.string().nullable(),
  areaChain: z.array(areaRef),
  areaLabel: z.string(),
  point: apiPoint.nullable(),
  season: z.array(z.int().min(1).max(12)),
  kidFit: z.string(),
  summary: z.string(),
  photo: photo.nullable(),
  trips: z.array(tripRef),
  tags: z.array(z.string()),
  completeness,
  honesty: z.array(honesty),
  stats: z.strictObject({ distanceKm: z.number().nullable(), gainM: z.number().nullable(), hours: z.string().nullable() }),
  sources: z.array(z.enum(PLACE_ORIGINS)),
  elevationM: z.number().nullable(),
  access: z.strictObject({ trailhead: accessPoint.nullable(), parking: z.array(accessPoint) }).nullable(),
  lines: z.array(placeLine),
  facts: z.array(fact),
  hazards: z.array(z.string()),
  links: z.array(linkGroup),
  linksNone: z.array(linkNone),
  seasonNote: z.string().nullable(),
  photos: z.array(photo),
  wikidata: z.string().nullable(),
  notes: z.string(),
  minAge: z.number().nullable(),
  booking: z.string().nullable(),
  sections: pageModel.nullable(),
  suitability: suitability.nullable(),
  relevance: relevance.nullable(),
  refSlugs: z.record(z.string(), apiSlug),
  /** every source the values of this detail cite, by registry id */
  citations: z.record(apiSourceId, apiCitation),
});

/** A retired slug (D-B1): getPlace answers the current one, and the handler answers 308 (case K9). */
export const movedPlace = z.strictObject({ moved: apiSlug, ref: apiRef });

/** What getPlace returns: the detail, or where it moved. */
export const placeLookup = z.union([placeDetail, movedPlace]);

export const placeSlugInput = z.strictObject({ slug: apiSlug });

export type PlaceListRow = z.infer<typeof placeListRow>;
export type PlaceRow = z.infer<typeof placeRow>;
export type PlaceQuery = z.infer<typeof placeQuery>;
export type FacetCount = z.infer<typeof facetCount>;
export type FacetCounts = z.infer<typeof facetCounts>;
export type PlaceDetail = z.infer<typeof placeDetail>;
export type MovedPlace = z.infer<typeof movedPlace>;
export type PlaceLookup = z.infer<typeof placeLookup>;
export type PlaceKind = (typeof PLACE_KINDS)[number];
