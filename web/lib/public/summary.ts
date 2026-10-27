// The Summary tab's and the trip shape's adapter (trip-and-places-ux-fixes.md 3.5, 4.5; UXB-C). Server only: it reads the public
// trip, its place pages and the export model's bookings, and hands core's pure builders (core/src/trips/summary.ts, shape.ts) the
// light facts they need. One boundary (P9): the Summary never reads data/** or a capture file itself; every number it shows comes
// through here. Nothing household-specific goes in: the default profile's timelines only, never a party.
import { tripBookings } from '@travel/core/export/bookings.ts';
import { tripShape, type ShapeModel } from '@travel/core/trips/shape.ts';
import { tripSummary, type Audience, type HighlightCandidate, type SummaryInput, type SummaryPlace, type TripSummary } from '@travel/core/trips/summary.ts';
import type { DayTimeline } from '@travel/core/schedule/types.ts';
import { TRIP_COUNTRY } from './globe';
import { normName } from './places';
import { TRIP_SLUGS } from './slugs';
import type { CategoryItem, DayItem, PublicPlace, PublicTrip } from './types';

type Lookup = (slug: string) => PublicPlace | null;

/** The trip-surface badge the Summary counts as a highlight (relevance 6.2: anchors of a trip of 4 or more nights). */
export const HIGHLIGHT_BADGE = 'Worth the journey';

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();
const countryName = (cc: string): string => regionNames?.of(cc.toUpperCase()) ?? cc.toUpperCase();

/** Every item of every day and version (the Stops list's scope: all versions). */
const allItems = (trip: PublicTrip): { day: number; item: DayItem }[] =>
  trip.days.flatMap((d) => [...d.items, ...(d.tracks ?? []).flatMap((t) => t.items)].map((item) => ({ day: d.n, item })));

const FOLDER_OF_SLUG = new Map(Object.entries(TRIP_SLUGS).map(([folder, slug]) => [slug, folder]));

/**
 * The legacy folder of a trip, from its slug: the trip page model no longer carries a legacy URL (the alias would make it a dead link), so the slug is the key. A trip missing from TRIP_SLUGS throws: falling back to the alias would read a folder that does not exist and drop the
 * trip's legacy data without a word (REF-REVIEW S6).
 */
const folderOf = (trip: PublicTrip): string => {
  const f = FOLDER_OF_SLUG.get(trip.slug);
  if (!f) throw new Error(`trip "${trip.slug}" is not in TRIP_SLUGS (web/lib/public/slugs.ts): no legacy folder to read its summary from`);
  return f;
};

/** The places the default profile's timelines visit, in the order they first appear (a region or park is named only from these). */
export function visitedSlugs(timelines: readonly Pick<DayTimeline, 'entries'>[]): string[] {
  const out: string[] = [];
  for (const tl of timelines) for (const e of tl.entries) if (e.at?.placeSlug && !out.includes(e.at.placeSlug)) out.push(e.at.placeSlug);
  return out;
}

