import { CATEGORIES, CATEGORY_LABEL } from '@/lib/public/types';
import type { Category, CategoryItem, DayItem, Photo, PublicDay, PublicTrip } from '@/lib/public/types';
import { driveLabel } from './format';

/** What the trip page needs from a place: a map point and a thumbnail. Supplied by the page from the places adapter. */
export interface PlaceFacts {
  point: { lat: number; lon: number } | null;
  photo: Photo | null;
}
export type PlaceLookup = (slug: string) => PlaceFacts | null;

export interface StopModel {
  id: string;
  name: string;
  kind: string;
  time: string | null;
  /** "10 km · 450 m up · 3.5-4.5 h", already worded; the page formats units on the client. */
  stats: { distanceKm: number | null; gainM: number | null; hours: string | null } | null;
  note: string | null;
  access: string | null;
  variant: string | null;
  placeSlug: string | null;
}

export interface TrackModel {
  id: 'A' | 'B' | 'C';
  label: string;
  title: string;
  stops: StopModel[];
  notes: string | null;
}

export interface DayRowModel {
  n: number;
  title: string;
  base: string | null;
  /** "≈1 h 10", or null when the day has no drive. */
  drive: string | null;
  driveIsEstimate: boolean;
  thumb: { url: string; alt: string } | null;
  summary: string | null;
  stops: StopModel[];
  tracks: TrackModel[] | null;
  /** The track shown while the row is collapsed: B (the family track) when there is one. */
  defaultTrack: 'A' | 'B' | 'C' | null;
}

export interface CategoryRowModel {
  key: string;
  name: string;
  kind: string;
  placeSlug: string | null;
  days: number[];
  time: string | null;
  area: string | null;
  detail: string | null;
  nights: number | null;
  bookRule: string | null;
  bookNote: string | null;
}
export interface CategorySectionModel {
  id: Category;
  label: string;
  count: number;
  rows: CategoryRowModel[];
}

export interface RoutePoint {
  key: string;
  name: string;
  lng: number;
  lat: number;
  placeSlug: string | null;
}
export interface RouteDayModel {
  n: number;
  title: string;
  base: string | null;
  points: RoutePoint[];
}
export interface RouteModel {
  bases: { id: string; name: string; lng: number; lat: number; days: number[] }[];
  days: RouteDayModel[];
  /** Stops that have no map point yet; the page says so instead of hiding them. */
  unplaced: number;
}

export interface CreditModel {
  title?: string;
  author: string;
  licence: string;
  licenceUrl?: string;
  sourceUrl?: string;
}

export interface TripPageModel {
  days: DayRowModel[];
  sections: CategorySectionModel[];
  route: RouteModel;
  gallery: Photo[];
  credits: CreditModel[];
}

export const bookRuleLabel = (r: NonNullable<CategoryItem['bookRule']>): string => {
  const when = r.dayN !== null ? `${r.daysBefore} days before Day ${r.dayN}` : `${r.daysBefore} days ahead`;
  return `Opens ${when}${r.time ? ` at ${r.time}` : ''}${r.tz ? ' local' : ''}`;
};

const stopOf = (i: DayItem): StopModel => ({
  id: i.id,
  name: i.name,
  kind: i.kind,
  time: i.time,
  stats: i.stats && (i.stats.distanceKm !== null || i.stats.gainM !== null || i.stats.hours) ? i.stats : null,
  note: i.note,
  access: i.access,
  variant: i.variant,
  // a place the trip links to; pages for places that were not built simply do not exist, so the page filters these
  placeSlug: i.placeSlug,
});

/** Items that are rows. Access that is folded into another item (a lot, a gondola used to shorten a walk) is not a stop of its own. */
const isStop = (i: DayItem) => i.category !== null;

const credit = (p: Photo): CreditModel => ({ title: p.caption || undefined, author: p.author, licence: p.licence, licenceUrl: p.licenceUrl ?? undefined, sourceUrl: p.sourceUrl });

const STOP = new Set(['and', 'the', 'with', 'from', 'then', 'early', 'late', 'day', 'lake', 'lago', 'valley', 'national', 'park', 'view', 'viewpoint', 'loop', 'trail', 'hike', 'town', 'village']);
const tokens = (s: string): Set<string> =>
  new Set(
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !STOP.has(w)),
  );

/**
 * The adapter has no photo-to-day link and few places carry a photo, so a day borrows one from the trip gallery: the photo
 * whose section or caption shares the most words with the day (its title and stops count more than its base). Photos not yet
 * used on another row win ties. No match means no photo: the row shows its glyph rather than a wrong picture.
 */
export function galleryThumb(d: PublicDay, gallery: Photo[], taken: Set<string>): Photo | null {
  const strong = tokens([d.title, ...d.items.map((i) => i.name)].join(' '));
  const weak = tokens(d.base ?? '');
  let best: { p: Photo; score: number } | null = null;
  for (const p of gallery) {
    const hay = tokens(`${p.group ?? ''} ${p.caption}`);
    let score = 0;
    for (const w of strong) if (hay.has(w)) score += 2;
    for (const w of weak) if (hay.has(w)) score += 1;
    if (taken.has(p.file)) score -= 1.5;
    if (score > 0 && (!best || score > best.score)) best = { p, score };
  }
  return best?.p ?? null;
}

