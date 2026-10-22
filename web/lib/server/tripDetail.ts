import type { TripDetail } from '@travel/core/schema/api/index.ts';
import type { PublicTrip, PublicTripCard } from '@/lib/public';
import { Cites, convert } from './placeDetail';

/**
 * PublicTrip (the page model) plus its card's derived fields -> TripDetail (core/src/schema/api/trip.ts). Public trips cite no sourced
 * values, so only the points change: every base point gains `pointRole` and `approx` (case K16). `ref` is `trip/<slug>` (store.ts A4).
 */
export function tripDetailOf(trip: PublicTrip, card: PublicTripCard): TripDetail {
  const body = convert({ ...trip, tags: card.tags, lengthClass: card.lengthClass, fromHubs: card.fromHubs }, new Cites(new Set())) as Record<string, unknown>;
  return { ref: `trip/${trip.slug}`, ...body } as unknown as TripDetail;
}
