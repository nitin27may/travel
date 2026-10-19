// Trip tags, all derived (suitability 6.3, relevance 6.3, capture contract 7): where, length, season, kids from N, hike effort,
// stroller days, activities, highlights, getting around, driving per day and shape. None is typed by hand. One pure function per
// tag; `buildTripTags` calls them for a trip. An overview trip gets Where, Length and When only (no fake zeros).
import { lengthFilter } from '@travel/core/derive/length.ts';
import type { LengthFilter } from '@travel/core/derive/length.ts';
import { selectVariant } from '@travel/core/schedule/select.ts';
import { DEFAULT_PROFILE } from '@travel/core/schedule/types.ts';
import type { DayVariant, Profile, ScheduleDayInput, ScheduleItem } from '@travel/core/schedule/types.ts';
import { familyEffortOf, strollerOkOf } from '@travel/core/suitability/derive.ts';
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

// ------------------------------------------------------------------ the scheduler tags (suitability 6.3)

const familyProfile = (youngest: number): Profile => ({ ...DEFAULT_PROFILE, party: 'family', youngest });

/**
 * Kids from N: the lowest youngest-age (0 to 17) for which the scheduler finds a fitting variant on every day. Null when the trip has
 * no scheduled day or no age fits (the plan is for adults).
 */
export function kidsFromTag(days: readonly ScheduleDayInput[]): number | null {
  if (!days.length) return null;
  for (let age = 0; age <= 17; age += 1) {
    const p = familyProfile(age);
    if (days.every((d) => d.variants.length > 0 && selectVariant(d, p).fits)) return age;
  }
  return null;
}

/** Hike effort: the maximum family effort of the trails in the default variant of each day (FE 1-2 easy, 3 moderate, 4-5 strenuous). */
export function hikeEffortTag(days: readonly ScheduleDayInput[], effortOf: (item: ScheduleItem) => number | null): HikeEffort | null {
  let max: number | null = null;
  for (const d of days) {
    if (!d.variants.length) continue;
    for (const it of selectVariant(d, DEFAULT_PROFILE).variant.items) {
      if (it.kind !== 'trail') continue;
      const fe = effortOf(it);
      if (fe !== null && (max === null || fe > max)) max = fe;
    }
  }
  return max === null ? null : max <= 2 ? 'easy' : max === 3 ? 'moderate' : 'strenuous';
}

/** The easiest variant of a day: the one written for an easy day, else the lowest rank. */
export function easiestVariant(d: ScheduleDayInput): DayVariant | null {
  if (!d.variants.length) return null;
  return d.variants.find((v) => v.audience === 'easy') ?? [...d.variants].sort((a, b) => a.rank - b.rank)[0]!;
}

/**
 * "Stroller-friendly" when every day's easiest variant has no walking item with stroller `no`; else "Some stroller days (n of N)".
 * A gap never passes: a walking item with no stroller value fails its day. Null when no day passes (a count of zero says nothing).
 * `strollerOf` returns yes, partly, no, or null for a gap.
 */
export function strollerTag(days: readonly ScheduleDayInput[], strollerOf: (item: ScheduleItem) => 'yes' | 'partly' | 'no' | null): StrollerDays | null {
  const scheduled = days.filter((d) => d.variants.length > 0);
  if (!scheduled.length) return null;
  let pass = 0;
  for (const d of scheduled) {
    const walking = easiestVariant(d)!.items.filter((i) => i.kind === 'trail');
    if (walking.every((i) => strollerOf(i) !== null && strollerOf(i) !== 'no')) pass += 1;
  }
  if (pass === scheduled.length) return { all: true };
  return pass > 0 ? { all: false, n: pass, of: scheduled.length } : null;
}

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

/** Where a derived value replaced a hand-typed one and the two differ (the hand-back lists them). */
export interface TagConflict {
  trip: string;
  field: 'kidsFrom' | 'hike';
  typed: string | number | null;
  computed: string | number | null;
}

export function buildTripTags(trip: PublicTrip, ctx: TagContext, conflicts: TagConflict[] = []): TripTags {
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

  const inputs = trip.days.map((d) => d.scheduleInput).filter((x): x is ScheduleDayInput => x !== null);
  const refByName = new Map<string, string[]>();
  for (const { rec } of ctx.world.cap.values()) if (rec.name && rec.layer !== 'offer') refByName.set(normName(rec.name), [...(refByName.get(normName(rec.name)) ?? []), rec.ref]);
  const suitOf = (item: ScheduleItem) => {
    const bySlug = item.placeSlug ? ctx.refOfSlug.get(item.placeSlug) : null;
    const byName = refByName.get(normName(item.title));
    const ref = bySlug ?? (byName?.length === 1 ? byName[0] : null);
    return ref ? ctx.world.suit.get(ref)?.rec : undefined;
  };

  // Kids from N and Hike effort come from the scheduler; the hand-typed values stand only where it cannot answer
  const typedHike = hikeTag(trip.effort);
  const kids = kidsFromTag(inputs);
  base.kidsFrom = kids ?? trip.ageFit;
  if (kids !== null && kids !== trip.ageFit) conflicts.push({ trip: trip.slug, field: 'kidsFrom', typed: trip.ageFit, computed: kids });
  const hike = hikeEffortTag(inputs, (item) => {
    const s = suitOf(item);
    return s ? familyEffortOf(s) : null;
  });
  base.hike = hike ?? typedHike;
  if (hike !== null && hike !== typedHike) conflicts.push({ trip: trip.slug, field: 'hike', typed: typedHike, computed: hike });

  const dayOfName = new Map<string, number>();
  for (const d of trip.days) for (const i of d.items) if (!dayOfName.has(normName(i.name))) dayOfName.set(normName(i.name), d.n);
  const picks = pickedItems(ctx.root, ctx.world, trip.slug, (n) => dayOfName.get(normName(n)) ?? null);
  base.highlights = highlightsTag(picks);
  base.activities = activitiesTag(picks, ctx.tagLabel);

  // stroller: the easiest variant of each day, the item's capture record by place, then by a name only one record carries
  base.stroller = strollerTag(inputs, (item) => {
    const suit = suitOf(item);
    return suit ? strollerOkOf(suit) : null;
  });

  base.around = aroundTag(trip.categories.logistics);
  const pd = perDayTag(trip.days);
  base.perDay = pd.band;
  base.perDayApprox = pd.approx;
  base.shape = shapeTag(trip.bases.length);
  return base;
}
