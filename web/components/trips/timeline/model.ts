// What the trip page hands the timeline components (trip-timeline spec 2.1, 3.7). Plain JSON, built on the server from the public
// dataset: the scheduler inputs per day, the default profile's timelines, and the pre-filtered list of places a visitor may add
// to a day (never the whole catalogue: principle P8). Nothing here reads a file.
import { haversineM } from '@travel/core/checks/time.ts';
import type { DayTimeline, ItemKind, Point, Profile, ScheduleDayInput, ScheduleItem } from '@travel/core/schedule/types.ts';
import { parseHoursRange } from '@/lib/public/quantities';
import type { KnowGroup } from '@/lib/public/prose';
import type { DayVariantInfo, PublicDay, PublicPlaceCard, PublicTrip } from '@/lib/public/types';

/** A place a visitor can add to a day. `key` is what the URL carries: add=5.<key>. */
export interface AddCandidate {
  key: string;
  name: string;
  kind: ItemKind;
  sub: string | null;
  placeSlug: string | null;
  point: Point | null;
  durationMin: number | null;
  durationRange: [number, number] | null;
  stats: { distanceKm: number | null; gainM: number | null } | null;
  /** "Lake", "Trail": the word beside the name. */
  label: string;
  group: 'quick' | 'variant' | 'trip' | 'nearby';
}

export interface TimelineDayModel {
  n: number;
  title: string;
  base: string | null;
  thumb: { url: string } | null;
  summary: string | null;
  light: string | null;
  input: ScheduleDayInput;
  variants: DayVariantInfo[];
  know: KnowGroup[];
}

export interface TimelineModel {
  slug: string;
  defaultProfile: Profile;
  /** "families with a child from about 6": who the plan suits. */
  writtenFor: string;
  condensed: boolean;
  hasSplit: boolean;
  hasVariants: boolean;
  days: TimelineDayModel[];
  defaultTimelines: DayTimeline[];
  /** Every candidate by key, once; `addByDay` lists the keys offered on each day. */
  addables: Record<string, AddCandidate>;
  addByDay: Record<number, string[]>;
}

const QUICK: AddCandidate[] = [
  { key: 'coffee-break', name: 'Coffee and a snack', kind: 'break', sub: 'coffee', placeSlug: null, point: null, durationMin: 20, durationRange: null, stats: null, label: 'Break', group: 'quick' },
  { key: 'lunch-stop', name: 'Lunch', kind: 'meal', sub: 'lunch', placeSlug: null, point: null, durationMin: 60, durationRange: null, stats: null, label: 'Meal', group: 'quick' },
  { key: 'rest-stop', name: 'A rest', kind: 'rest', sub: 'free-time', placeSlug: null, point: null, durationMin: 45, durationRange: null, stats: null, label: 'Rest', group: 'quick' },
];

const KIND_LABEL: Record<string, string> = { trail: 'Trail', lake: 'Lake', viewpoint: 'Viewpoint', waterfall: 'Waterfall', sight: 'Sight', town: 'Town', activity: 'Activity', lift: 'Lift', area: 'Area', eatery: 'Eatery' };

/** The scheduler's item for a candidate. Pure, so the browser can place it by cheapest insertion. */
export function candidateToItem(c: AddCandidate): ScheduleItem {
  return {
    id: `add-${c.key}`, kind: c.kind, sub: c.sub, title: c.name, placeSlug: c.placeSlug, point: c.point, rule: null, durationMin: c.durationMin, durationRange: c.durationRange,
    durationSource: c.durationMin !== null || c.durationRange ? 'data' : null, stats: c.stats, start: null, needs: null, window: null, checkinMin: null, optional: false, note: null,
    minAge: null, minAgeRule: null, needsDaylight: c.kind === 'trail', honesty: [],
  };
}

const kindOf = (k: string): { kind: ItemKind; sub: string | null } => {
  if (k === 'trail') return { kind: 'trail', sub: 'hike' };
  if (k === 'eatery') return { kind: 'meal', sub: 'lunch' };
  if (k === 'lift') return { kind: 'visit', sub: 'lift-ride' };
  if (k === 'activity') return { kind: 'visit', sub: 'activity' };
  if (k === 'lake' || k === 'viewpoint' || k === 'waterfall' || k === 'town') return { kind: 'visit', sub: k };
  return { kind: 'visit', sub: 'sight' };
};

function fromItem(it: ScheduleItem, group: AddCandidate['group']): AddCandidate | null {
  if (it.kind === 'meal' || it.kind === 'break' || it.kind === 'rest' || it.kind === 'checkin' || it.kind === 'checkout') return null;
  return {
    key: it.placeSlug ?? it.id, name: it.title, kind: it.kind, sub: it.sub, placeSlug: it.placeSlug, point: it.point, durationMin: it.durationMin, durationRange: it.durationRange,
    stats: it.stats, label: it.kind === 'trail' ? 'Trail' : KIND_LABEL[it.sub ?? ''] ?? 'Stop', group,
  };
}

function fromPlace(p: PublicPlaceCard): AddCandidate {
  const k = kindOf(p.kind);
  const hasStats = p.stats.distanceKm !== null || p.stats.gainM !== null;
  return {
    key: p.slug, name: p.name, kind: k.kind, sub: k.sub, placeSlug: p.slug, point: p.point ? { lat: p.point.lat, lon: p.point.lon } : null, durationMin: null,
    durationRange: parseHoursRange(p.stats.hours), stats: hasStats ? { distanceKm: p.stats.distanceKm, gainM: p.stats.gainM } : null, label: p.kindLabel, group: 'nearby',
  };
}

