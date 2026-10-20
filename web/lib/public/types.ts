// Public data model. Everything here is plain JSON (no Map, Date, class or undefined): the static pages
// receive these values as props. Absent values are `null`.
import type { DayTimeline, Profile, ScheduleDayInput } from '@travel/core/schedule/types.ts';
import type { KnowGroup, NoteBlock, CleanProse } from './prose';
import type { ListBands } from '@travel/core/capture/bandKeys.ts';
import type { LengthClass } from '@travel/core/derive/length.ts';
import type { TripTags } from './tags';
import type { PageModel } from './sections';
import type { Chip, PublicSuitability } from './suitability';
import type { PublicRelevance } from './relevance';

/** The six trip categories, in the fixed order patterns 3.4 requires. */
export const CATEGORIES = ['stays', 'trails', 'sights', 'activities', 'food', 'logistics'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  stays: 'Stays',
  trails: 'Trails',
  sights: 'Sights',
  activities: 'Activities',
  food: 'Food',
  logistics: 'Logistics',
};

/** How much a trip holds: full day-by-day plan, a condensed stop list, or a card only. */
export type Depth = 'full' | 'summary' | 'overview';
export type TripVisibility = 'public' | 'unlisted';

/** Canonical place kinds. Data kinds that are not among the fifteen research kinds map onto these. */
export const PLACE_KINDS = ['trail', 'lake', 'viewpoint', 'waterfall', 'sight', 'town', 'area', 'activity', 'lift', 'stay', 'eatery'] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export type HonestyId =
  | 'estimate'
  | 'not_known'
  | 'sources_disagree'
  | 'low_confidence'
  | 'location_unconfirmed'
  | 'unverified'
  | 'no_source'
  | 'dates_open'
  | 'condensed'
  | 'overview_only'
  | 'drive_estimated'
  | 'pattern_2026';

export interface Honesty {
  id: HonestyId;
  /** The chip text, from components 2.8. */
  label: string;
  /** Why it is shown, in one sentence. */
  reason: string;
}

export interface Photo {
  /** Commons file name with spaces, as in the credits file. */
  file: string;
  /** Special:FilePath URL at `width`. Use `photoSrcSet` for responsive images. */
  url: string;
  width: number;
  caption: string;
  author: string;
  licence: string;
  licenceUrl: string | null;
  sourceUrl: string;
  /** The gallery section the photo sits in (a place or theme), when it has one. */
  group: string | null;
}

export interface Point {
  lat: number;
  lon: number;
  /** osm_node:<id>, osm_way:<id>, osm_relation:<id>, wikidata:<QID>, official:<url>, manual_pin or prototype_approx. Never Google. */
  pointSource: string;
  /** Who looked at the pin, or null when nobody has. */
  pointChecked: string | null;
  /** Licence of the source geometry, for the export guard. */
  sourceLicence: string;
}

export interface AccessPoint extends Point {
  name: string;
  note: string | null;
  elevationM: number | null;
  fee?: string | null;
  capacity?: string | null;
}

export interface PlaceLine {
  /** osm_relation:<id> or similar. */
  ref: string;
  label: string;
  source: string;
  /** True only for OSM-derived lines with an osm_ref, or official sources whose licence allows reuse. */
  exportable: boolean;
  /** [lon, lat] of the stored OSM track (data/tracks), simplified to about 5 m. Absent when no track is stored. Page-only: never in a list or search file (P8). */
  geometry?: [number, number][];
  /** A relation that did not stitch into one line, drawn as pieces. */
  segments?: [number, number][][];
  /** Drawn dashed and labelled "Route not confirmed yet": held back for a person to confirm, or not one line. */
  dashed?: boolean;
  /** Elevation along the stored line; null when only a sketch can be drawn. */
  profile?: PlaceProfile | null;
  /** "OpenStreetMap, read 2026-10-19; elevation AWS Terrain Tiles" */
  credit?: string;
}

/** Elevation sampled along a stored track: `samples` are [km along the line, metres]. Totals are computed from them (5 m hysteresis). */
export interface PlaceProfile {
  samples: [number, number][];
  km: number;
  gainM: number;
  lossM: number;
  highM: number;
  lowM: number;
  dem: string;
}

