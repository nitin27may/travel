// The server's side of the trip's shape: one call from the trip page. Server only (it reads the public trip through the Summary adapter).
import { shapeFacts } from '@/lib/public/summary';
import type { PublicPlace, PublicTrip } from '@/lib/public/types';
import type { ShapeFacts } from './shapeTypes';

/** The shape's facts for a trip with days; null on an overview trip or a trip with no schedule (the Summary then draws no shape: P4). */
export function shapeFactsFor(trip: PublicTrip, lookup: (slug: string) => PublicPlace | null): ShapeFacts | null {
  if (!trip.schedule || trip.depth === 'overview' || trip.days.length < 1) return null;
  const facts = shapeFacts(trip, lookup);
  const planned: Record<number, number> = {};
  for (const d of trip.days) if (d.driveMin !== null) planned[d.n] = d.driveMin;
  return {
    bases: trip.bases.map((b) => ({ name: b.name, nights: b.nights, days: [...b.days] })),
    planned,
    bookingDays: facts.bookingDays.filter((d): d is number => d !== null),
    highlightSlugs: facts.highlightSlugs,
    highlightVersions: facts.highlightVersions,
  };
}
