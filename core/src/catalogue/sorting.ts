// The `sort=` rule of every paged method (D-B5; review API1a-R-4). One comparator, written once, so JsonStore, StubStore and
// SupabaseStore order rows the same way:
//
//   1. each asked key in turn: its value from SORT_VALUES (never a raw field name; an unknown key is `invalid_input` at the schema);
//      numbers compare numerically, strings by sortKey() in code-point order; `-key` reverses that comparison;
//   2. a null value goes LAST in both directions (Postgres must write `NULLS LAST` for DESC too: its default is NULLS FIRST);
//   3. then sortKey(name) ascending, then `ref` ascending, in code-point order, whatever the direction of the asked keys.
//
// The values mirror the list descriptors' `sorts` (web/lib/entities/descriptors/place.tsx and trip.tsx), which API-2 moves into core.
// SupabaseStore stores one key per value below, computed by core at load, and sorts with `collate "C"`.
import { LENGTH_FILTERS } from "../derive/length.ts";
import type { PlaceRow, TripRow } from "../schema/api/index.ts";
import { compareCodePoints, sortKey } from "./sortKey.ts";

export type SortValue = number | string | null;

const COMPLETENESS_RANK: Record<string, number> = { draft: 0, usable: 1, complete: 2 };
const KID_RANK = ["yes", "strong-kid", "no", "unknown"];
const DEPTH_RANK: Record<string, number> = { full: 0, summary: 1, overview: 2 };

/** Places: the sort keys of the list descriptor, as values over a row. */
export const PLACE_SORT_VALUES = {
  name: (r: PlaceRow): SortValue => r.name,
  kind: (r: PlaceRow): SortValue => r.kindLabel,
  country: (r: PlaceRow): SortValue => r.country_name || null,
  region: (r: PlaceRow): SortValue => r.region_name || null,
  area: (r: PlaceRow): SortValue => r.area_name || null,
  season: (r: PlaceRow): SortValue => r.season[0] ?? null,
  kid: (r: PlaceRow): SortValue => KID_RANK.indexOf(r.kid_fit),
  elevation: (r: PlaceRow): SortValue => r.elevation_m,
  km: (r: PlaceRow): SortValue => r.km,
  gain: (r: PlaceRow): SortValue => r.gain_m,
  complete: (r: PlaceRow): SortValue => COMPLETENESS_RANK[r.completeness.level] ?? null,
  plan: (r: PlaceRow): SortValue => r.trips[0]?.title ?? null,
} as const;

/** Trips: the sort keys of the trip list descriptor. */
export const TRIP_SORT_VALUES = {
  title: (r: TripRow): SortValue => r.title,
  nights: (r: TripRow): SortValue => r.nights,
  length: (r: TripRow): SortValue => {
    const i = r.length ? (LENGTH_FILTERS as readonly string[]).indexOf(r.length) : -1;
    return i === -1 ? 99 : i;
  },
  depth: (r: TripRow): SortValue => DEPTH_RANK[r.depth] ?? null,
  country: (r: TripRow): SortValue => r.countryName || null,
} as const;

/** Compares two values under rule 1 and 2; `desc` reverses non-null comparisons only. */
export function compareValues(a: SortValue, b: SortValue, desc: boolean): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const c = typeof a === "number" && typeof b === "number" ? a - b : compareCodePoints(sortKey(String(a)), sortKey(String(b)));
  const sign = c < 0 ? -1 : c > 0 ? 1 : 0;
  return desc ? -sign : sign;
}

/**
 * Sorts rows by the asked keys, then by sortKey(name) and `ref` (rule 3). `nameOf` gives the name a row is tie-broken on (a trip's
 * title). Does not mutate the input.
 */
export function sortRows<R extends { ref: string }>(rows: readonly R[], specs: readonly string[], values: Record<string, (r: R) => SortValue>, nameOf: (r: R) => string): R[] {
  const keyed = rows.map((row) => ({ row, name: sortKey(nameOf(row)), vals: specs.map((s) => values[s.replace(/^-/, "")]!(row)) }));
  keyed.sort((a, b) => {
    for (let i = 0; i < specs.length; i++) {
      const c = compareValues(a.vals[i]!, b.vals[i]!, specs[i]!.startsWith("-"));
      if (c !== 0) return c;
    }
    return compareCodePoints(a.name, b.name) || compareCodePoints(a.row.ref, b.row.ref);
  });
  return keyed.map((k) => k.row);
}