export interface Fact {
  label: string;
  value: string;
  /** "PLAN.md, read Aug 2026 (operator)" */
  provenance: string;
  /** Sources that disagree, when they do. */
  conflicts: { value: string; provenance: string }[];
}

export interface LinkItem {
  kind: string;
  label: string;
  url: string;
  /** Platforms whose terms allow a link only (AllTrails): never copy their data. */
  linkOnly: boolean;
}
/** A link kind that was searched for and not found ("searched, none found on <date>"). The searcher's private note is not carried. */
export interface LinkNone {
  group: string;
  kind: string;
  label: string;
  /** ISO date of the search. */
  date: string;
}
export interface LinkGroup {
  group: string;
  links: LinkItem[];
}

export type CompletenessLevel = 'draft' | 'usable' | 'complete';
export interface Completeness {
  level: CompletenessLevel;
  passed: number;
  /** Tracked checks only. */
  total: number;
  /** The profile's total minus the tracked checks. */
  notTracked: number;
  failed: { id: string; label: string; hint: string }[];
  /** "Usable · 7 of 11" */
  label: string;
  /** "7 of 11 tracked checks pass; 13 checks are not tracked yet" */
  tooltip: string;
}

export interface AreaRef {
  level: 'country' | 'state' | 'district';
  name: string;
  /** ISO 3166-1 alpha-2, lower case, for the country; a URL slug below it. */
  slug: string;
}

export interface TripRef {
  slug: string;
  title: string;
}

export interface PublicPlaceCard {
  slug: string;
  name: string;
  kind: PlaceKind;
  /** "Lake", "Area", "Scenic drive" */
  kindLabel: string;
  subkind: string | null;
  category: Category;
  areaChain: AreaRef[];
  /** "Dolomites, Italy" style: the area name and country. */
  areaLabel: string;
  point: Point | null;
  season: number[];
  kidFit: string;
  summary: string;
  photo: Photo | null;
  trips: TripRef[];
  tags: string[];
  completeness: Completeness;
  honesty: Honesty[];
  /** distance_km, gain_m, hours for trails; null when not known. */
  stats: { distanceKm: number | null; gainM: number | null; hours: string | null };
  /** Where the facts came from: 'locations', 'prototype', 'trail'. */
  sources: ('locations' | 'prototype' | 'trail' | 'capture')[];
  /** The capture type id (`nature.trail.hike`), or the category its kind implies. The Kind pill and the type-aware facets read it (L3b). */
  type: string | null;
  /** Labels and bands for the list filters (capture contract 7.3). Never a fact with a source (P8). Every band is null for a place with no capture record. */
  bands: ListBands;
  /** The one relevance badge of the card (relevance 6.2): "Worth the journey", "Worth a detour" or "Local favourite". Null when nobody has judged it that way. */
  badge: string | null;
}

/** The list-only fields of a place card (L3b) are added when the card is made, so the place builder and the place page never carry them. */
export interface PublicPlace extends Omit<PublicPlaceCard, 'type' | 'bands' | 'badge'> {
  elevationM: number | null;
  access: { trailhead: AccessPoint | null; parking: AccessPoint[] } | null;
  lines: PlaceLine[];
  facts: Fact[];
  hazards: string[];
  links: LinkGroup[];
  /** Link kinds searched with no result, for the Links tabs. */
  linksNone: LinkNone[];
  seasonNote: string | null;
  photos: Photo[];
  wikidata: string | null;
  /** Free-form notes from the place store, scrubbed of private trip references. */
  notes: string;
  minAge: number | null;
  booking: string | null;
  /** The 14 sections of the capture contract for this place (S1). Null for a place with no capture record, which keeps the older page. */
  sections: PageModel | null;
  /** "Who it suits": the chips, the warning line, the research line and the six groups. Null when the record has no suitability block. */
  suitability: PublicSuitability | null;
  /** The relevance badge with its why line and provenance, Similar nearby, Nearby worth adding, the pointer and Plan B. */
  relevance: PublicRelevance | null;
  /** Page slug of every ref the blocks above link to; a ref with no page is plain text. */
  refSlugs: Record<string, string>;
}

