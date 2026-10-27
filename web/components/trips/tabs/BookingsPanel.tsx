import { bookAheadText } from '@travel/core/export/bookings.ts';
import type { ExportBooking } from '@travel/core/export/types.ts';
import { groupBookings, bookingsSummary, pricesLine, safeLink } from './bookingGroups';

function Row({ b, placeSlug }: { b: ExportBooking; placeSlug: string | null }) {
  const href = safeLink(b.link);
  return (
    <li className="bk-row" data-kind={b.kind}>
      <p className="bk-name">
        {placeSlug ? <a className="bk-place" href={`/places/${placeSlug}/`}>{b.name}</a> : b.name}
        {b.park ? <span className="bk-park">{b.park}</span> : null}
      </p>
      <div className="bk-when">
        {b.rule ? <p className="bk-rule">{b.rule}</p> : null}
        {b.note ? <p className="bk-text">{b.note}</p> : null}
        {!b.rule && !b.note ? <p className="bk-text">{bookAheadText(b) || 'No window is written down yet.'}</p> : null}
      </div>
      {b.day !== null || href ? (
        <div className="bk-foot">
          {b.day !== null ? (
            <p className="bk-day num">
              <a href={`?view=day#day-${b.day}`} data-tab-link="">Day {b.day}</a>
            </p>
          ) : null}
          {href ? (
            <p className="bk-link">
              <a href={href} target="_blank" rel="noopener noreferrer">
                Booking page<span className="sr-only"> for {b.name} (opens in a new tab)</span>
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * The Bookings tab (spec 3.6, UXB-6): the export model's rows by kind (to book ahead, passes, checks, tasks), each with its window in the
 * page's words (`bookRuleText`), its note, its day, its place page when the row has one and the official link when the contract carries
 * one. "N to book ahead" is `bookingCounts().toBook`: a check or a task is listed and never counted. No filter row (UXB-N, P1: 12 rows or
 * fewer). Server-rendered, so it prints and reads without script.
 */
export function BookingsPanel({ bookings, placeSlugs = {} }: { bookings: readonly ExportBooking[]; placeSlugs?: Readonly<Record<string, string>> }) {
  const groups = groupBookings(bookings);
  const prices = pricesLine(bookings);
  return (
    <section className="trip-sec bk-panel" aria-labelledby="bk-h">
      <h2 id="bk-h" className="trip-h">Bookings</h2>
      <p className="trip-sec-note" data-testid="bk-summary">{bookingsSummary(bookings)}.</p>
      {groups.length === 1 && groups[0]!.note ? <p className="trip-sec-note bk-solo-note">{groups[0]!.note}</p> : null}
      {groups.map((g) => (
        <section key={g.kind} className="bk-group" data-group={g.kind} aria-labelledby={`bk-g-${g.kind}`}>
          {groups.length > 1 ? (
            <>
              <h3 id={`bk-g-${g.kind}`} className="bk-group-h">
                {g.heading} <span className="bk-group-n num">{g.rows.length}</span>
              </h3>
              {g.note ? <p className="bk-group-note">{g.note}</p> : null}
            </>
          ) : (
            <h3 id={`bk-g-${g.kind}`} className="sr-only">{g.heading}</h3>
          )}
          <ol className="bk-list">
            {g.rows.map((b) => <Row key={b.ref} b={b} placeSlug={placeSlugs[b.ref] ?? null} />)}
          </ol>
        </section>
      ))}
      {prices ? <p className="bk-prices">{prices}</p> : null}
    </section>
  );
}
