import type { FavItem } from '@travel/core/schema/favourites.ts';
import { handleOf } from '@travel/core/favourites/envelope.ts';
import { kindLabel } from '@/lib/public/taxonomy';
import type { PlaceKind } from '@/lib/public/types';

/**
 * The Favourites tab's list model (mine-and-bar-spec 5.3), pure: scope, Kind and Country filters, sort, pages of 48. It runs over the
 * visitor's own list of at most 500 rows, in the browser (their data, not a catalogue bulk load: P9).
 */
export const PAGE_SIZE = 48;

export type Scope = 'all' | 'place' | 'trip';
export type Sort = 'newest' | 'name';

export interface Filters {
  scope: Scope;
  kinds: string[];
  countries: string[];
  sort: Sort;
}

export const NO_FILTERS: Filters = { scope: 'all', kinds: [], countries: [], sort: 'newest' };

const regions = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();

/** "Canada" for CA; the code itself when the browser cannot name it. */
export const countryName = (cc: string): string => {
  try {
    return regions?.of(cc) ?? cc;
  } catch {
    return cc;
  }
};

/** The name a row shows: the snapshot, or the slug in words until the first resolve fills it. */
export const rowName = (i: Pick<FavItem, 'name' | 'slug'>): string => i.name ?? i.slug.replace(/-/g, ' ').replace(/^./, (s) => s.toUpperCase());

/** "Lake · Canada", "Trip · Italy"; a place with no kind yet reads "Place". */
export function rowMeta(i: Pick<FavItem, 'space' | 'kind' | 'cc'>): string {
  const what = i.space === 'trip' ? 'Trip' : i.kind ? kindLabel(i.kind as PlaceKind, null) : 'Place';
  return [what, i.cc ? countryName(i.cc) : null].filter(Boolean).join(' · ');
}

export const hrefOf = (i: Pick<FavItem, 'space' | 'slug'>): string => `/${i.space === 'trip' ? 'trips' : 'places'}/${i.slug}/`;

export function counts(items: readonly FavItem[]): Record<Scope, number> {
  let place = 0;
  for (const i of items) if (i.space === 'place') place++;
  return { all: items.length, place, trip: items.length - place };
}

const inScope = (i: FavItem, s: Scope): boolean => s === 'all' || i.space === s;

/** The options of the Kind pill: kinds of the places in scope, with counts. Hidden when only trips are in scope. */
export function kindOptions(items: readonly FavItem[], scope: Scope): { value: string; label: string; count: number }[] {
  const n = new Map<string, number>();
  for (const i of items) if (i.space === 'place' && i.kind && inScope(i, scope)) n.set(i.kind, (n.get(i.kind) ?? 0) + 1);
  return [...n].map(([value, count]) => ({ value, label: kindLabel(value as PlaceKind, null), count })).sort((a, b) => a.label.localeCompare(b.label));
}

export function countryOptions(items: readonly FavItem[], scope: Scope): { value: string; label: string; count: number }[] {
  const n = new Map<string, number>();
  for (const i of items) if (i.cc && inScope(i, scope)) n.set(i.cc, (n.get(i.cc) ?? 0) + 1);
  return [...n].map(([value, count]) => ({ value, label: countryName(value), count })).sort((a, b) => a.label.localeCompare(b.label));
}

/** The rows to show, filtered and sorted. Newest keeps the list's own order (it is newest first); Name is A to Z. */
export function view(items: readonly FavItem[], f: Filters): FavItem[] {
  const out = items.filter(
    (i) => inScope(i, f.scope) && (f.kinds.length === 0 || (i.space === 'place' && !!i.kind && f.kinds.includes(i.kind))) && (f.countries.length === 0 || (!!i.cc && f.countries.includes(i.cc))),
  );
  if (f.sort === 'name') out.sort((a, b) => rowName(a).localeCompare(rowName(b), 'en', { sensitivity: 'base' }) || handleOf(a).localeCompare(handleOf(b)));
  return out;
}

/** The page's rows; the page number is clamped into range. */
export function pageOf<T>(rows: readonly T[], page: number): { page: number; pages: number; rows: T[] } {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { page: p, pages, rows: rows.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE) };
}

/** `?page=` as the URL holds it: a positive integer, else 1. */
export const parsePage = (v: string | null): number => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? n : 1;
};

/** How many filters are active (Kind and Country values, and a non-default sort), for "Filters (n)" on a phone. */
export const activeCount = (f: Filters): number => f.kinds.length + f.countries.length + (f.sort === 'newest' ? 0 : 1);
