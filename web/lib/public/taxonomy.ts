import type { Category, PlaceKind } from './types';

export const CATEGORY_OF_KIND: Record<PlaceKind, Category> = {
  trail: 'trails',
  lake: 'sights',
  viewpoint: 'sights',
  waterfall: 'sights',
  sight: 'sights',
  town: 'sights',
  area: 'sights',
  activity: 'activities',
  lift: 'activities',
  stay: 'stays',
  eatery: 'food',
};

export interface KindMap {
  kind: PlaceKind;
  subkind: string | null;
}

/** locations.json kinds (README 2.4). */
const LOCATION_KINDS: Record<string, KindMap> = {
  city: { kind: 'town', subkind: 'city' },
  town: { kind: 'town', subkind: 'town' },
  park: { kind: 'area', subkind: 'park' },
  region: { kind: 'area', subkind: 'region' },
  valley: { kind: 'area', subkind: 'valley' },
  island: { kind: 'area', subkind: 'island' },
  mountain: { kind: 'viewpoint', subkind: 'summit' },
  lighthouse: { kind: 'sight', subkind: 'landmark' },
  place: { kind: 'sight', subkind: 'landmark' },
  drive: { kind: 'sight', subkind: 'scenic_drive' },
  canyon: { kind: 'waterfall', subkind: 'canyon' },
  waterfall: { kind: 'waterfall', subkind: 'waterfall' },
  trail: { kind: 'trail', subkind: 'hike' },
  lake: { kind: 'lake', subkind: 'lake' },
  viewpoint: { kind: 'viewpoint', subkind: 'viewpoint' },
  activity: { kind: 'activity', subkind: null },
};

/** prototype place kinds. airport, parking and the example stays are not places (null). */
const PROTOTYPE_KINDS: Record<string, KindMap | null> = {
  town: { kind: 'town', subkind: 'town' },
  lake: { kind: 'lake', subkind: 'lake' },
  trail: { kind: 'trail', subkind: 'hike' },
  viewpoint: { kind: 'viewpoint', subkind: 'viewpoint' },
  lift: { kind: 'lift', subkind: 'cable_car' },
  // no bed count in the data: a hut is a lunch stop (eatery / hut_kitchen) until beds are recorded
  hut: { kind: 'eatery', subkind: 'hut_kitchen' },
  activity: { kind: 'activity', subkind: null },
  pass: { kind: 'viewpoint', subkind: 'pullout' },
  sight: { kind: 'sight', subkind: 'landmark' },
  airport: null,
  parking: null,
  stay: null,
};

export function mapLocationKind(kind: string): KindMap {
  return LOCATION_KINDS[kind] ?? { kind: 'sight', subkind: null };
}
export function mapPrototypeKind(kind: string): KindMap | null {
  return kind in PROTOTYPE_KINDS ? PROTOTYPE_KINDS[kind] : { kind: 'sight', subkind: null };
}

/** public-trips stop kinds -> item kind (README 2.4). `drive` is a leg and `airport` a Logistics row. */
export const STOP_KINDS: Record<string, { kind: DayItemKind; subkind: string | null } | null> = {
  hike: { kind: 'trail', subkind: 'hike' },
  view: { kind: 'viewpoint', subkind: 'viewpoint' },
  lift: { kind: 'lift', subkind: 'cable_car' },
  town: { kind: 'town', subkind: 'town' },
  food: { kind: 'eatery', subkind: 'restaurant' },
  stay: { kind: 'stay', subkind: null },
  sight: { kind: 'sight', subkind: 'landmark' },
  water: { kind: 'lake', subkind: 'lake' },
  activity: { kind: 'activity', subkind: null },
  airport: { kind: 'airport', subkind: null },
  drive: null,
};
export type DayItemKind = PlaceKind | 'airport' | 'parking' | 'booking';

export function categoryOf(kind: DayItemKind): Category | null {
  if (kind === 'airport' || kind === 'booking') return 'logistics';
  if (kind === 'parking') return null;
  return CATEGORY_OF_KIND[kind];
}

export function kindLabel(kind: PlaceKind, subkind: string | null): string {
  if (kind === 'area') return 'Area';
  if (subkind === 'scenic_drive') return 'Scenic drive';
  if (subkind === 'hut_kitchen') return 'Hut';
  if (kind === 'lift') return 'Lift';
  if (kind === 'eatery') return 'Eatery';
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

/** Prototype area strings -> IT > state > district. Written out; no geocoding. */
export const PROTOTYPE_AREAS: Record<string, { state: string; stateSlug: string }> = {
  Venice: { state: 'Veneto', stateSlug: 'veneto' },
  Ampezzo: { state: 'Veneto', stateSlug: 'veneto' },
  Cadore: { state: 'Veneto', stateSlug: 'veneto' },
  Auronzo: { state: 'Veneto', stateSlug: 'veneto' },
  Misurina: { state: 'Veneto', stateSlug: 'veneto' },
  Falzarego: { state: 'Veneto', stateSlug: 'veneto' },
  'Alta Pusteria': { state: 'South Tyrol', stateSlug: 'south-tyrol' },
  'Val Pusteria': { state: 'South Tyrol', stateSlug: 'south-tyrol' },
  Braies: { state: 'South Tyrol', stateSlug: 'south-tyrol' },
  Sesto: { state: 'South Tyrol', stateSlug: 'south-tyrol' },
  'Val Gardena': { state: 'South Tyrol', stateSlug: 'south-tyrol' },
  Bolzano: { state: 'South Tyrol', stateSlug: 'south-tyrol' },
  'Alta Badia': { state: 'South Tyrol', stateSlug: 'south-tyrol' },
  'Alpe di Siusi': { state: 'South Tyrol', stateSlug: 'south-tyrol' },
  'Val di Funes': { state: 'South Tyrol', stateSlug: 'south-tyrol' },
  "Val d'Ega": { state: 'South Tyrol', stateSlug: 'south-tyrol' },
  Sella: { state: 'Trentino', stateSlug: 'trentino' },
};

/** Country (ISO 3166-1 alpha-2, lower case) -> continent, for the globe index. */
export const CONTINENT_OF: Record<string, string> = {
  ca: 'North America', us: 'North America', mx: 'North America', cr: 'North America', pa: 'North America',
  ar: 'South America', br: 'South America', cl: 'South America', pe: 'South America', co: 'South America',
  it: 'Europe', fr: 'Europe', ch: 'Europe', is: 'Europe', no: 'Europe', es: 'Europe', pt: 'Europe', de: 'Europe',
  at: 'Europe', gb: 'Europe', ie: 'Europe', gr: 'Europe', se: 'Europe', fi: 'Europe', hr: 'Europe', si: 'Europe',
  cn: 'Asia', in: 'Asia', vn: 'Asia', jp: 'Asia', th: 'Asia', id: 'Asia', np: 'Asia',
  ke: 'Africa', ma: 'Africa', za: 'Africa', tz: 'Africa',
  au: 'Oceania', nz: 'Oceania',
};