export interface DayItem {
  /** Stable within the trip: the prototype item id, or <day>-<track>-<n> for Rockies items. */
  id: string;
  name: string;
  kind: PlaceKind | 'airport' | 'parking' | 'booking';
  subkind: string | null;
  /** null when the item is access that is folded into another item (a lot, a lift used for access). */
  category: Category | null;
  /** Item id this one is folded into, when `category` is null. */
  foldedInto: string | null;
  placeSlug: string | null;
  time: string | null;
  /** "A" or "B" lane on a split day (Dolomites). */
  variant: string | null;
  durationMin: number | null;
  note: string | null;
  /** distance, climb, time shown in the row for trails. */
  stats: { distanceKm: number | null; gainM: number | null; hours: string | null } | null;
  /** "starts at Passo Tre Croci" or "by Seceda gondola". */
  access: string | null;
  /** The three suitability chips of the place this stop is, and its relevance badge (S1; suitability-display 3.3, relevance 6.2). Absent when the stop has no page or no record. */
  suit?: ItemSuit | null;
}

/** What a timeline entry draws about the place it visits. Plain JSON: the page works the fit chip out from `kidsFrom` for the party in the URL. */
export interface ItemSuit {
  /** slot 1 (limits), slot 2 (effort or time, without the time: the entry carries the duration), slot 3 */
  chips: Chip[];
  kidsFrom: number | null;
  kidsBasis: 'rule' | 'advice' | null;
  /** "Worth the journey" on an anchor of a trip of 4 or more nights, "Local favourite" on the top stop of a short one; otherwise null */
  badge: string | null;
}

export interface Track {
  id: 'A' | 'B' | 'C';
  /** "Adults", "Whole family", "Easy day" */
  label: string;
  title: string;
  items: DayItem[];
  notes: string | null;
}

/** One version of a day (trip-timeline spec 3.2) as the page needs it to label a menu and show the track's notes. */
export interface DayVariantInfo {
  key: 'A' | 'B' | 'C' | 'main';
  label: string;
  /** The day's title for this version, when it differs from the day's own. */
  title: string | null;
  audience: 'adults' | 'family' | 'easy' | 'any';
  relation: 'alternative' | 'parallel';
  /** The track's note: a lead line and "Know before you go" bullets, markers already turned into chips. */
  notes: NoteBlock;
}

export interface PublicDay {
  n: number;
  title: string;
  /** Base id within the trip (see `bases`), or null on travel days with no base. */
  baseId: string | null;
  base: string | null;
  driveMin: number | null;
  /** True when driveMin is an estimate (the straight line times 1.42, or the Rockies matrix inference). */
  driveIsEstimate: boolean;
  summary: string | null;
  items: DayItem[];
  tracks: Track[] | null;
  /** Timeline inputs. null on overview trips, which have no days. */
  scheduleInput: ScheduleDayInput | null;
  variants: DayVariantInfo[];
  /** The day's own Know before you go: decision rule, wet-weather swap and status flags. */
  know: KnowGroup[];
  /** The day summary with research markers removed, when it differs from `summary`. */
  summaryProse: CleanProse | null;
  /** "Sunrise about 07:05 to 07:25, sunset about 19:45 to 20:16 in this window", computed with core/src/sun. */
  light: string | null;
}

export interface PublicBase {
  id: string;
  name: string;
  nights: number;
  /** Day numbers the base covers. */
  days: number[];
  point: Point | null;
}

export interface CategoryItem {
  key: string;
  category: Category;
  name: string;
  kind: string;
  placeSlug: string | null;
  /** Day numbers, ascending. One entry per distinct item. */
  days: number[];
  /** First time of day it is planned at, when known. */
  time: string | null;
  areaLabel: string | null;
  /** The row's detail line, e.g. "4 nights". */
  detail: string | null;
  nights: number | null;
  /** "Opens 30 days before Day 3 at 08:00 local", as a rule. */
  bookRule: BookRule | null;
  bookNote: string | null;
}

export interface BookRule {
  daysBefore: number;
  dayN: number | null;
  time: string | null;
  tz: string | null;
}

export interface Season {
  months: number[];
  label: string;
  why: string;
  weather: { tempC: string; rain: string; daylight: string; notes: string[] };
}