/** The facts tripSummary needs, from the public trip and its place pages. Exported for the tests. */
export function summaryInput(trip: PublicTrip, lookup: Lookup): SummaryInput {
  const timelines = trip.schedule?.timelines ?? [];
  const items = allItems(trip);

  const visited: SummaryPlace[] = visitedSlugs(timelines).flatMap((slug) => {
    const p = lookup(slug);
    if (!p) return [];
    return [{ slug, region: p.areaChain.find((a) => a.level === 'state')?.name ?? null, designations: (p.relevance?.provenance?.designations ?? []).map((d) => ({ type: d.type, name: d.name })) }];
  });

  // the trail rows of the Stops list, each with the stats of the plan's first item for it (the key collectCategories gives a row)
  const statsByKey = new Map<string, DayItem['stats']>();
  for (const { item } of items) {
    const key = item.placeSlug ?? `${item.kind}:${normName(item.name)}`;
    if (!statsByKey.has(key) && item.stats) statsByKey.set(key, item.stats);
  }
  const trails = trip.categories.trails.map((r) => {
    const s = statsByKey.get(r.key) ?? null;
    return { distanceKm: s?.distanceKm ?? null, gainM: s?.gainM ?? null };
  });

  // the export model's bookings (core tripBookings over the category rows: the same list the Bookings tab, the print and the CSV use)
  const rows: CategoryItem[] = Object.values(trip.categories).flat();
  const rowByKey = new Map(rows.map((r) => [r.key, r]));
  const bookings = tripBookings(rows).map((b) => {
    const rule = rowByKey.get(b.ref)?.bookRule ?? null;
    return { name: b.name, rule: b.rule, day: b.day, opensBeforeDay1: rule ? (rule.dayN ?? 1) - 1 + rule.daysBefore : null };
  });

  // highlights: every item with the trip-surface badge, all versions; a route judged by its payoff points at the payoff's page
  const cand = new Map<string, HighlightCandidate & { days: number[] }>();
  for (const { day, item } of items) {
    if (item.suit?.badge !== HIGHLIGHT_BADGE || !item.placeSlug) continue;
    const row = cand.get(item.placeSlug);
    if (row) {
      if (!row.days.includes(day)) row.days.push(day);
      continue;
    }
    const p = lookup(item.placeSlug);
    const payoff = p?.relevance?.fromPayoff && p.relevance.payoff ? (p.refSlugs[p.relevance.payoff.ref] ?? null) : null;
    cand.set(item.placeSlug, { slug: item.placeSlug, name: p?.name ?? item.name, days: [day], payoffSlug: payoff, placePhoto: !!p?.photo });
  }

  // gallery sections in order, each with the index of its first photo
  const sections: { name: string; first: number }[] = [];
  trip.gallery.forEach((ph, i) => {
    if (ph.group && !sections.some((s) => s.name === ph.group)) sections.push({ name: ph.group, first: i });
  });

  // default-profile days per audience of the chosen version: "whole family on 14 days, adults' hike on 1"
  const versions = new Map<Audience, number>();
  for (const tl of timelines) {
    const audience = trip.days.find((d) => d.n === tl.day)?.variants.find((v) => v.key === tl.variant.key)?.audience;
    if (audience) versions.set(audience, (versions.get(audience) ?? 0) + 1);
  }

  const cc = new Set<string>();
  const main = TRIP_COUNTRY[folderOf(trip)]?.cc;
  if (main) cc.add(main);
  for (const s of visitedSlugs(timelines)) {
    const c = lookup(s)?.areaChain.find((a) => a.level === 'country')?.slug;
    if (c) cc.add(c.toLowerCase());
  }

  const count = (c: keyof PublicTrip['categories']): number => trip.categories[c].length;
  return {
    depth: trip.depth,
    nights: trip.nights,
    days: trip.depth === 'overview' ? 0 : trip.days.length,
    countries: [...cc].map(countryName),
    bases: trip.bases.map((b) => ({ name: b.name, nights: b.nights })),
    visited,
    trails,
    sights: count('sights'),
    activities: count('activities'),
    food: count('food'),
    bookings,
    highlights: [...cand.values()],
    gallery: { photos: trip.gallery.length, sections, items: trip.gallery.map((ph) => ({ caption: ph.caption, group: ph.group ?? null })) },
    versions: [...versions].map(([audience, days]) => ({ audience, days })).sort((a, b) => b.days - a.days),
  };
}

/** The Summary tab's model for a trip (server only). */
export function tripSummaryFor(trip: PublicTrip, lookup: Lookup): TripSummary {
  return tripSummary(summaryInput(trip, lookup));
}

/**
 * The trip's shape for the default profile (the server-rendered ribbon and count line). The lazy rows chunk calls core's `tripShape`
 * with the visitor's timelines and the same `bookingDays` and `highlightSlugs` (`shapeFacts`). Null on an overview trip (no days).
 */
export function tripShapeFor(trip: PublicTrip, lookup: Lookup): ShapeModel | null {
  if (!trip.schedule || trip.depth === 'overview') return null;
  const f = shapeFacts(trip, lookup);
  return tripShape({
    days: trip.days.map((d) => ({ n: d.n, title: d.title, base: d.base, plannedDriveMin: d.driveMin, variants: d.variants })),
    bases: trip.bases.map((b) => ({ name: b.name, nights: b.nights, days: b.days })),
    timelines: trip.schedule.timelines,
    ...f,
  });
}

/**
 * The two light lists the shape needs besides the timelines: the day of each booking and every page with the highlight badge,
 * including a route folded into its payoff's card (a day that walks to Takakkaw Falls is a highlight day).
 */
export function shapeFacts(trip: PublicTrip, lookup: Lookup): { bookingDays: (number | null)[]; highlightSlugs: string[]; highlightVersions: Record<number, string[]> } {
  const input = summaryInput(trip, lookup);
  const hl = (it: DayItem): boolean => it.suit?.badge === HIGHLIGHT_BADGE;
  const highlightVersions: Record<number, string[]> = {};
  for (const d of trip.days) {
    // a Rockies day's versions are its tracks; any other day's are `main` (no lane) and its lanes (a Dolomites split day)
    const keys = d.tracks?.length
      ? d.tracks.filter((t) => t.items.some(hl)).map((t) => t.id as string)
      : [...new Set(d.items.filter(hl).flatMap((it) => (it.variant ? [it.variant] : ['main', ...d.variants.map((v) => v.key)])))];
    if (keys.length) highlightVersions[d.n] = keys;
  }
  return { bookingDays: input.bookings.map((b) => b.day), highlightSlugs: input.highlights.map((h) => h.slug), highlightVersions };
}