function dayRow(d: PublicDay, lookup: PlaceLookup, used: Photo[], gallery: Photo[], taken: Set<string>): DayRowModel {
  const stops = d.items.filter(isStop).map(stopOf);
  let thumb: DayRowModel['thumb'] = null;
  let photo: Photo | null = null;
  for (const i of d.items) {
    photo = i.placeSlug ? (lookup(i.placeSlug)?.photo ?? null) : null;
    if (photo) break;
  }
  photo ??= galleryThumb(d, gallery, taken);
  if (photo) {
    thumb = { url: photo.url, alt: '' };
    used.push(photo);
    taken.add(photo.file);
  }
  const tracks = d.tracks?.length ? d.tracks.map((t) => ({ id: t.id, label: t.label, title: t.title, stops: t.items.filter(isStop).map(stopOf), notes: t.notes })) : null;
  return {
    n: d.n,
    title: d.title,
    base: d.base,
    drive: driveLabel(d.driveMin, d.driveIsEstimate),
    driveIsEstimate: d.driveIsEstimate,
    thumb,
    summary: d.summary,
    stops,
    tracks,
    defaultTrack: tracks ? (tracks.find((t) => t.id === 'B') ?? tracks[0]).id : null,
  };
}

function routeOf(trip: PublicTrip, lookup: PlaceLookup): RouteModel {
  let unplaced = 0;
  const bases = trip.bases.flatMap((b) => (b.point ? [{ id: b.id, name: b.name, lng: b.point.lon, lat: b.point.lat, days: b.days }] : []));
  const days = trip.days.map((d) => {
    const seen = new Set<string>();
    const points: RoutePoint[] = [];
    for (const i of d.items) {
      if (!isStop(i)) continue;
      const at = i.placeSlug ? lookup(i.placeSlug)?.point : null;
      if (!at) {
        unplaced += 1;
        continue;
      }
      const key = i.placeSlug as string;
      if (seen.has(key)) continue;
      seen.add(key);
      points.push({ key, name: i.name, lng: at.lon, lat: at.lat, placeSlug: i.placeSlug });
    }
    return { n: d.n, title: d.title, base: d.base, points };
  });
  return { bases, days, unplaced };
}

function sectionsOf(trip: PublicTrip): CategorySectionModel[] {
  return CATEGORIES.map((id) => ({
    id,
    label: CATEGORY_LABEL[id],
    count: trip.categories[id].length,
    rows: trip.categories[id].map((c) => ({
      key: c.key,
      name: c.name,
      kind: c.kind,
      placeSlug: c.placeSlug,
      days: c.days,
      time: c.time,
      area: c.areaLabel,
      detail: c.detail,
      nights: c.nights,
      bookRule: c.bookRule ? bookRuleLabel(c.bookRule) : null,
      bookNote: c.bookNote,
    })),
  }));
}

/** The Rockies gallery holds Waterton photos although the plan has no Waterton: drop photos of places the trip never visits. */
export function tripGallery(trip: PublicTrip): Photo[] {
  const text = [trip.title, trip.region, ...trip.bases.map((b) => b.name), ...trip.days.flatMap((d) => [d.title, d.summary ?? '', ...d.items.map((i) => i.name)])].join(' ');
  const out = trip.gallery.filter((p) => {
    const hay = `${p.caption} ${p.group ?? ''} ${p.file}`;
    return !(/waterton/i.test(hay) && !/waterton/i.test(text));
  });
  return out;
}

/** Everything the trip page renders, from the adapter's trip. Pure: the places lookup is injected. */
export function buildTripPageModel(trip: PublicTrip, lookup: PlaceLookup): TripPageModel {
  const used: Photo[] = [];
  const gallery = tripGallery(trip);
  const taken = new Set<string>();
  const days = trip.depth === 'overview' ? [] : trip.days.map((d) => dayRow(d, lookup, used, gallery, taken));
  const photos = [...(trip.cover ? [trip.cover] : []), ...used, ...gallery];
  const seen = new Set<string>();
  const credits = photos.map(credit).filter((c) => {
    const k = `${c.title}|${c.author}|${c.licence}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
  return {
    days,
    sections: trip.depth === 'overview' ? [] : sectionsOf(trip),
    route: routeOf(trip, lookup),
    gallery,
    credits,
  };
}

/** "Day 3", "Days 1 to 4", "Day 3 · also Day 5": where a category row sits in the trip. Never a calendar date. */
export function whenLabel(days: number[]): { first: number; rest: string | null } {
  const [first, ...more] = days;
  if (more.length === 0) return { first, rest: null };
  const run = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  if (run && days.length >= 3) return { first, rest: `to Day ${days[days.length - 1]}` };
  return { first, rest: `also Day ${more.join(', ')}` };
}
