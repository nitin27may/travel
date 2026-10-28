// Where the add picker's places come from (STEP2-E3; P8, P9): light Places list rows, one page at a time, from the catalogue's HTTP
// contract. Three reads, none of them bulk: the places inside a box round a day's base (`near`; the near API answers `not_available` until
// N2, so the list's `bbox` stands in and is filtered to the circle here), a search page, and the rows of a few named slugs. A build with
// the static adapter has no API: every read answers null and the picker falls back to the lists the trip's own plan model carries.
// This is the one file to point at `DataClient` (`nearPlaces`, `placeRows`) when lib/client grows them.
import { ADD_NEARBY_KM } from '@travel/core/config/nearby.ts';
import type { Point } from '@travel/core/schedule/types.ts';
import { PAGE_SIZE } from '@/lib/config/product';
import { bboxAround, isStop, kmBetween, type Found } from './place';

const PLACES = '/api/v1/places/';
/** The most slugs one `ids` read takes (core API_LIMITS.query.ids; a literal here so no API schema code loads with the picker). */
const IDS_MAX = 100;

export interface Page {
  rows: Found[];
  /** the next page of the same read, or null */
  next: number | null;
}

/** An API row's fields the picker reads. */
interface ApiRow {
  slug: string;
  name: string;
  kind: string;
  kindLabel: string;
  lat: number | null;
  lon: number | null;
  km: number | null;
  gain_m: number | null;
  area_name: string;
  kid_fit: string;
  kids_from: number | null;
  flags: string[];
  season: number[];
}
export const foundOf = (r: ApiRow): Found => ({
  slug: r.slug, name: r.name, kind: r.kind, kindLabel: r.kindLabel, lat: r.lat, lon: r.lon, km: r.km, gainM: r.gain_m, area: r.area_name, kidFit: r.kid_fit, kidsFrom: r.kids_from ?? null,
  flags: r.flags, season: r.season,
});

export const apiAvailable = (): boolean => process.env.NEXT_PUBLIC_DATA_ADAPTER !== 'static';

async function read(params: Record<string, string>, signal?: AbortSignal): Promise<{ items: ApiRow[]; nextPage: number | null } | null> {
  if (!apiAvailable()) return null;
  try {
    const res = await fetch(`${PLACES}?${new URLSearchParams(params)}`, { signal });
    if (!res.ok) return null;
    return (await res.json()) as { items: ApiRow[]; nextPage: number | null };
  } catch {
    return null;
  }
}

/** One page of the places within `km` of `centre`, nearest first within the page. Rows outside the circle (the box is wider) are dropped. */
export async function nearPage(centre: Point, page: number, signal?: AbortSignal, km: number = ADD_NEARBY_KM): Promise<Page | null> {
  const got = await read({ bbox: bboxAround(centre, km), pageSize: String(PAGE_SIZE.list), page: String(page) }, signal);
  if (!got) return null;
  const rows = got.items
    .map(foundOf)
    .filter((f) => isStop(f) && f.lat !== null && f.lon !== null && kmBetween(centre, { lat: f.lat, lon: f.lon }) <= km)
    .sort((a, b) => kmBetween(centre, { lat: a.lat!, lon: a.lon! }) - kmBetween(centre, { lat: b.lat!, lon: b.lon! }) || a.slug.localeCompare(b.slug));
  return { rows, next: got.nextPage };
}

/** One page of the catalogue's places matching the words, all of them (a stop may be anywhere); the caller orders them by the day's base. */
export async function searchPage(q: string, page: number, signal?: AbortSignal): Promise<Page | null> {
  const got = await read({ q, pageSize: String(PAGE_SIZE.list), page: String(page) }, signal);
  return got ? { rows: got.items.map(foundOf).filter(isStop), next: got.nextPage } : null;
}

/** The rows of these slugs (a park's page, a Maybe place, a place added in an earlier visit), one read per 100. Unknown slugs are left out; null when the read failed. */
export async function rowsOf(slugs: readonly string[], signal?: AbortSignal): Promise<Found[] | null> {
  const out: Found[] = [];
  for (let i = 0; i < slugs.length; i += IDS_MAX) {
    const got = await read({ ids: slugs.slice(i, i + IDS_MAX).join(','), pageSize: String(Math.min(IDS_MAX, PAGE_SIZE.list * 2)) }, signal);
    if (!got) return null;
    out.push(...got.items.map(foundOf));
  }
  return out;
}

/** One row by slug, any kind (a park too): null when the catalogue does not hold it or the read failed. */
export async function oneRow(slug: string, signal?: AbortSignal): Promise<{ found: Found | null; failed: boolean }> {
  const rows = await rowsOf([slug], signal);
  return { found: rows?.[0] ?? null, failed: rows === null };
}

/**
 * Where "Start a new trip with ..." goes, or null while the planner is not open (the link is not drawn then, gap-analysis 2.4). The name of
 * the build flag is the planner's (`planBuilder`); it is written out so a Next build inlines it.
 */
export const newTripHref = (slug: string): string | null => (process.env.NEXT_PUBLIC_PLAN_BUILDER === '1' ? `/plan/?p=${encodeURIComponent(slug)}` : null);
