import type { Visibility } from '../visibility';

/** The status of a place, in the order the UI shows it. */
export const PLACE_STATUSES = ['idea', 'shortlisted', 'planned', 'visited', 'dropped'] as const;
export type PlaceStatus = (typeof PLACE_STATUSES)[number];

export interface PlaceTag {
  id: string;
  label: string;
  /** From the shared vocabulary: style, activity, feature, audience or free. */
  kind: string;
}

export interface PlaceSource {
  type: string;
  url: string | null;
  post_date: string | null;
}

/**
 * One place as the app and /data/places.json see it: the store joined with its area, region,
 * country and tags. Every key here is on the allow-list in lib/views/places.ts.
 */
export interface PlaceRow {
  id: string;
  name: string;
  kind: string;
  status: PlaceStatus | string;
  country: string;
  country_name: string;
  country_a3: string;
  region: string;
  region_name: string;
  region_iso: string;
  area: string;
  area_name: string;
  lat: number | null;
  lon: number | null;
  elevation_m: number | null;
  season: number[];
  kid_fit: string;
  tags: PlaceTag[];
  note: string;
  image: string | null;
  trip: string | null;
  trip_title: string | null;
  trip_url: string | null;
  plans: number;
  stats: Record<string, string | number>;
  stats_verified: boolean;
  location_status: string;
  wikidata: string | null;
  sources: PlaceSource[];
  added: string;
}

export interface TripRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  img: string | null;
  /** ISO start date, or '' when unknown. */
  date: string;
  dates: string;
  duration: string;
  region: string;
  /** 'plan' = a data/trips trip, 'legacy' = a page from legacy/ with no data file yet. */
  source: 'plan' | 'legacy';
  href: string;
  /** Relative to the build date: past, today, soon, later, unknown. */
  when: 'past' | 'today' | 'soon' | 'later' | 'unknown';
  badge: string;
}

export interface TripRecord extends TripRow {
  visibility: Visibility;
}
