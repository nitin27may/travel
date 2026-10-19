import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { kindIcon } from '@/components/ui/Icon';
import type { PublicPlaceCard, PublicTripCard } from '@/lib/public';

/** Honesty chips that say how deep a trip page goes. */
const DEPTH_IDS = new Set(['condensed', 'overview_only']);

/** Notes from the research store that must never reach a public card. */
const INTERNAL = /\.(md|json|py|html|txt)\b|\bmd\b|\bpost\b|\bstop \d+|\bplan\b|\bloose line\b|\bGAP\b|\bTODO\b|\bINFERENCE\b/i;

/** The place's own summary when it reads as public text; otherwise its kind and area. */
export function publicSummary(p: Pick<PublicPlaceCard, 'summary' | 'kindLabel' | 'areaLabel'>): string {
  const s = p.summary.trim();
  return s && !INTERNAL.test(s) ? s : [p.kindLabel, p.areaLabel].filter(Boolean).join(' in ');
}

export function HomeTripCard({ trip, priority }: { trip: PublicTripCard; priority?: boolean }) {
  const meta = [trip.daysCount ? `${trip.daysCount} days` : null, trip.region].filter(Boolean).join(' · ');
  return (
    <Card
      variant="publicTrip"
      priority={priority}
      photo={trip.cover?.url ?? null}
      fallbackIcon="route"
      fallbackLabel={trip.region}
      meta={meta}
      title={
        <Link className="card-open" href={`/trips/${trip.slug}/`}>
          {trip.title}
        </Link>
      }
      chips={
        <ul className="badge-row" aria-label="Details">
          <li>
            <Chip kind="neutral" icon="calendar" title={trip.season?.why}>
              {trip.season ? trip.season.label : 'Season not set yet'}
            </Chip>
          </li>
          {trip.honesty
            .filter((h) => DEPTH_IDS.has(h.id))
            .map((h) => (
              <li key={h.id}>
                <Chip kind="honest" title={h.reason}>{h.label}</Chip>
              </li>
            ))}
        </ul>
      }
      summary={trip.subtitle}
    />
  );
}

export function HomePlaceCard({ place }: { place: PublicPlaceCard }) {
  const cc = place.areaChain[0]?.slug;
  const level = place.completeness.level;
  return (
    <Card
      variant="place"
      photo={place.photo?.url ?? null}
      fallbackIcon={kindIcon(place.kind)}
      fallbackLabel={place.kindLabel}
      meta={place.areaLabel}
      title={
        <Link className="card-open" href={`/places/${place.slug}/`}>
          {place.name}
        </Link>
      }
      chips={
        <ul className="badge-row" aria-label="Details">
          <li>
            <Chip kind="kind" icon={false}>{place.kindLabel}</Chip>
          </li>
          <li>
            <Chip kind={level === 'complete' ? 'ok' : level === 'draft' ? 'honest' : 'neutral'} icon={level === 'draft' ? 'warn' : false} title={place.completeness.tooltip}>
              {place.completeness.label}
            </Chip>
          </li>
        </ul>
      }
      summary={publicSummary(place)}
      footer={
        <>
          <span className="src">{place.honesty.some((h) => h.id === 'no_source') ? 'No source yet' : ''}</span>
          <span className="card-links">
            <Link href={`/places/${place.slug}/`}>Place page</Link>
            {cc ? <Link href={`/globe/${cc}/`}>Globe</Link> : null}
          </span>
        </>
      }
    />
  );
}
