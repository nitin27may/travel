import { BadgeRow } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { TripRow } from '@/lib/data/types';
import { tripBadges } from '@/lib/entities/descriptors/trip';

/** Public trip card: the home page and the trips list share it. The whole card is the link. */
export function TripCard({ trip }: { trip: TripRow }) {
  return (
    <Card
      variant="publicTrip"
      data-past={trip.when === 'past' || undefined}
      photo={trip.img}
      fallbackIcon="calendar"
      fallbackLabel={trip.region}
      meta={[trip.dates, trip.duration].filter(Boolean).join(' · ')}
      title={
        trip.href ? (
          <a className="card-open" href={trip.href}>
            {trip.title}
          </a>
        ) : (
          trip.title
        )
      }
      chips={<BadgeRow badges={tripBadges(trip)} />}
      summary={trip.subtitle}
      footer={trip.region ? <span className="src">{trip.region}</span> : undefined}
    />
  );
}
