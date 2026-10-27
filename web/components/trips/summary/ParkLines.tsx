import type { TripPark } from '@travel/core/schema/api/trip.ts';

/**
 * The park line of each park or zone the trip enters (protected-area-entry 6.2, 6.4; PA-W): "Banff National Park, days 3 to 6 and 9 to 11:
 * entry fee each day, or the Discovery Pass covers it (also Jasper, Yoho and Kootenay on this trip)". The sentence is core's (`tripParks`),
 * so the Summary, the print and the API say one thing. A park nobody has checked says so ("Entry not checked yet for ...", T3: no guess);
 * a saving line shows only when core found comparable prices (QP5). `linkable` are the park slugs that have a page here.
 */
export function ParkLines({ parks, linkable = [] }: { parks: readonly TripPark[]; linkable?: readonly string[] }) {
  if (!parks.length) return null;
  return (
    <section className="sum-sec" aria-labelledby="sum-parks-h" data-testid="park-lines">
      <h2 id="sum-parks-h" className="trip-kicker-h">Park entry</h2>
      <ul className="sum-parks">
        {parks.map((p) => {
          const rest = p.line.startsWith(p.name) ? p.line.slice(p.name.length) : null;
          const name = p.slug && linkable.includes(p.slug) ? <a className="sum-park-link" href={`/places/${p.slug}/`}>{p.name}</a> : p.name;
          return (
            <li key={`${p.slug ?? p.name}`} className="sum-park" data-state={p.state}>
              <p className="sum-park-line">
                {rest !== null ? (
                  <>
                    <b>{name}</b>
                    {rest}
                  </>
                ) : (
                  p.line
                )}
              </p>
              {p.saving ? <p className="sum-park-saving">{p.saving}.</p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
