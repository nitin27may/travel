// What the trip page hands the timeline components (trip-timeline spec 2.1, 3.7). Plain JSON, built on the server from the public
// dataset: the scheduler inputs per day, the default profile's timelines, and the pre-filtered list of places a visitor may add
// to a day (never the whole catalogue: principle P8). Nothing here reads a file.
import type { DayTimeline, ItemKind, Point, Profile, ScheduleDayInput, ScheduleItem } from '@travel/core/schedule/types.ts';
import { ADD_NEARBY_KM } from '@travel/core/config/nearby.ts';
import { haversineM } from '@travel/core/geo/distance.ts';
import { kindLabel } from '@/lib/entities/labels';
import { parseHoursRange } from '@/lib/public/quantities';
import type { KnowGroup } from '@/lib/public/prose';
import type { DayVariantInfo, DayZone, ItemSuit, PublicDay, PublicPlaceCard, PublicTrip } from '@/lib/public/types';

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
  /** Distance from the day's nearest placed stop or base, in km. */
  km: number | null;
  group: 'variant' | 'trip' | 'nearby';
}

export interface TimelineDayModel {
  n: number;
  title: string;
  base: string | null;
  /** The day's photo, or null. A day with none shows `glyph`: the kind of its main stop, never a bare grey box. */
  thumb: { url: string } | null;
  glyph: string;
  summary: string | null;
  light: string | null;
  input: ScheduleDayInput;
  variants: DayVariantInfo[];
  know: KnowGroup[];
  /** A time-zone line crossed this day (Rockies Day 6): the far side reads in local time. */
  zone?: DayZone;
  /** The day's last times depend on a flight whose time the plan does not know (Rockies Day 15). */
  flight?: boolean;
}

export interface TimelineModel {
  slug: string;
  /** The plan's own settings without the adults count: that is state the visitor sets, not something the page ships. */
  defaultProfile: Omit<Profile, 'adults'>;
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
  /** The three suitability chips and the badge of each stop that is a place, by place slug (S1). */
  suit: Record<string, ItemSuit>;
}

/** The stop kinds a candidate card names; any other sub reads "Stop". The words come from types.json through kindLabel. */
const LABELLED_SUBS: ReadonlySet<string> = new Set(['trail', 'lake', 'viewpoint', 'waterfall', 'sight', 'town', 'activity', 'lift', 'area', 'eatery']);

/** The scheduler's item for a candidate. Pure, so the browser can place it by cheapest insertion. */
export function candidateToItem(c: AddCandidate): ScheduleItem {
  return {
    id: `add-${c.key}`, kind: c.kind, sub: c.sub, title: c.name, placeSlug: c.placeSlug, point: c.point, rule: null, durationMin: c.durationMin, durationRange: c.durationRange,
    durationSource: c.durationMin !== null || c.durationRange ? 'data' : null, stats: c.stats, start: null, needs: null, window: null, checkinMin: null, optional: false, note: null,
    minAge: null, minAgeRule: null, needsDaylight: c.kind === 'trail', honesty: [],
  };
}

export const kindOf = (k: string): { kind: ItemKind; sub: string | null } => {
  if (k === 'trail') return { kind: 'trail', sub: 'hike' };
  if (k === 'eatery') return { kind: 'meal', sub: 'lunch' };
  if (k === 'lift') return { kind: 'visit', sub: 'lift-ride' };
  if (k === 'activity') return { kind: 'visit', sub: 'activity' };
  if (k === 'lake' || k === 'viewpoint' || k === 'waterfall' || k === 'town') return { kind: 'visit', sub: k };
  return { kind: 'visit', sub: 'sight' };
};

