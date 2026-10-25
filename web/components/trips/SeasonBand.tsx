import { Banner } from '@/components/ui/Banner';
import { Icon } from '@/components/ui/Icon';
import { SeasonStrip } from '@/components/ui/SeasonStrip';
import type { MonthState } from '@/components/ui/SeasonStrip';
import type { PublicTrip } from '@/lib/public/types';

/** "This plan is valid for" + the window, the reason, twelve months, weather tiles and warnings. Honest when the season is not set. */
export function SeasonBand({ trip }: { trip: PublicTrip }) {
  const s = trip.season;
  if (!s) {
    return (
      <section className="trip-season" aria-labelledby="season-h">
        <h2 id="season-h" className="trip-kicker-h">This plan is valid for</h2>
        <Banner kind="notice">The months this plan works in have not been written down, so check the season yourself before you pick dates.</Banner>
      </section>
    );
  }
  const planOnly = s.basis === 'plan';
  const months: MonthState[] = Array.from({ length: 12 }, (_, i) => (s.months.includes(i + 1) ? 'open' : 'closed'));
  const tiles = [
    { k: 'Temperature', v: s.weather.tempC },
    { k: 'Rain', v: s.weather.rain },
    { k: 'Daylight', v: s.weather.daylight },
  ].filter((t) => t.v);
  return (
    <section className="trip-season" aria-labelledby="season-h">
      <h2 id="season-h" className="trip-kicker-h">This plan is valid for</h2>
      <p className="trip-window">{s.label}</p>
      {planOnly ? <p className="trip-why">The window this plan was written for. Other months and opening dates have not been checked yet.</p> : null}
      <p className="trip-why">{s.why}</p>
      <SeasonStrip months={months} label={planOnly ? `Months this plan covers: ${s.months.map((m) => new Date(2000, m - 1, 1).toLocaleString('en', { month: 'long' })).join(', ')}` : undefined} />
      {tiles.length ? (
        <ul className="trip-weather">
          {tiles.map((t) => (
            <li key={t.k}>
              <p className="trip-weather-k">{t.k}</p>
              <p className="trip-weather-v">{t.v}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {s.weather.notes.length ? (
        <ul className="trip-warnings" aria-label="Worth knowing">
          {s.weather.notes.map((n) => (
            <li key={n}>
              <Icon name={planOnly ? 'info' : 'warn'} size={15} />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