const NEARBY_KM = 30;
const PER_DAY = { variant: 4, trip: 6, nearby: 8 } as const;

/** The candidates for each day: the day's other versions, the trip's stops at this base, and places within 30 km that have a page. */
function candidatesFor(trip: PublicTrip, nearby: PublicPlaceCard[]): { addables: Record<string, AddCandidate>; addByDay: Record<number, string[]> } {
  const addables: Record<string, AddCandidate> = {};
  for (const q of QUICK) addables[q.key] = q;
  const addByDay: Record<number, string[]> = {};
  const baseDays = new Map<string, number[]>();
  for (const d of trip.days) if (d.baseId) baseDays.set(d.baseId, [...(baseDays.get(d.baseId) ?? []), d.n]);
  for (const d of trip.days) {
    const input = d.scheduleInput;
    if (!input) continue;
    const keys: string[] = QUICK.map((q) => q.key);
    const onDay = new Set(input.variants.flatMap((v) => v.items.map((i) => i.placeSlug ?? i.id)));
    const take = (c: AddCandidate | null, group: keyof typeof PER_DAY, seen: Set<string>) => {
      if (!c || seen.has(c.key) || keys.includes(c.key)) return;
      seen.add(c.key);
      addables[c.key] ??= c;
      keys.push(c.key);
    };
    // 1. other versions of this day
    const chosen = input.variants.find((v) => v.key === 'B') ?? input.variants[0]!;
    const inChosen = new Set(chosen.items.map((i) => i.id));
    const seenA = new Set<string>();
    for (const v of input.variants) if (v !== chosen) for (const it of v.items) if (!inChosen.has(it.id) && seenA.size < PER_DAY.variant) take(fromItem(it, 'variant'), 'variant', seenA);
    // 2. the trip's stops on other days at this base
    const seenB = new Set<string>();
    for (const n of baseDays.get(d.baseId ?? '') ?? []) {
      if (n === d.n) continue;
      const other = trip.days.find((x) => x.n === n)?.scheduleInput;
      if (!other) continue;
      for (const it of other.variants.find((v) => v.key === 'B' || v.key === 'main')?.items ?? []) {
        if (onDay.has(it.placeSlug ?? it.id) || seenB.size >= PER_DAY.trip) continue;
        take(fromItem(it, 'trip'), 'trip', seenB);
      }
    }
    // 3. catalogue places with a page within 30 km of the base
    const base = input.base?.point ?? null;
    if (base) {
      const near = nearby
        .filter((p) => p.point && p.kind !== 'stay' && !onDay.has(p.slug))
        .map((p) => ({ p, km: haversineM(base, { lat: p.point!.lat, lon: p.point!.lon }) / 1000 }))
        .filter((x) => x.km <= NEARBY_KM)
        .sort((a, b) => a.km - b.km || a.p.slug.localeCompare(b.p.slug))
        .slice(0, PER_DAY.nearby);
      const seenC = new Set<string>();
      for (const { p } of near) take(fromPlace(p), 'nearby', seenC);
    }
    addByDay[d.n] = keys;
  }
  return { addables, addByDay };
}

/** The whole timeline model, or null for a trip with no days. */
export function buildTimelineModel(trip: PublicTrip, thumbs: Map<number, { url: string } | null>, nearby: PublicPlaceCard[] = []): TimelineModel | null {
  if (!trip.schedule || trip.depth === 'overview') return null;
  const days: TimelineDayModel[] = [];
  for (const d of trip.days as PublicDay[]) {
    if (!d.scheduleInput) return null;
    days.push({
      n: d.n, title: d.title, base: d.base, thumb: thumbs.get(d.n) ?? null, summary: d.summaryProse?.plain ?? d.summary, light: d.light, input: d.scheduleInput, variants: d.variants, know: d.know,
    });
  }
  const { addables, addByDay } = candidatesFor(trip, nearby);
  return {
    slug: trip.slug, defaultProfile: trip.schedule.defaultProfile, writtenFor: trip.schedule.writtenFor, condensed: trip.schedule.condensed, hasSplit: trip.schedule.hasSplit,
    hasVariants: trip.schedule.hasVariants, days, defaultTimelines: trip.schedule.timelines, addables, addByDay,
  };
}

/** The route's points for each day in the order the timeline visits them (spec step 20): stops with no place page keep their place at the end. */
export function orderRoute<R extends { days: { n: number; points: { placeSlug: string | null }[] }[] }>(route: R, timelines: DayTimeline[]): R {
  const days = route.days.map((d) => {
    const t = timelines.find((x) => x.day === d.n);
    if (!t) return d;
    const rank = new Map<string, number>();
    t.entries.forEach((e, i) => {
      const slug = e.kind !== 'leg' ? e.at?.placeSlug : null;
      if (slug && !rank.has(slug)) rank.set(slug, i);
    });
    const points = [...d.points].sort((a, b) => (rank.get(a.placeSlug ?? '') ?? 1e6) - (rank.get(b.placeSlug ?? '') ?? 1e6));
    return { ...d, points };
  });
  return { ...route, days };
}

const norm = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** The time a category row happens at on a day, for the current profile ("Day 5 · 10:00"), or null when no entry matches. */
export function timeOfRow(row: { name: string; placeSlug: string | null }, day: number, timelines: DayTimeline[]): string | null {
  const t = timelines.find((x) => x.day === day);
  if (!t) return null;
  const name = norm(row.name);
  const hit = t.entries.find((e) => e.kind !== 'leg' && e.kind !== 'sun' && ((row.placeSlug && e.at?.placeSlug === row.placeSlug) || norm(e.title) === name || (name.length > 5 && norm(e.title).includes(name))));
  return hit ? hit.start : null;
}