export interface PublicTripCard {
  slug: string;
  title: string;
  subtitle: string;
  depth: Depth;
  visibility: TripVisibility;
  /** Trip length. Public trips are dateless templates: days, nights and a season, never calendar dates. */
  nights: number | null;
  daysCount: number | null;
  /** True when the trip has no season yet; the page says "season not set yet". */
  seasonNotSet: boolean;
  /** The trip already happened: goes in the "done, use as a template" group. */
  isDone: boolean;
  region: string;
  cover: Photo | null;
  season: Season | null;
  /** First base, for the globe pin and the card. */
  firstBase: string | null;
  legacyUrl: string;
  honesty: Honesty[];
  /** Derived tags for the card and the Trips filters (L3b). Overview trips carry Where, Length and When only. */
  tags: TripTags;
  /** Day, overnight, weekend, long weekend or multi-day; null when the plan has no night count. */
  lengthClass: LengthClass | null;
  /** Drive from each public hub, when the hub matrix has it (short-trips 4.1). Empty until then. */
  fromHubs: FromHub[];
}

/** The timeline for the default profile, built at publish time (spec D2). The page re-runs the scheduler when the URL differs. */
export interface TripSchedule {
  defaultProfile: Profile;
  /** "families with a child from about 6": who the plan suits, never who travelled. */
  writtenFor: string;
  timelines: DayTimeline[];
  /** True when most times come from rules, not from the plan. */
  condensed: boolean;
  /** Some day has a parallel option (a split). */
  hasSplit: boolean;
  /** Some day has more than one version. */
  hasVariants: boolean;
}

export type HubId = 'toronto' | 'hamilton' | 'ottawa' | 'montreal';
export interface FromHub {
  hub: HubId;
  minutes: number;
  km: number;
  basis: 'routed' | 'estimate';
  fetched: string;
}

/** Likewise the trip card's derived fields (L3b) are added when the card is made. */
export interface PublicTrip extends Omit<PublicTripCard, 'tags' | 'lengthClass' | 'fromHubs'> {
  /** null on overview trips. */
  schedule: TripSchedule | null;
  bases: PublicBase[];
  days: PublicDay[];
  /** All six categories, always present. Empty for overview trips. */
  categories: Record<Category, CategoryItem[]>;
  gallery: Photo[];
  effort: string | null;
  ageFit: number | null;
  driveAvgMin: number | null;
}

export interface GlobeNode {
  slug: string;
  name: string;
  places: number;
  trips: number;
  children: GlobeNode[];
}
export interface GlobePin {
  kind: 'place' | 'trip';
  slug: string;
  name: string;
  lat: number;
  lon: number;
  /** Place kind, or the trip depth. */
  type: string;
  path: string[];
  /** True when the pin is a country centre or an approximate prototype point, not the real spot. */
  approx: boolean;
  /**
   * How far people travel for it (relevance 6.4): the globe draws `world` and `national` first, adds `regional` at state level and shows
   * `local` as quiet dots. One word per pin, no judgement note and no signal (P8). A place nobody has judged counts as `local`; a trip is `world`.
   */
  tier: DrawTier;
}
export type DrawTier = 'world' | 'national' | 'regional' | 'local';
export interface GlobeIndex {
  continents: { slug: string; name: string; places: number; trips: number; countries: GlobeNode[] }[];
  pins: GlobePin[];
}

export interface PublicData {
  listTrips(): PublicTripCard[];
  getTrip(slug: string): PublicTrip | null;
  tripSlugs(): string[];
  listPlaces(): PublicPlaceCard[];
  getPlace(slug: string): PublicPlace | null;
  placeSlugs(): string[];
  globeIndex(): GlobeIndex;
  globePaths(): string[][];
  legacyPlaceRedirects(): { from: string; to: string }[];
}

// TRP (stage 4)

/** A day that crosses a time-zone line (the Rockies Day 6 at Mount Robson): the stops listed here read in local time, `offsetMin` from the trip's clock. */
export interface DayZone {
  /** Where the line is crossed: "Mount Robson". */
  place: string;
  /** "Pacific time", and its short form "PT". */
  label: string;
  abbr: string;
  /** The clock the rest of the day reads on: "Mountain time", "MT". */
  home: string;
  homeAbbr: string;
  offsetMin: number;
  /** Schedule item ids that sit on the far side of the line. */
  items: string[];
}

/** Declaration merge: the optional day marks TRP adds to PublicDay, so no other lane's lines change. */
export interface PublicDay {
  /** A time-zone line crossed during the day. Absent on most days. */
  zone?: DayZone;
  /** The day's last times depend on a flight whose time the plan does not know. */
  flight?: boolean;
}
