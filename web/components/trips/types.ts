/** One trip as the list pages (cards, list, table, map) see it. Plain JSON: it crosses from the server page to client components. */
export interface TripListRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
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
  legacyUrl: string;
  /** ISO 3166-1 alpha-2, upper case, or '' when unknown. */
  country: string;
  countryName: string;
  lat: number | null;
  lon: number | null;
  /** True when the pin is a country centre, not the first base. */
  approx: boolean;
  bases: number | null;
  driveAvgMin: number | null;
  ageFit: number | null;
  effort: string | null;
  firstBase: string | null;
}