function fromItem(it: ScheduleItem, group: AddCandidate['group'], km: number | null, point: Point | null = it.point): AddCandidate | null {
  if (it.kind === 'meal' || it.kind === 'break' || it.kind === 'rest' || it.kind === 'checkin' || it.kind === 'checkout') return null;
  return {
    key: it.placeSlug ?? it.id, name: it.title, kind: it.kind, sub: it.sub, placeSlug: it.placeSlug, point, durationMin: it.durationMin, durationRange: it.durationRange,
    stats: it.stats, label: it.kind === 'trail' ? kindLabel('trail') : LABELLED_SUBS.has(it.sub ?? '') ? kindLabel(it.sub!) : 'Stop', km, group,
  };
}

function fromPlace(p: PublicPlaceCard, km: number): AddCandidate {
  const k = kindOf(p.kind);
  const hasStats = p.stats.distanceKm !== null || p.stats.gainM !== null;
  return {
    key: p.slug, name: p.name, kind: k.kind, sub: k.sub, placeSlug: p.slug, point: p.point ? { lat: p.point.lat, lon: p.point.lon } : null, durationMin: null,
    durationRange: parseHoursRange(p.stats.hours), stats: hasStats ? { distanceKm: p.stats.distanceKm, gainM: p.stats.gainM } : null, label: p.kindLabel, km, group: 'nearby',
  };
}

const PER_DAY = { variant: 4, trip: 6, nearby: 8 } as const;

/** The candidates for each day: the day's other versions, the trip's stops at this base, and places within `ADD_NEARBY_KM` that have a page. */
function candidatesFor(trip: PublicTrip, nearby: PublicPlaceCard[]): { addables: Record<string, AddCandidate>; addByDay: Record<number, string[]> } {
  const addables: Record<string, AddCandidate> = {};
  const addByDay: Record<number, string[]> = {};
  const slugPoints = new Map<string, Point>();
  for (const p of nearby) if (p.point) slugPoints.set(p.slug, { lat: p.point.lat, lon: p.point.lon });
  const baseDays = new Map<string, number[]>();
  for (const d of trip.days) if (d.baseId) baseDays.set(d.baseId, [...(baseDays.get(d.baseId) ?? []), d.n]);
  for (const d of trip.days) {
    const input = d.scheduleInput;
    if (!input) continue;
    const keys: string[] = [];
    const onDay = new Set(input.variants.flatMap((v) => v.items.map((i) => i.placeSlug ?? i.id)));
    const take = (c: AddCandidate | null, group: keyof typeof PER_DAY, seen: Set<string>) => {
      // a place to add is a place with a page: the operation that adds it names the page (a plan stop with none, a gondola, cannot be added by it)
      if (!c || (group !== 'nearby' && !c.placeSlug) || seen.has(c.key) || keys.includes(c.key)) return;
      seen.add(c.key);
      addables[c.key] ??= c;
      keys.push(c.key);
    };
    // every candidate must be within ADD_NEARBY_KM of something the day places: its base or a stop with a coordinate
    const anchors: Point[] = [...(input.base?.point ? [input.base.point] : []), ...input.variants.flatMap((v) => v.items.flatMap((i) => (i.point ? [i.point] : [])))];
    const nearest = (p: Point | null): number | null => (p && anchors.length ? Math.min(...anchors.map((a) => haversineM(a, p) / 1000)) : null);
    const within = (km: number | null): km is number => km !== null && km <= ADD_NEARBY_KM;
    // a stop of the plan often carries no coordinate of its own: its place page does (ER-005). One that has neither is still offered when it
    // belongs to this day's own versions or to a day at the same base, since the plan put it there; one with a point must be near
    const pointOf = (it: ScheduleItem): Point | null => it.point ?? (it.placeSlug ? (slugPoints.get(it.placeSlug) ?? null) : null);
    const ok = (km: number | null): boolean => km === null || within(km);
    const round = (km: number | null): number | null => (km === null ? null : Math.round(km * 10) / 10);
    // 1. other versions of this day
    const chosen = input.variants.find((v) => v.key === 'B') ?? input.variants[0]!;
    const inChosen = new Set(chosen.items.map((i) => i.id));
    const seenA = new Set<string>();
    for (const v of input.variants) {
      if (v === chosen) continue;
      for (const it of v.items) {
        const pt = pointOf(it);
        const km = nearest(pt);
        if (!inChosen.has(it.id) && ok(km) && seenA.size < PER_DAY.variant) take(fromItem(it, 'variant', round(km), pt), 'variant', seenA);
      }
    }
    // 2. the trip's stops on other days at this base
    const seenB = new Set<string>();
    for (const n of baseDays.get(d.baseId ?? '') ?? []) {
      if (n === d.n) continue;
      const other = trip.days.find((x) => x.n === n)?.scheduleInput;
      if (!other) continue;
      for (const it of other.variants.find((v) => v.key === 'B' || v.key === 'main')?.items ?? []) {
        const pt = pointOf(it);
        const km = nearest(pt);
        if (onDay.has(it.placeSlug ?? it.id) || seenB.size >= PER_DAY.trip || !ok(km)) continue;
        take(fromItem(it, 'trip', round(km), pt), 'trip', seenB);
      }
    }
    // 3. catalogue places with a page within ADD_NEARBY_KM (SW-014: a park or an area is never a stop, TB-PIN R1)
    const near = nearby
      .filter((p) => p.point && p.kind !== 'stay' && p.kind !== 'area' && p.kind !== 'town' && !onDay.has(p.slug))
      .map((p) => ({ p, km: nearest({ lat: p.point!.lat, lon: p.point!.lon }) }))
      .filter((x): x is { p: PublicPlaceCard; km: number } => within(x.km))
      .sort((a, b) => a.km - b.km || a.p.slug.localeCompare(b.p.slug))
      .slice(0, PER_DAY.nearby);
    const seenC = new Set<string>();
    for (const { p, km } of near) take(fromPlace(p, Math.round(km * 10) / 10), 'nearby', seenC);
    addByDay[d.n] = keys;
  }
  return { addables, addByDay };
}

