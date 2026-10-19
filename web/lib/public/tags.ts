// Trip tags, all derived (suitability 6.3, relevance 6.3, capture contract 7): where, length, season, kids from N, hike effort,
// stroller days, activities, highlights, getting around, driving per day and shape. None is typed by hand. One pure function per
// tag; `buildTripTags` calls them for a trip. An overview trip gets Where, Length and When only (no fake zeros).
import { lengthFilter } from '@travel/core/derive/length.ts';
import type { LengthFilter } from '@travel/core/derive/length.ts';
import { strollerOkOf } from '@travel/core/suitability/derive.ts';
import type { World } from '@travel/core/capture/records.ts';
import { derivedItems } from './world';
import { normName } from './places';
import { CONTINENT_OF } from './taxonomy';
import { TRIP_COUNTRY } from './globe';
import type { CategoryItem, PublicDay, PublicPlace, PublicTrip } from './types';

export type HikeEffort = 'easy' | 'moderate' | 'strenuous';
export type Around = 'rental-car' | 'camper-van' | 'train' | 'tours';
export type PerDay = 'u1' | '1-2' | '2-3' | '3+';
export type Shape = 'one-base' | 'road-trip';
export type StrollerDays = { all: true } | { all: false; n: number; of: number };

export interface TagRef {
  id: string;
  label: string;
}

/** Everything a trip card and the Trips filters know about the plan. Derived at build time; a field the plan cannot answer is null or empty. */
export interface TripTags {
  /** Lower-case ISO alpha-2 codes of every country the plan visits. */
  countries: string[];
  continents: string[];
  length: LengthFilter | null;
  /** 1 to 12 */
  when: number[];
  kidsFrom: number | null;
  hike: HikeEffort | null;
  stroller: StrollerDays | null;
  activities: TagRef[];
  /** Up to two anchors, by draw then by day. */
  highlights: string[];
  around: Around[];
  perDay: PerDay | null;
  perDayApprox: boolean;
  shape: Shape | null;
}

export const AROUND_LABELS: Record<Around, string> = { 'rental-car': 'Rental car', 'camper-van': 'Camper van', train: 'Train', tours: 'Tours' };
export const PER_DAY_LABELS: Record<PerDay, string> = { u1: 'Under 1 h', '1-2': '1 to 2 h', '2-3': '2 to 3 h', '3+': '3 h and more' };
export const HIKE_LABELS: Record<HikeEffort, string> = { easy: 'Easy', moderate: 'Moderate', strenuous: 'Strenuous' };
export const SHAPE_LABELS: Record<Shape, string> = { 'one-base': 'One base', 'road-trip': 'Road trip' };

// ------------------------------------------------------------------ where

export function whereTag(trip: Pick<PublicTrip, 'days' | 'categories'>, folder: string, placeBySlug: ReadonlyMap<string, PublicPlace>): { countries: string[]; continents: string[] } {
  const cc = new Set<string>();
  const main = TRIP_COUNTRY[folder]?.cc;
  if (main) cc.add(main);
  const items = [...Object.values(trip.categories).flat(), ...trip.days.flatMap((d) => d.items)];
  for (const it of items) {
    const p = it.placeSlug ? placeBySlug.get(it.placeSlug) : undefined;
    const c = p?.areaChain.find((a) => a.level === 'country')?.slug;
    if (c) cc.add(c.toLowerCase());
  }
  const countries = [...cc].sort();
  const continents = [...new Set(countries.map((c) => CONTINENT_OF[c]).filter((c): c is string => Boolean(c)))].sort();
  return { countries, continents };
}

// ------------------------------------------------------------------ length

export const lengthTag = (nights: number | null): LengthFilter | null => (nights === null ? null : lengthFilter(nights));

// ------------------------------------------------------------------ hike effort

/** The plan's own word (easy, moderate, hard) as the three tag values: Stroll and Easy are easy, Moderate is moderate, Hard and Technical are strenuous. */
export function hikeTag(effort: string | null): HikeEffort | null {
  switch (effort) {
    case 'easy':
    case 'stroll':
      return 'easy';
    case 'moderate':
      return 'moderate';
    case 'hard':
    case 'strenuous':
    case 'technical':
      return 'strenuous';
    default:
      return null;
  }
}

// ------------------------------------------------------------------ stroller days

/**
 * "Stroller-friendly" when every day's easiest variant has no walking item with stroller `no`; else "Some stroller days (n of N)".
 * A gap never passes: a walking item with no stroller value fails its day. Null when no day passes (a count of zero says nothing).
 * `strollerOf` returns yes, partly, no, or null for a gap.
 */
