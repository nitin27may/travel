import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { PlaceRow, PlaceSource, PlaceTag } from './types';
import { travelRoot } from './root';
import { loadTrips } from './trips';

interface Store {
  layout?: string;
  countries: { code: string; a3: string; name: string }[];
  regions: { id: string; country: string; code: string; name: string; iso_3166_2?: string }[];
  areas: { id: string; region_id: string; slug: string; name: string }[];
  places: StorePlace[];
  tags: { id: string; label: string; alias_of: string | null }[];
  place_tags: { place_id: string; tag_id: string }[];
  sources: { id: string; place_id: string | null; type: string; url: string | null; post_date: string | null }[];
  visits: { place_id: string; trip?: string | null }[];
}

interface StorePlace {
  id: string;
  area_id: string;
  name: string;
  kind: string;
  status: string;
  trip?: string | null;
  lat?: number | null;
  lon?: number | null;
  elevation_m?: number | null;
  location_status: string;
  wikidata?: string | null;
  image?: string | null;
  season_months?: number[];
  kid_fit?: string;
  stats?: Record<string, string | number>;
  stats_verified?: boolean;
  notes?: string;
  added?: string;
}

/** Only these stat keys are ever published; anything else in `stats` is dropped. */
export const PUBLIC_STAT_KEYS = ['km', 'gain_m', 'hours', 'minutes', 'level', 'miles'] as const;

export function readStore(root = travelRoot()): Store {
  const file = path.join(root, 'data', 'locations', 'locations.json');
  const store = JSON.parse(readFileSync(file, 'utf8')) as Store;
  if (store.layout && store.layout !== 'single') {
    throw new Error(`locations layout "${store.layout}" is not supported by the web build yet`);
  }
  return store;
}

/** The place store joined into flat rows, sorted by country, region, area and name. */
export function loadPlaces(root = travelRoot()): PlaceRow[] {
  const store = readStore(root);
  const tripInfo = new Map(loadTrips(root).filter((t) => t.visibility === 'public' && t.href).map((t) => [t.slug, t]));
  const countries = new Map(store.countries.map((c) => [c.code, c]));
  const regions = new Map(store.regions.map((r) => [r.id, r]));
  const areas = new Map(store.areas.map((a) => [a.id, a]));
  const tagLabel = new Map(store.tags.map((t) => [t.id, t]));
  const tagsOf = new Map<string, PlaceTag[]>();
  for (const pt of store.place_tags) {
    const tag = tagLabel.get(pt.tag_id);
    const id = tag?.alias_of ?? pt.tag_id;
    const label = tagLabel.get(id)?.label ?? pt.tag_id;
    const list = tagsOf.get(pt.place_id) ?? [];
    if (!list.some((t) => t.id === id)) list.push({ id, label });
    tagsOf.set(pt.place_id, list);
  }
  const sourcesOf = new Map<string, PlaceSource[]>();
  for (const s of store.sources) {
    if (!s.place_id) continue;
    const list = sourcesOf.get(s.place_id) ?? [];
    list.push({ type: s.type, url: s.url ?? null, post_date: s.post_date ?? null });
    sourcesOf.set(s.place_id, list);
  }
  const tripsOf = new Map<string, Set<string>>();
  const addTrip = (placeId: string, slug?: string | null) => {
    if (!slug || !tripInfo.has(slug)) return; // a trip that is not public is never counted or named
    const set = tripsOf.get(placeId) ?? new Set<string>();
    set.add(slug);
    tripsOf.set(placeId, set);
  };
  for (const p of store.places) addTrip(p.id, p.trip);
  for (const v of store.visits) addTrip(v.place_id, v.trip);

  const rows: PlaceRow[] = store.places.map((p) => {
    const area = areas.get(p.area_id);
    const region = area ? regions.get(area.region_id) : undefined;
    const country = region ? countries.get(region.country) : undefined;
    if (!area || !region || !country) throw new Error(`place ${p.id} has a broken area/region/country chain`);
    const stats: Record<string, string | number> = {};
    for (const key of PUBLIC_STAT_KEYS) {
      const v = p.stats?.[key];
      if (v !== undefined && v !== null) stats[key] = v;
    }
    return {
      id: p.id,
      name: p.name,
      kind: p.kind,
      status: p.status,
      country: country.code,
      country_name: country.name,
      country_a3: country.a3,
      region: region.code,
      region_name: region.name,
      region_iso: region.iso_3166_2 ?? `${country.code}-${region.code}`,
      area: area.slug,
      area_name: area.name,
      lat: p.lat ?? null,
      lon: p.lon ?? null,
      elevation_m: p.elevation_m ?? null,
      season: [...(p.season_months ?? [])].sort((a, b) => a - b),
      kid_fit: p.kid_fit ?? 'unknown',
      tags: (tagsOf.get(p.id) ?? []).sort((a, b) => a.label.localeCompare(b.label)),
      note: p.notes ?? '',
      image: p.image && /^https:\/\//.test(p.image) ? p.image : null,
      trip: p.trip && tripInfo.has(p.trip) ? p.trip : null,
      trip_title: p.trip ? (tripInfo.get(p.trip)?.title ?? null) : null,
      trip_url: p.trip ? (tripInfo.get(p.trip)?.href ?? null) : null,
      plans: tripsOf.get(p.id)?.size ?? 0,
      stats,
      stats_verified: Boolean(p.stats_verified),
      location_status: p.location_status,
      wikidata: p.wikidata ?? null,
      sources: sourcesOf.get(p.id) ?? [],
      added: p.added ?? '',
    };
  });
  rows.sort(
    (a, b) =>
      a.country_name.localeCompare(b.country_name) ||
      a.region_name.localeCompare(b.region_name) ||
      a.area_name.localeCompare(b.area_name) ||
      a.name.localeCompare(b.name),
  );
  return rows;
}

export { placeHref, placeSegments } from './paths';
