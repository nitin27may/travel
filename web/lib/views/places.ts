import type { PlaceRow, TripRow } from '@/lib/data/types';

/**
 * What /data/places.json may contain. This is an allow-list: a field that is not named here is never
 * written, whatever the loader reads. `status` is household data and must never be added. Add a field here on purpose, with a reason.
 */
export const PLACE_VIEW_FIELDS = [
  'id', 'name', 'kind', 'country', 'country_name', 'country_a3', 'region', 'region_name', 'region_iso', 'area', 'area_name',
  'lat', 'lon', 'elevation_m', 'season', 'kid_fit', 'tags', 'note', 'image', 'trip', 'trip_title', 'trip_url', 'plans', 'stats',
  'stats_verified', 'location_status', 'wikidata', 'sources', 'added',
] as const satisfies readonly (keyof PlaceRow)[];

export const TRIP_VIEW_FIELDS = ['id', 'slug', 'title', 'subtitle', 'img', 'date', 'dates', 'duration', 'region', 'source', 'href'] as const satisfies readonly (keyof TripRow)[];

function pick<T extends object, K extends keyof T>(row: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) out[k] = row[k];
  return out;
}

export function placeView(row: PlaceRow): Pick<PlaceRow, (typeof PLACE_VIEW_FIELDS)[number]> {
  const v = pick(row, PLACE_VIEW_FIELDS);
  return {
    ...v,
    tags: row.tags.map((t) => ({ id: t.id, label: t.label, kind: t.kind })),
    sources: row.sources.map((s) => ({ type: s.type, url: s.url, post_date: s.post_date })),
  };
}

export function tripView(row: TripRow): Pick<TripRow, (typeof TRIP_VIEW_FIELDS)[number]> {
  return pick(row, TRIP_VIEW_FIELDS);
}

export interface EntityViewDoc<T> {
  schema: 'entity-view/1';
  generated: string;
  rows: T[];
}

export function entityView<T>(rows: T[], generated: string): EntityViewDoc<T> {
  return { schema: 'entity-view/1', generated, rows };
}
