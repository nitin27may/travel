// Public data model. Everything here is plain JSON (no Map, Date, class or undefined): the static pages
// receive these values as props. Absent values are `null`.

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
  sources: ('locations' | 'prototype' | 'trail')[];
}

export interface PublicPlace extends PublicPlaceCard {
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
}

export interface Track {
  id: 'A' | 'B' | 'C';
  /** "Adults", "Whole family", "Easy day" */
  label: string;
  title: string;
  items: DayItem[];
  notes: string | null;
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
}

export interface PublicBase {
  id: string;
  name: string;
  nights: number;
  /** Day numbers the base covers. */
  days: number[];
  /** "stay not chosen yet" for the Dolomites. */
  stayStatus: string | null;
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
  /** The row's detail line, e.g. "4 nights · stay not chosen yet". */
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
}

export interface PublicTrip extends PublicTripCard {
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
}
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
