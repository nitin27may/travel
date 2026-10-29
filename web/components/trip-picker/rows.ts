// The trip picker's rows (STEP2-P1; gap-analysis 2.4, patterns 3.9): pure functions over Mine's stored copies. Nothing here fetches a
// document (P8, P9): the day a place already has in a copy comes from the copy's own `added` list and the device edits, and "Best day"
// is worked out by the add picker the row opens, which holds the trip.
import type { CopyItem } from '@travel/core/schema/copies.ts';
import { readDeviceEnvelope } from '@/lib/trip-edit/deviceStore';
import { tripHref } from '@/lib/trip-edit/keys';
import { groupRows, type RowModel } from '@/lib/mine/rows';
import type { StorageLike } from '@travel/core/schema/copies.ts';

/** The trip's own address with the add picker open on this place or park (edit-mode-spec 7.4). */
export const addHref = (id: string, slug: string): string => tripHref(id, `edit=1&add=${encodeURIComponent(slug)}`);

/** The day the person has already put this place on in one copy, from the copy's `added` list and the device edits (numbered days only). */
export function dayOfPlace(c: CopyItem, slug: string, device: ReturnType<typeof readDeviceEnvelope> | null = null): number | null {
  const own = c.added.find((a) => a.placeSlug === slug);
  if (own) return own.day;
  const entry = device?.items[c.id] as { added?: { day: unknown; ref: unknown }[] } | undefined;
  const hit = Array.isArray(entry?.added) ? entry.added.find((a) => typeof a.day === 'number' && typeof a.ref === 'string' && (a.ref === slug || a.ref.endsWith(`/${slug}`))) : undefined;
  return hit ? (hit.day as number) : null;
}

export interface PickRowModel {
  row: RowModel;
  /** the add picker's address for this copy */
  href: string;
  /** the day the place is on already, or null */
  on: number | null;
}

/** Upcoming, No date, then Past (Mine's order); every copy once. */
export function pickRows(items: readonly CopyItem[], slug: string, today: string, storage: StorageLike | null = null): PickRowModel[] {
  const g = groupRows(items, today);
  const device = storage ? readDeviceEnvelope(storage) : null;
  return [...g.upcoming, ...g.nodate, ...g.past].map((row) => ({ row, href: addHref(row.item.id, slug), on: dayOfPlace(row.item, slug, device) }));
}

export interface InLine {
  id: string;
  title: string;
  /** the day, when the copy names it */
  day: number | null;
}

/**
 * The "In your trips" lines: a copy that holds the place on a day (exact), then a copy of a public trip that uses it (its day is the
 * public plan's, so the line says the copy may differ). Never a document.
 */
export function inYourTrips(items: readonly CopyItem[], slug: string, publicTripSlugs: readonly string[], storage: StorageLike | null = null): InLine[] {
  const device = storage ? readDeviceEnvelope(storage) : null;
  const out: InLine[] = [];
  for (const c of items) {
    const day = dayOfPlace(c, slug, device);
    if (day !== null || publicTripSlugs.includes(c.slug)) out.push({ id: c.id, title: c.title, day });
  }
  return out.sort((a, b) => Number(b.day !== null) - Number(a.day !== null));
}