/** The chips of every stop of the trip that is a place with a record, once per place. */
function suitByPlace(trip: PublicTrip): Record<string, ItemSuit> {
  const out: Record<string, ItemSuit> = {};
  for (const d of trip.days) for (const it of [...d.items, ...(d.tracks ?? []).flatMap((t) => t.items)]) {
    if (!it.suit) continue;
    // the scheduler resolves a stop's page by name and sometimes misses it, so a stop is also found by its normalised name
    if (it.placeSlug && !out[it.placeSlug]) out[it.placeSlug] = it.suit;
    out[`n:${norm(it.name)}`] ??= it.suit;
  }
  return out;
}

/** The whole timeline model, or null for a trip with no days. */
export function buildTimelineModel(trip: PublicTrip, thumbs: Map<number, { url: string | null; glyph: string }>, nearby: PublicPlaceCard[] = []): TimelineModel | null {
  if (!trip.schedule || trip.depth === 'overview') return null;
  const days: TimelineDayModel[] = [];
  for (const d of trip.days as PublicDay[]) {
    if (!d.scheduleInput) return null;
    days.push({
      n: d.n, title: d.title, base: d.base, thumb: thumbs.get(d.n)?.url ? { url: thumbs.get(d.n)!.url! } : null, glyph: thumbs.get(d.n)?.glyph ?? 'mountain',
      summary: d.summaryProse?.plain ?? d.summary, light: d.light, input: d.scheduleInput, variants: d.variants, know: d.know,
      ...(d.zone ? { zone: d.zone } : {}), ...(d.flight ? { flight: true } : {}),
    });
  }
  const { addables, addByDay } = candidatesFor(trip, nearby);
  return {
    slug: trip.slug, defaultProfile: (({ adults: _a, ...rest }) => (void _a, rest))(trip.schedule.defaultProfile), writtenFor: trip.schedule.writtenFor, condensed: trip.schedule.condensed, hasSplit: trip.schedule.hasSplit,
    hasVariants: trip.schedule.hasVariants, days, defaultTimelines: trip.schedule.timelines, addables, addByDay, suit: suitByPlace(trip),
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