export function strollerTag(days: readonly PublicDay[], strollerOf: (item: CategoryItemLike) => 'yes' | 'partly' | 'no' | null): StrollerDays | null {
  if (!days.length) return null;
  let pass = 0;
  for (const d of days) {
    // the easiest variant of a day is its last track (A adults, B family, C easy); a day with no tracks has one variant
    const items = d.tracks?.length ? d.tracks[d.tracks.length - 1]!.items : d.items;
    const walking = items.filter((i) => i.category === 'trails' && i.foldedInto === null);
    if (walking.every((i) => strollerOf(i) !== null && strollerOf(i) !== 'no')) pass += 1;
  }
  if (pass === days.length) return { all: true };
  return pass > 0 ? { all: false, n: pass, of: days.length } : null;
}
export type CategoryItemLike = { name: string; placeSlug: string | null };

// ------------------------------------------------------------------ activities and highlights

/** Capture type (any depth) to tags.json ids. First match wins; the ids are canonical (lake, not lakes). */
const ACTIVITY_OF_TYPE: [string, string][] = [
  ['water.body', 'lake'],
  ['water.falls', 'waterfall'],
  ['water.swim.beach', 'beach'],
  ['water.thermal', 'hot-springs'],
  ['water.paddle', 'kayaking'],
  ['water.river.rafting', 'rafting'],
  ['nature.landform.gorge', 'gorge'],
  ['nature.landform.canyon', 'canyon'],
  ['mountain.canyon', 'canyon'],
  ['mountain.ferrata', 'via-ferrata'],
  ['mountain.alpine.glacier_walk', 'glaciers'],
  ['nature.wildlife', 'wildlife'],
  ['animals.see', 'wildlife'],
  ['nature.viewpoint', 'viewpoint'],
  ['nature.summit', 'viewpoint'],
  ['nature.trail', 'hiking'],
  ['nature.trek', 'trekking'],
  ['nature.protected.national_park', 'national-park'],
  ['wheels.drive.scenic_drive', 'scenic-drive'],
  ['ride.rail', 'railway'],
  ['culture.heritage.historic_site', 'history'],
  ['culture.heritage.castle_fort', 'history'],
  ['culture.museum', 'culture'],
];
const GLACIER_NAME = /\b(glaciers?|icefield)\b/i;

export function activityIdsOf(type: string, name: string): string[] {
  const ids: string[] = [];
  if (GLACIER_NAME.test(name)) ids.push('glaciers');
  const hit = ACTIVITY_OF_TYPE.find(([prefix]) => type === prefix || type.startsWith(`${prefix}.`));
  if (hit) ids.push(hit[1]);
  return ids;
}

const DRAW_RANK: Record<string, number> = { world: 0, national: 1, regional: 2, local: 3 };
const shortName = (n: string): string => n.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

export interface PickedItem {
  name: string;
  type: string;
  draw: number;
  day: number;
  anchor: boolean;
}

/** The trip's anchors and highlights with their type, draw and first day. Fillers and local-only items never appear. */
export function pickedItems(root: string, world: World, slug: string, dayOf: (name: string) => number | null): PickedItem[] {
  const out: PickedItem[] = [];
  for (const it of derivedItems(root, slug)) {
    if (it.role !== 'anchor' && it.role !== 'highlight') continue;
    const cap = world.cap.get(it.ref)?.rec;
    if (!cap?.name) continue;
    const name = shortName(cap.name);
    out.push({ name, type: cap.type, draw: DRAW_RANK[it.effective_draw] ?? 4, day: dayOf(name) ?? 999, anchor: it.role === 'anchor' });
  }
  return out;
}

/** Highlights: up to two anchors, by effective draw then by day. A name that repeats another (the route and its payoff) counts once. */
export function highlightsTag(picks: readonly PickedItem[]): string[] {
  const anchors = picks.filter((p) => p.anchor).sort((a, b) => a.draw - b.draw || a.day - b.day || a.name.localeCompare(b.name));
  const out: string[] = [];
  for (const p of anchors) {
    const n = normName(p.name);
    if (out.some((o) => normName(o).includes(n) || n.includes(normName(o)))) continue;
    out.push(p.name);
    if (out.length === 2) break;
  }
  return out;
}

