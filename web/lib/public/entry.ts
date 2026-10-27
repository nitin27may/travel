// Protected-area entry on the public trips (PA-W; protected-area-entry 6.1 to 6.3, 12). Server only, and the ONLY place the web reads the
// graph index (core/src/graph, entity-graph 8): the index holds every record ref, so it never leaves the server (P9, one data boundary) and
// no client file imports this module. What leaves is derived text: park lines (names, slugs, day numbers) and Book ahead rows.
//
//  1. `parks`: each public trip's stops and bases become capture refs (the page's own slug-to-ref map), `parkVisits` finds the parks and
//     zones the trip enters, and `tripParks` words the park line. The public slug of a park comes from the page index, never a guess.
//  2. rows: `data/trips/booking-refs.json` (temporary; deleted at TD-4) maps a legacy booking row to the capture requirement record that
//     replaces it. `requirementRows` words the record (kind, rule, link, one row per ridden day) and the derived rows take the legacy row's
//     place. A legacy row with no entry stays as it was.
//
// Refs: a row's `key` is the legacy row key (`logistics:<id>`, plus `:d<day>`), never a capture ref (legacy refs name dated trip folders).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { primaryRef, type World } from '@travel/core/capture/records.ts';
import { requirementRows } from '@travel/core/export/requirements.ts';
import { buildIndex, type GraphIndex } from '@travel/core/graph/build.ts';
import { tripParks } from '@travel/core/parks/line.ts';
import { parkVisits, protectedOf, type TripPlaces } from '@travel/core/parks/visits.ts';
import { normName, type PlaceBuild } from './places';
import { TRIP_SLUGS } from './slugs';
import type { CategoryItem, PublicTrip } from './types';

/** One mapped booking: the requirement record, and (when the legacy row's own days are not the ridden days) the days and the row's note. */
export interface BookingRef {
  ref: string;
  days?: number[];
  note?: string;
}

const indexes = new WeakMap<World, GraphIndex>();
/** The graph index of a loaded world, built once per world. */
export function graphOf(world: World): GraphIndex {
  let g = indexes.get(world);
  if (!g) indexes.set(world, (g = buildIndex(world)));
  return g;
}

/**
 * `data/trips/booking-refs.json`: `{ "trips": { "<legacy trip folder>": { "<legacy booking id>": "<requirement ref>" | BookingRef } } }`, the shape
 * of stop-refs.json. A missing file answers {}.
 */
export function readBookingRefs(root: string): Record<string, Record<string, BookingRef>> {
  const file = path.join(root, 'data', 'trips', 'booking-refs.json');
  if (!existsSync(file)) return {};
  const doc = JSON.parse(readFileSync(file, 'utf8')) as { trips?: Record<string, Record<string, string | BookingRef>> };
  return Object.fromEntries(
    Object.entries(doc.trips ?? {}).map(([folder, rows]) => [folder, Object.fromEntries(Object.entries(rows).map(([id, v]) => [id, typeof v === 'string' ? { ref: v } : v]))]),
  );
}

type Pages = Pick<PlaceBuild, 'refBySlug' | 'slugByRef' | 'byCaptureRef' | 'byName'>;
export interface EntryContext {
  root: string;
  world: World;
  pages: Pages;
}

const FOLDER_OF_SLUG = new Map(Object.entries(TRIP_SLUGS).map(([folder, slug]) => [slug, folder]));

/** The trip's stops and the base of each night as capture refs. A stop or base with no page, or a page with no record, is not a visit. */
export function tripPlaces(trip: PublicTrip, world: World, pages: Pages): TripPlaces {
  const refOfSlug = (slug: string | null): string | null => {
    const ref = slug ? pages.refBySlug.get(slug) : undefined;
    return ref ? primaryRef(world, ref) : null;
  };
  const stops = trip.days.flatMap((d) => d.items.flatMap((it) => {
    const ref = refOfSlug(it.placeSlug);
    return ref ? [{ day: d.n, ref }] : [];
  }));
  const nights = trip.bases.flatMap((b) => {
    const hit = pages.byName.get(normName(b.name));
    const ref = hit?.length === 1 ? refOfSlug(hit[0]!) : null;
    // night n is the night after day n; a base's `nights` can be fewer than its days (the departure day has none)
    return ref ? b.days.slice(0, b.nights).map((night) => ({ night, ref })) : [];
  });
  return { stops, nights };
}

const rowOrder = (a: CategoryItem, b: CategoryItem): number => (a.days[0] ?? 0) - (b.days[0] ?? 0) || (a.time ?? '').localeCompare(b.time ?? '') || a.name.localeCompare(b.name);

/** The derived rows that replace one legacy row (`requirementRows`, one row per ridden day when the record says so). Empty when the record is missing. */
function derivedRows(legacy: CategoryItem, ref: BookingRef, g: GraphIndex, world: World): CategoryItem[] {
  const rec = g.recs.get(primaryRef(world, ref.ref)) as unknown as Record<string, unknown> | undefined;
  if (!rec) return [];
  const park = protectedOf(g, primaryRef(world, ref.ref))[0];
  const rows = requirementRows(rec, {
    key: legacy.key,
    days: ref.days ?? legacy.days,
    name: legacy.name,
    park: park ? (g.recs.get(park)?.name ?? null) : null,
    ...(ref.note !== undefined ? { note: ref.note } : {}),
  });
  return rows.map((r) => ({
    key: r.key, category: 'logistics' as const, name: r.name, kind: legacy.kind, placeSlug: null, days: [...r.days], time: null, areaLabel: null, detail: null, nights: null,
    bookRule: r.bookRule, bookNote: r.bookNote, bookKind: r.bookKind ?? null, park: r.park ?? null, link: r.link ?? null,
  }));
}

/**
 * Fills `parks` and swaps the mapped legacy booking rows for derived ones, on every trip with days. Mutates the trips (the build's own copies,
 * before they are published). Returns what it did, for the build report and the tests.
 */
export function attachEntry(trips: readonly PublicTrip[], ctx: EntryContext): { parks: number; replaced: number; missing: string[] } {
  const g = graphOf(ctx.world);
  const refs = readBookingRefs(ctx.root);
  const out = { parks: 0, replaced: 0, missing: [] as string[] };
  for (const trip of trips) {
    if (trip.depth === 'overview') continue;
    const places = tripPlaces(trip, ctx.world, ctx.pages);
    const visits = parkVisits(g, places);
    trip.parks = tripParks(g, visits, { months: trip.season?.months, slugOf: (ref) => ctx.pages.slugByRef.get(ref) ?? null });
    out.parks += trip.parks.length;

    const mapped = refs[FOLDER_OF_SLUG.get(trip.slug) ?? ''] ?? {};
    const rows = trip.categories.logistics;
    for (const [id, ref] of Object.entries(mapped)) {
      const at = rows.findIndex((r) => r.key === `logistics:${id}`);
      if (at < 0) {
        out.missing.push(`${trip.slug}: no booking row "${id}"`);
        continue;
      }
      const next = derivedRows(rows[at]!, ref, g, ctx.world);
      if (!next.length) {
        out.missing.push(`${trip.slug}: no record behind "${id}"`);
        continue;
      }
      rows.splice(at, 1, ...next);
      out.replaced += 1;
    }
    rows.sort(rowOrder);
  }
  return out;
}
