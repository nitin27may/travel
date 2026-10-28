import type { ReactNode } from 'react';
import { ageLabel } from '@/lib/format/age';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { imageSrcSet, sizedImage } from '@/lib/format/image';
import type { PublicTrip } from '@/lib/public/types';
import { driveLabel, lengthLabel } from './format';
import { TripActions } from './TripActions';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Cover (patterns 3.4): photo, kicker, title, standfirst, chips and actions; the glance strip overlaps its foot by 46 px. */
export function TripCover({ trip, url }: { trip: PublicTrip; url: string }) {
  const drive = driveLabel(trip.driveAvgMin, true);
  const glance: { k: string; v: string; title?: string }[] = [
    { k: 'Length', v: lengthLabel(trip.nights, trip.daysCount) },
    ...(trip.bases.length ? [{ k: 'Bases', v: `${trip.bases.length} ${trip.bases.length === 1 ? 'base' : 'bases'}` }] : []),
    ...(drive ? [{ k: 'Drive a day', v: `${drive} on average`, title: 'Estimated: a straight line scaled to a road time' }] : []),
    { k: trip.season?.basis === 'plan' ? 'Planned for' : 'Best time', v: trip.season?.label ?? 'Season not set yet' },
  ];
  return (
    <header className="trip-head">
      <div className="trip-cover">
        {trip.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- static export, remote Commons URLs
          <img className="trip-cover-img" src={sizedImage(trip.cover.url, 960)} srcSet={imageSrcSet(trip.cover.url)} sizes="100vw" alt="" width={960} height={540} loading="eager" fetchPriority="high" decoding="async" />
        ) : (
          <div className="trip-cover-fallback" aria-hidden="true">
            <Icon name="mountain" size={48} />
          </div>
        )}
        <div className="trip-cover-scrim" aria-hidden="true" />
        <div className="trip-cover-text">
          <p className="trip-kicker">
            {trip.depth === 'overview' ? 'Overview' : 'Published plan'} &middot; {trip.region}
          </p>
          <h1 className="trip-title">{trip.title}</h1>
          <p className="trip-standfirst">{trip.subtitle}</p>
          <ul className="trip-chips" aria-label="About this plan">
            {trip.effort ? (
              <li>
                <Chip kind="neutral" icon="mountain">{cap(trip.effort)}</Chip>
              </li>
            ) : null}
            {trip.ageFit !== null ? (
              <li>
                <Chip kind="neutral" icon="user">{ageLabel('fit', trip.ageFit)}</Chip>
              </li>
            ) : null}
            <li>
              <Chip kind="neutral" icon={false}>by Nitin</Chip>
            </li>
            {trip.honesty.map((h) => (
              <li key={h.id}>
                <Chip kind="honest" title={h.reason}>{h.label}</Chip>
              </li>
            ))}
          </ul>
          <TripActions slug={trip.slug} title={trip.title} nights={trip.nights ?? 0} days={trip.daysCount ?? 0} url={url} hasDays={trip.depth !== 'overview'} seasonMonths={trip.season?.months} photo={trip.cover ? sizedImage(trip.cover.url, 320) : null} />
        </div>
      </div>
      <dl className="trip-glance">
        {glance.map((g) => (
          <div key={g.k} title={g.title}>
            <dt>{g.k}</dt>
            <dd>{g.v}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}


/** What a person's own trip adds to the cover (STEP2-T1; step2 README 4.1): their words in place of the published plan's, and their actions. */
export interface OwnCoverProps {
  /** "Your copy · from our Canadian Rockies trip" */
  kicker: ReactNode;
  title: string;
  /** A same-origin photo path, or null for the fallback. */
  photo: string | null;
  /** One line under the title: the dates and who is going. */
  standfirst: string;
  /** Neutral chips: the changes from our plan. */
  chips: string[];
  glance: { k: string; v: string }[];
  /** The state line under the chips: the sync word and the changes (a node, so it can hold the Retry button). */
  state: ReactNode;
  /** `TripActions` in its own-trip variant. */
  actions: ReactNode;
}

/**
 * The same cover as the published plan's (same frame, photo, scrim, glance strip), fed by the person's trip: `/t/<id>/`. Nothing here
 * is about our plan's authorship or honesty labels; those stay on the public page.
 */
export function OwnCover({ kicker, title, photo, standfirst, chips, glance, state, actions }: OwnCoverProps) {
  return (
    <header className="trip-head" data-own="">
      <div className="trip-cover">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- the build's own rendition, same as the public cover
          <img className="trip-cover-img" src={sizedImage(photo, 960)} srcSet={imageSrcSet(photo)} sizes="100vw" alt="" width={960} height={540} loading="eager" fetchPriority="high" decoding="async" />
        ) : (
          <div className="trip-cover-fallback" aria-hidden="true">
            <Icon name="mountain" size={48} />
          </div>
        )}
        <div className="trip-cover-scrim" aria-hidden="true" />
        <div className="trip-cover-text">
          <p className="trip-kicker">{kicker}</p>
          <h1 className="trip-title">{title}</h1>
          <p className="trip-standfirst">{standfirst}</p>
          {chips.length ? (
            <ul className="trip-chips" aria-label="About your trip">
              {chips.map((c) => (
                <li key={c}>
                  <Chip kind="neutral" icon={false}>{c}</Chip>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="own-state">{state}</div>
          {actions}
        </div>
      </div>
      <dl className="trip-glance">
        {glance.map((g) => (
          <div key={g.k}>
            <dt>{g.k}</dt>
            <dd>{g.v}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
