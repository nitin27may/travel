import { partyText } from '@travel/core/trips/partyWords.ts';
import { formatDate } from '@/lib/export/dates';
import './shell.css';

export interface SummaryOwnProps {
  start: string | null;
  end: string | null;
  days: number;
  adults: number;
  kids: number[];
  pace: string;
  changes: string;
  /** Show on the changes line: opens the changes sheet. */
  onShow?: () => void;
  /** The published trip's address and name, or null for a trip built from scratch. */
  ours: { href: string; title: string } | null;
}

/**
 * The Summary tab of the person's own trip (read mode). The published plan's Summary reads the whole catalogue trip; this one says what is
 * the person's: the dates, who is going, the pace and how the trip differs from ours, with the way back to our full plan.
 */
export function SummaryOwn({ start, end, days, adults, kids, pace, changes, onShow, ours }: SummaryOwnProps) {
  return (
    <section className="own-sum sum-sec" aria-labelledby="own-sum-h">
      <h2 id="own-sum-h" className="trip-kicker-h">Your trip</h2>
      <dl className="own-sum-grid">
        <div>
          <dt>Dates</dt>
          <dd>{start ? `${formatDate(start)}${end && end !== start ? ` to ${formatDate(end)}` : ''}` : 'Not set yet'}</dd>
        </div>
        <div>
          <dt>Length</dt>
          <dd>{days} {days === 1 ? 'day' : 'days'}</dd>
        </div>
        <div>
          <dt>Who is going</dt>
          <dd>{partyText({ adults, children: kids })}</dd>
        </div>
        <div>
          <dt>Pace</dt>
          <dd>{pace.charAt(0).toUpperCase() + pace.slice(1)}</dd>
        </div>
        {changes ? (
          <div>
            <dt>Your changes</dt>
            <dd>{changes}{onShow ? <> · <button type="button" className="own-link" onClick={onShow}>Show</button></> : null}</dd>
          </div>
        ) : null}
      </dl>
      {ours ? (
        <p>
          <a className="own-sum-link" href={ours.href}>See our full {ours.title} trip</a>
        </p>
      ) : null}
    </section>
  );
}
