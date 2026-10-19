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
  // ---- derived tags (L3b): ids and labels only, never the plan (principle P8) ----
  /** Every country the plan visits, for the Where filter. */
  countries: { code: string; name: string }[];
  continents: string[];
  /** The Length filter value: day, overnight, weekend, long-weekend, 4-8, 9-14 or 15+. */
  length: string | null;
  /** Day, overnight, weekend, long-weekend or multi-day. */
  lengthClass: string | null;
  /** The Kids filter reads `ageFit` ("Kids from N"). */
  hike: 'easy' | 'moderate' | 'strenuous' | null;
  strollerDays: 'friendly' | { n: number; of: number } | null;
  activities: { id: string; label: string }[];
  /** Up to two anchors, by draw then by day. */
  highlights: string[];
  around: string[];
  perDay: string | null;
  perDayApprox: boolean;
  shape: string | null;
  /** One-way minutes from Toronto (the first public hub) to the first stop, or null while the hub matrix has no value. */
  fromHubMin: number | null;
  /** True when that figure is an estimate, not a routed time. */
  fromHubApprox: boolean;
}

/** Every key a trip list row may carry (principle P8, backlog 2.24): card and filter fields, never the plan itself. A test pins it. */
export const TRIP_LIST_KEYS: readonly (keyof TripListRow)[] = [
  'id', 'slug', 'title', 'depth', 'nights', 'days', 'seasonNotSet', 'isDone', 'region', 'cover', 'seasonLabel', 'seasonMonths',
  'country', 'countryName', 'lat', 'lon', 'approx', 'ageFit', 'effort', 'firstBase',
  'countries', 'continents', 'length', 'lengthClass', 'hike', 'strollerDays', 'activities', 'highlights', 'around', 'perDay', 'perDayApprox', 'shape', 'fromHubMin', 'fromHubApprox',
];
