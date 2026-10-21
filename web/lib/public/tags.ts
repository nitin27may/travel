// Trip tags, all derived (suitability 6.3, relevance 6.3, capture contract 7): where, length, season, kids from N, hike effort,
// stroller days, activities, highlights, getting around, driving per day and shape. None is typed by hand. One pure function per
// tag; `buildTripTags` calls them for a trip. An overview trip gets Where, Length and When only (no fake zeros).
import { lengthFilter } from '@travel/core/derive/length.ts';
import type { LengthFilter } from '@travel/core/derive/length.ts';
import { ageRules } from '@travel/core/schedule/rules.ts';
import { selectVariant } from '@travel/core/schedule/select.ts';
import { DEFAULT_PROFILE } from '@travel/core/schedule/types.ts';
import type { DayVariant, Profile, ScheduleDayInput, ScheduleItem } from '@travel/core/schedule/types.ts';
import { familyEffortOf, strollerOkOf, tagEffortOf } from '@travel/core/suitability/derive.ts';
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
  /**
   * `computed`: the scheduler, every day on known data. `floor`: the plan's number raised to the scheduler's fit age with gaps counted as
   * passes, which gaps can only push up, so it is a proven minimum. `plan`: the plan's own number. Null: no number.
   */
  kidsBasis: 'computed' | 'floor' | 'plan' | null;
  hike: HikeEffort | null;
  /** `computed`: from trails with a known effort and no unknown ones below it; `plan`: the plan's own word. */
  hikeBasis: 'computed' | 'plan' | null;
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

export interface KidsResult {
  /** The published number: the lowest age that fits every day on known data. 0 means every age. Null when it cannot be said. */
  age: number | null;
  /** The lowest age at which the scheduler says every day fits, known or not (null: no age fits). */
  fitAge: number | null;
  /** Items the fit rests on but nothing is known about (a gap is never a fit). Empty when `age` is set. */
  unknown: { day: number; item: string }[];
  /** The item that sets the number: the one with the highest minimum age in the chosen variants. */
  decider: string | null;
}

/**
 * Kids from N: the lowest youngest-age (0 to 17) for which the scheduler finds a fitting variant on every day, counted only when the fit
 * rests on known data. A day whose chosen variant holds an item with no age and no distance on record is UNKNOWN for that age, not a fit:
 * the answer is then null (the card keeps the plan's own number), never a small number from missing data. `known` says whether an item
 * has the data a fit needs. A variant with a trail whose known family effort is above what the age can do (`ageRules(age).maxEffort`) is not
 * a fit at that age, so a strenuous hike cannot sit under "Kids from 0".
 */
export function kidsFromTag(days: readonly ScheduleDayInput[], known: (item: ScheduleItem) => boolean, effortOf: (item: ScheduleItem) => number | null = () => null): KidsResult {
  const none: KidsResult = { age: null, fitAge: null, unknown: [], decider: null };
  if (!days.length || days.some((d) => !d.variants.length)) return none;
  for (let age = 0; age <= 17; age += 1) {
    const p = familyProfile(age);
    const cap = ageRules(age).maxEffort;
    const picks = days.map((d) => {
      const doable = d.variants.filter((v) => v.items.every((i) => i.kind !== 'trail' || (effortOf(i) ?? 0) <= cap));
      return { d, sel: doable.length ? selectVariant({ ...d, variants: doable }, p) : null };
    });
    if (!picks.every((x) => x.sel?.fits)) continue;
    const unknown = picks.flatMap(({ d, sel }) => sel!.variant.items.filter((i) => !i.optional && !known(i)).map((i) => ({ day: d.day, item: i.title })));
    let decider: string | null = null;
    let top = -1;
    for (const { sel } of picks) for (const i of sel!.variant.items) if ((i.minAge ?? -1) > top) { top = i.minAge ?? -1; decider = i.title; }
    return unknown.length ? { age: null, fitAge: age, unknown, decider } : { age, fitAge: age, unknown: [], decider };
  }
  return none;
}

