import type { ReactNode } from 'react';
import type { ExportBooking } from '@travel/core/export/types.ts';
import { summaryLead, versionsText, type TripSummary } from '@travel/core/trips/summary.ts';
import { Icon } from '@/components/ui/Icon';
import { KindGlyph } from '@/components/ui/KindGlyph';
import { ageLabel } from '@/lib/format/age';
import { imageSrcSet, sizedImage } from '@/lib/format/image';
import type { PublicTrip } from '@/lib/public/types';
import { ParkLines } from './ParkLines';
import { countCards, dayWords, highlightsAtRest, knowBeforeYouGo, type LinkTabs } from './text';

/** A highlight with the facts its card needs, read by the page from the place's own card (the Summary payload carries slugs only: P8). */
export interface HighlightCard {
  slug: string | null;
  name: string;
  kind: string | null;
  days: number[];
  photoUrl: string | null;
}

const MORE_AT = 8;
/** On a phone the highlights show 4 at rest, the other four behind "Show 4 more" (components 3.7). */
const PHONE_AT_REST = 4;
const LEAD_CLAMP_CHARS = 110;

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** The lead, the count cards and the highlights: everything above "When to go" (spec 3.5, W2). Server-rendered; every link is a real `<a>`. */
export function SummaryTop({ trip, summary, link, highlights, galleryGroups }: { trip: PublicTrip; summary: TripSummary; link: LinkTabs; highlights: HighlightCard[]; galleryGroups: number }) {
  const lead = summaryLead(summary);
  const cards = countCards(summary, link, galleryGroups);
  const shown = highlightsAtRest(highlights, MORE_AT);
  const extra = Math.max(0, Math.min(shown.length, MORE_AT) - PHONE_AT_REST);
  return (
    <>
      <section className="sum-sec sum-lead" aria-labelledby="sum-lead-h">
        <h2 id="sum-lead-h" className="trip-kicker-h">What you will do</h2>
        {lead.length > LEAD_CLAMP_CHARS ? <input type="checkbox" id="sum-lead-more" className="sum-toggle sr-only" aria-label="Show the whole summary" /> : null}
        <p className="sum-lead-text">{lead}</p>
        {lead.length > LEAD_CLAMP_CHARS ? (
          <label htmlFor="sum-lead-more" className="sum-more-label" data-print="hide">
            <span className="sum-more-off">More</span>
            <span className="sum-more-on">Less</span>
          </label>
        ) : null}
        {trip.subtitle ? <p className="sum-standfirst">{trip.subtitle}</p> : null}
      </section>

      {cards.length ? (
        <ul className="sum-cards" aria-label="The trip in numbers" data-count={cards.length}>
          {cards.map((c) => {
            const body = (
              <>
                <span className="sum-card-body">
                  <span className="sum-card-v">{c.value}</span>
                  {c.sub ? <span className="sum-card-sub">{c.sub}</span> : null}
                </span>
                {c.href ? <Icon name="chevronRight" size={16} /> : null}
              </>
            );
            return (
              <li key={c.key} className="sum-card-li">
                {c.href ? (
                  <a className="sum-card" href={c.href} data-tab-link={c.href.startsWith('?') ? '' : undefined} data-card={c.key}>
                    {body}
                  </a>
                ) : (
                  <div className="sum-card" data-card={c.key}>
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {shown.length ? (
        <section className="sum-sec" aria-labelledby="sum-hl-h">
          <div className="sum-sec-head">
            <h2 id="sum-hl-h" className="trip-kicker-h">Highlights</h2>
            <p className="sum-sec-note">
              {summary.flags.days ? `${summary.counts.highlights} ${summary.counts.highlights === 1 ? 'place' : 'places'} worth the journey` : `${shown.length} places in the gallery`}
            </p>
          </div>
          {extra > 0 ? <input type="checkbox" id="sum-hl-more" className="sum-toggle sr-only" aria-label={`Show ${extra} more highlights`} /> : null}
          <ul className="sum-hl-grid">
            {shown.map((h, i) => (
              <HighlightItem key={h.slug ?? h.name} h={h} extra={i >= PHONE_AT_REST} />
            ))}
          </ul>
          {extra > 0 ? (
            <label htmlFor="sum-hl-more" className="sum-more-label sum-hl-more" data-print="hide">
              <span className="sum-more-off">Show {extra} more</span>
              <span className="sum-more-on">Show fewer</span>
            </label>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function HighlightItem({ h, extra }: { h: HighlightCard; extra: boolean }) {
  const w = dayWords(h.days);
  return (
    <li className="sum-hl" data-extra={extra || undefined}>
      <div className="sum-hl-photo">
        {h.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- static renditions; the name below is the label
          <img src={sizedImage(h.photoUrl, 320)} srcSet={imageSrcSet(h.photoUrl)} sizes="(max-width: 639px) 46vw, 280px" alt="" width={320} height={240} loading="lazy" decoding="async" />
        ) : (
          <span className="sum-hl-none">
            <KindGlyph kind={h.kind ?? 'place'} size="md" />
            <span>No licensed photo yet</span>
          </span>
        )}
      </div>
      <h3 className="sum-hl-name">{h.slug ? <a className="sum-hl-link" href={`/places/${h.slug}/`}>{h.name}</a> : h.name}</h3>
      {h.days.length ? (
        <p className="sum-hl-days num">
          {w.days.map((d) => (
            <span key={d.n}>
              <a href={`?view=day#day-${d.n}`} data-tab-link="" aria-label={`Day ${d.n}, ${h.name}`}>Day {d.n}</a>
              {d.sep}
            </span>
          ))}
        </p>
      ) : null}
    </li>
  );
}

/** Who it suits and Know before you go, the foot of the Summary (spec 3.5). Safety lines stay at rest. */
export function SummaryBottom({ trip, summary, bookings, parkPages = [] }: { trip: PublicTrip; summary: TripSummary; bookings: readonly ExportBooking[]; parkPages?: readonly string[] }) {
  const suits: string[] = [
    ...(trip.effort ? [cap(trip.effort)] : []),
    ...(trip.ageFit !== null ? [ageLabel('fit', trip.ageFit)] : []),
  ];
  const versions = versionsText(summary.versions);
  const know = knowBeforeYouGo(bookings);
  const parks = trip.parks ?? [];
  const hasFoot = suits.length > 0 || !!versions || know.atRest.length > 0;
  if (!hasFoot && !parks.length) return null;
  const line = (l: { name: string; text: string }) => (
    <li key={`${l.name}:${l.text}`}>
      <b>{l.name}.</b> {l.text}
    </li>
  );
  return (
    <>
      <ParkLines parks={parks} linkable={parkPages} />
      {hasFoot ? (
        <div className="sum-foot">
          {suits.length || versions ? (
            <section className="sum-sec" aria-labelledby="sum-suits-h">
              <h2 id="sum-suits-h" className="trip-kicker-h">Who it suits</h2>
              {suits.length ? <p className="sum-suits num">{suits.join(' · ')}</p> : null}
              {versions ? <p className="sum-suits-note">{cap(versions)}</p> : null}
            </section>
          ) : null}
          {know.atRest.length ? (
            <section className="sum-sec" aria-labelledby="sum-know-h">
              <h2 id="sum-know-h" className="trip-kicker-h">Know before you go</h2>
              <ul className="sum-know">{know.atRest.map(line)}</ul>
              {know.more.length ? (
                <details className="sum-know-more">
                  <summary>{know.more.length} more</summary>
                  <ul className="sum-know">{know.more.map(line)}</ul>
                </details>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/** What the Summary slots hold, for the page (server) to pass to the tab shell. */
export interface SummarySlots {
  top: ReactNode;
  bottom: ReactNode;
}
