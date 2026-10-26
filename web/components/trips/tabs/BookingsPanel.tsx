import { bookAheadText } from '@travel/core/export/bookings.ts';
import type { ExportBooking } from '@travel/core/export/types.ts';

/**
 * The Bookings tab: every booking of the trip, by day, with its window or its note (spec 3.6). This is the shell UXB-6 completes (grouping,
 * the prices line, links to the stop); the rows are the export model's `bookings`, the list the print and the CSV use. Server-rendered.
 */
export function BookingsPanel({ bookings }: { bookings: readonly ExportBooking[] }) {
  const dated = bookings.filter((b) => b.rule).length;
  return (
    <section className="trip-sec bk-panel" aria-labelledby="bk-h">
      <h2 id="bk-h" className="trip-h">Bookings</h2>
      <p className="trip-sec-note">
        {bookings.length} to book ahead{dated === 0 ? ', none with a published opening date yet' : `, ${dated} with a published opening date`}.
      </p>
      <ol className="bk-list">
        {bookings.map((b) => (
          <li key={b.ref} className="bk-row">
            <p className="bk-name">{b.name}</p>
            {bookAheadText(b) ? <p className="bk-text">{bookAheadText(b)}</p> : null}
            {b.day !== null ? (
              <p className="bk-day num">
                <a href={`?view=day#day-${b.day}`} data-tab-link="">Day {b.day}</a>
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
