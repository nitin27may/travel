import { BadgeRow } from '@/components/ui/Badge';
import { EntityImage } from '@/components/ui/EntityImage';
import type { TripRow } from '@/lib/data/types';
import { tripBadges } from '@/lib/entities/descriptors/trip';

/** Image card for a trip: the home page and the trips list share it. The whole card is the link. */
export function TripCard({ trip }: { trip: TripRow }) {
  return (
    <article className="card" data-past={trip.when === 'past' || undefined}>
      <div className="card-media">
        <EntityImage src={trip.img} width={720} fallbackIcon="calendar" fallbackLabel={trip.region} />
      </div>
      <div className="card-body">
        <p className="card-sub">{[trip.dates, trip.duration].filter(Boolean).join(', ')}</p>
        <h3 className="card-title">
          {trip.href ? (
            <a className="card-open" href={trip.href}>
              {trip.title}
            </a>
          ) : (
            trip.title
          )}
        </h3>
        <BadgeRow badges={tripBadges(trip)} />
        {trip.subtitle ? <p className="card-note">{trip.subtitle}</p> : null}
        {trip.region ? <p className="card-foot card-sub">{trip.region}</p> : null}
      </div>
    </article>
  );
}
