/** One trip as the list pages (cards, list, table, map) see it. Plain JSON: it crosses from the server page to client components. */
export interface TripListRow {
  id: string;
  slug: string;
  title: string;
  depth: 'full' | 'summary' | 'overview';
  nights: number | null;
  days: number | null;
  seasonNotSet: boolean;
  isDone: boolean;
  region: string;
  cover: string | null;
  seasonLabel: string | null;
  /** 1 to 12 */
  seasonMonths: number[];
  /** ISO 3166-1 alpha-2, upper case, or '' when unknown. */
  country: string;
  countryName: string;
  lat: number | null;
  lon: number | null;
  /** True when the pin is a country centre, not the first base. */
  approx: boolean;
  ageFit: number | null;
  effort: string | null;
  firstBase: string | null;
}

/** Every key a trip list row may carry (principle P8, backlog 2.24): card and filter fields, never the plan itself. A test pins it. */
export const TRIP_LIST_KEYS: readonly (keyof TripListRow)[] = [
  'id', 'slug', 'title', 'depth', 'nights', 'days', 'seasonNotSet', 'isDone', 'region', 'cover', 'seasonLabel', 'seasonMonths',
  'country', 'countryName', 'lat', 'lon', 'approx', 'ageFit', 'effort', 'firstBase',
];