export interface HikeResult {
  value: HikeEffort | null;
  /** The trail that sets it, with the day and the variant it is in. */
  decider: string | null;
  /** Trails in the chosen variants whose effort is not on record (they are left out, never counted as easy). */
  unknown: number;
}

/**
 * Hike effort: the maximum family effort of the trails with a known effort in the variant the default FAMILY profile picks on each day
 * (FE 1-2 easy, 3 moderate, 4-5 strenuous). An adults-only variant is never the family's, so it cannot set the tag.
 */
export function hikeEffortTag(days: readonly ScheduleDayInput[], effortOf: (item: ScheduleItem) => number | null, profile: Profile = familyProfile(8)): HikeResult {
  let max: number | null = null;
  let decider: string | null = null;
  let unknown = 0;
  for (const d of days) {
    // a variant written for adults is never the family's, even when the scheduler would let it fit
    const family = d.variants.filter((v) => v.audience !== 'adults');
    if (!family.length) continue;
    const sel = selectVariant({ ...d, variants: family }, profile);
    for (const it of sel.variant.items) {
      if (it.kind !== 'trail') continue;
      const fe = effortOf(it);
      if (fe === null) {
        unknown += 1;
        continue;
      }
      if (max === null || fe > max) {
        max = fe;
        decider = `${it.title} (day ${d.day}, variant ${sel.variant.key}, FE ${fe})`;
      }
    }
  }
  return { value: max === null ? null : max <= 2 ? 'easy' : max === 3 ? 'moderate' : 'strenuous', decider, unknown };
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
export function highlightsTag(picks: readonly PickedItem[], regionNames: readonly string[] = []): string[] {
  // a highlight is a place to go, never the region the trip is in ("Dolomites"): drop an anchor that is only the region's own name
  const regions = new Set(regionNames.map(normName).filter(Boolean));
  const anchors = picks.filter((p) => p.anchor && !regions.has(normName(p.name))).sort((a, b) => a.draw - b.draw || a.day - b.day || a.name.localeCompare(b.name));
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

/** One derived tag of one trip against its hand-typed value, for research/reports/trip-tag-conflicts.md. */
export interface TagConflict {
  trip: string;
  field: 'kidsFrom' | 'hike';
  typed: string | number | null;
  /** The scheduler's answer, or null when it could not give one on known data. */
  computed: string | number | null;
  /** What the card shows. */
  shown: string | number | null;
  /** The item that decides the computed value. */
  decider: string | null;
  /** What was missing, or "none". */
  gap: string;
  /** Trails in the family variants whose effort is not on record (Hike effort only). */
  unknownEffort: number;
}

export function buildTripTags(trip: PublicTrip, ctx: TagContext, conflicts: TagConflict[] = []): TripTags {
  const where = whereTag(trip, ctx.folder, ctx.placeBySlug);
  const base: TripTags = {
    ...where,
    length: lengthTag(trip.nights),
    when: trip.season?.months ?? [],
    kidsFrom: null,
    kidsBasis: null,
    hike: null,
    hikeBasis: null,
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
  const refOf = (item: ScheduleItem): string | null => {
    const bySlug = item.placeSlug ? ctx.refOfSlug.get(item.placeSlug) : null;
    const byName = refByName.get(normName(item.title));
    return bySlug ?? (byName?.length === 1 ? byName[0]! : null);
  };
  const suitOf = (item: ScheduleItem) => {
    const ref = refOf(item);
    return ref ? ctx.world.suit.get(ref)?.rec : undefined;
  };

  // Kids from N and Hike effort come from the scheduler on known data; the plan's own typed value stands where it cannot answer
  const typedHike = hikeTag(trip.effort);
  const isNeutral = (item: ScheduleItem): boolean => {
    if (['meal', 'break', 'rest', 'checkin', 'checkout', 'transfer'].includes(item.kind)) return true;
    const ref = refOf(item);
    const type = ref ? ctx.world.cap.get(ref)?.rec.type ?? '' : '';
    return /^(settlement|access|wheels\.drive)/.test(type);
  };
  const ageKnown = (item: ScheduleItem): boolean => {
    if (isNeutral(item)) return true;
    // a trail is tested on its walk (distance), anything else needs an age on record
    if (item.kind === 'trail' && item.stats?.distanceKm != null) return true;
    if (item.minAge !== null) return true;
    const s = suitOf(item)?.suitability;
    if (!s) return false;
    const known = (v: { state: string } | undefined) => v !== undefined && (v.state === 'value' || v.state === 'no_limit');
    return known(s.age_band) || known(s.min_age);
  };
  const effortOf = (item: ScheduleItem): number | null => {
    const s = suitOf(item);
    return s ? familyEffortOf(s) : null;
  };
  const kids = kidsFromTag(inputs, ageKnown, effortOf);
  if (kids.age !== null) {
    base.kidsFrom = kids.age;
    base.kidsBasis = 'computed';
  } else if (kids.fitAge !== null && kids.fitAge > (trip.ageFit ?? -1)) {
    // the data already rules out every age below the fit age: never show less than that
    base.kidsFrom = kids.fitAge;
    base.kidsBasis = 'floor';
  } else {
    base.kidsFrom = trip.ageFit;
    base.kidsBasis = trip.ageFit !== null ? 'plan' : null;
  }
  if (inputs.length) {
    conflicts.push({
      trip: trip.slug, field: 'kidsFrom', typed: trip.ageFit, computed: kids.age, shown: base.kidsFrom, decider: kids.decider, unknownEffort: 0,
      gap: kids.unknown.length ? `${base.kidsBasis === 'floor' ? `shown as the proven floor ${kids.fitAge} (the plan says ${trip.ageFit}); ` : ''}${kids.unknown.length} item(s) with no age or distance on record, e.g. ${kids.unknown.slice(0, 3).map((u) => `${u.item} (day ${u.day})`).join('; ')}; the scheduler's fit age ${kids.fitAge} rests on them` : kids.fitAge === null ? 'no age fits every day' : 'none',
    });
  }
  const profile: Profile = trip.schedule?.defaultProfile.party === 'family' ? trip.schedule.defaultProfile : familyProfile(8);
  // the trip tag rests on distance, gain and grades; exposure or surface alone is a hazard on the place, not effort
  const hike = hikeEffortTag(inputs, (item) => {
    const s = suitOf(item);
    return s ? tagEffortOf(s) : null;
  }, profile);
  // The known maximum is only a lower bound while some trail has no effort on record: it may never undercut the plan's own word.
  const RANK = { easy: 0, moderate: 1, strenuous: 2 } as const;
  const understates = hike.value !== null && hike.unknown > 0 && typedHike !== null && RANK[hike.value] < RANK[typedHike];
  if (hike.value !== null && !understates) {
    base.hike = hike.value;
    base.hikeBasis = 'computed';
  } else {
    base.hike = typedHike;
    base.hikeBasis = typedHike !== null ? 'plan' : null;
  }
  if (inputs.length) {
    conflicts.push({ trip: trip.slug, field: 'hike', typed: typedHike, computed: hike.value, shown: base.hike, decider: hike.decider, unknownEffort: hike.unknown, gap: hike.unknown ? `${understates ? `the known maximum (${hike.value}) is below the plan's word, so the plan's stands; ` : ''}${hike.unknown} trail(s) in the family variants have no effort on record and are left out` : 'none' });
  }

  const dayOfName = new Map<string, number>();
  for (const d of trip.days) for (const i of d.items) if (!dayOfName.has(normName(i.name))) dayOfName.set(normName(i.name), d.n);
  const picks = pickedItems(ctx.root, ctx.world, trip.slug, (n) => dayOfName.get(normName(n)) ?? null);
  base.highlights = highlightsTag(picks, [trip.region, ...trip.region.split(/[,/·]/)]);
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
