import type { TripSummary } from '@travel/core/trips/summary.ts';
import type { PublicPlace, PublicTrip } from '@/lib/public/types';
import type { HighlightCard } from './Summary';

/**
 * The highlight cards from the Summary model: the name, kind and own photo come from the place's card (the model carries slugs only,
 * P8), a gallery photo from the index the model chose, and no photo at all when neither exists ("No licensed photo yet").
 */
export function highlightCards(trip: Pick<PublicTrip, 'gallery'>, summary: Pick<TripSummary, 'highlights'>, lookup: (slug: string) => PublicPlace | null): HighlightCard[] {
  return summary.highlights.map((h) => {
    const place = h.slug ? lookup(h.slug) : null;
    const photo = h.photo === 'place' ? place?.photo : typeof h.photo === 'number' ? trip.gallery[h.photo] : null;
    return { slug: h.slug, name: h.slug === null ? h.name : (place?.name ?? h.slug), kind: place?.kind ?? null, days: h.days, photoUrl: photo?.url ?? null };
  });
}