/** Activity tags: from anchors and highlights only. A filler's class adds nothing (relevance 6.3). */
export function activitiesTag(picks: readonly PickedItem[], labelOf: (id: string) => string | null): TagRef[] {
  const ids = new Set<string>();
  for (const p of picks) for (const id of activityIdsOf(p.type, p.name)) ids.add(id);
  return [...ids]
    .map((id) => ({ id, label: labelOf(id) }))
    .filter((t): t is TagRef => t.label !== null)
    .sort((a, b) => a.label.localeCompare(b.label));
}

// ------------------------------------------------------------------ getting around, driving, shape

export function aroundTag(logistics: readonly Pick<CategoryItem, 'name' | 'kind'>[]): Around[] {
  const out = new Set<Around>();
  for (const l of logistics) {
    const text = `${l.kind} ${l.name}`;
    if (/camper|motorhome|campervan|\bvan\b/i.test(text)) out.add('camper-van');
    else if (/\bcar\b|car hire|car rental|rental car|rent a car/i.test(text)) out.add('rental-car');
    if (/\btrain\b|railway|\brail\b|rack/i.test(text) && !/\btrailhead\b/i.test(text)) out.add('train');
    if (/\btours?\b|guided|excursion/i.test(text)) out.add('tours');
  }
  return [...out].sort();
}

export function perDayTag(days: readonly Pick<PublicDay, 'driveMin' | 'driveIsEstimate'>[]): { band: PerDay | null; approx: boolean } {
  const drives = days.filter((d) => d.driveMin !== null && d.driveMin > 0);
  if (!drives.length) return { band: null, approx: false };
  const avg = drives.reduce((n, d) => n + (d.driveMin as number), 0) / drives.length;
  return { band: avg < 60 ? 'u1' : avg < 120 ? '1-2' : avg < 180 ? '2-3' : '3+', approx: drives.some((d) => d.driveIsEstimate) };
}

/** One base, or a road trip (three or more bases). Two bases are neither. */
export const shapeTag = (bases: number): Shape | null => (bases === 1 ? 'one-base' : bases >= 3 ? 'road-trip' : null);

// ------------------------------------------------------------------ the whole set

export interface TagContext {
  root: string;
  world: World;
  /** legacy folder of the trip */
  folder: string;
  placeBySlug: ReadonlyMap<string, PublicPlace>;
  /** place slug -> capture ref, from the place facets */
  refOfSlug: ReadonlyMap<string, string | null>;
  tagLabel: (id: string) => string | null;
}

export function buildTripTags(trip: PublicTrip, ctx: TagContext): TripTags {
  const where = whereTag(trip, ctx.folder, ctx.placeBySlug);
  const base: TripTags = {
    ...where,
    length: lengthTag(trip.nights),
    when: trip.season?.months ?? [],
    kidsFrom: null,
    hike: null,
    stroller: null,
    activities: [],
    highlights: [],
    around: [],
    perDay: null,
    perDayApprox: false,
    shape: null,
  };
  if (trip.depth === 'overview') return base;

  // the hand-typed values stand until the scheduler derives them (L3c); see the hand-back
  base.kidsFrom = trip.ageFit;
  base.hike = hikeTag(trip.effort);

  const dayOfName = new Map<string, number>();
  for (const d of trip.days) for (const i of d.items) if (!dayOfName.has(normName(i.name))) dayOfName.set(normName(i.name), d.n);
  const picks = pickedItems(ctx.root, ctx.world, trip.slug, (n) => dayOfName.get(normName(n)) ?? null);
  base.highlights = highlightsTag(picks);
  base.activities = activitiesTag(picks, ctx.tagLabel);

  // stroller: the item's capture record by place, then by a name only one record carries
  const refByName = new Map<string, string[]>();
  for (const { rec } of ctx.world.cap.values()) if (rec.name && rec.layer !== 'offer') refByName.set(normName(rec.name), [...(refByName.get(normName(rec.name)) ?? []), rec.ref]);
  base.stroller = strollerTag(trip.days, (item) => {
    const bySlug = item.placeSlug ? ctx.refOfSlug.get(item.placeSlug) : null;
    const byName = refByName.get(normName(item.name));
    const ref = bySlug ?? (byName?.length === 1 ? byName[0] : null);
    const suit = ref ? ctx.world.suit.get(ref)?.rec : undefined;
    return suit ? strollerOkOf(suit) : null;
  });

  base.around = aroundTag(trip.categories.logistics);
  const pd = perDayTag(trip.days);
  base.perDay = pd.band;
  base.perDayApprox = pd.approx;
  base.shape = shapeTag(trip.bases.length);
  return base;
}
