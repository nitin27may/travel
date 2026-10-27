import { Banner } from '@/components/ui/Banner';
import { Icon } from '@/components/ui/Icon';
import type { Season } from '@/lib/public/types';
import type { TripWeather, WeatherKind, WeatherLinkRow } from '@/lib/public/weatherLinks';
import '@/styles/when-to-go.css';
import { MonthStrip } from './MonthStrip';
import { cards, hero, monthStates, notesOf } from './whenModel';

const ROW_LEAD: Record<WeatherKind, string> = { forecast: 'Forecast', climate: 'Climate averages', mountain: 'Mountain weather', aurora: 'Aurora' };
/** Forecast and climate are the rows a visitor came for; mountain and aurora sit under them, smaller (6.4 update, 26 Oct). */
const PRIMARY: readonly WeatherKind[] = ['forecast', 'climate'];
const SECONDARY: readonly WeatherKind[] = ['mountain', 'aurora'];

/**
 * "When to go" in the Summary (spec 6.2, W4; UXF-7 to UXF-10): the best-time hero, the month strip, four equal cards, the other-weeks line,
 * the worth-knowing notes and the links out to the national weather services. Server-rendered; no client JS, and no weather call (Q298): the
 * links are the only way out, and each opens in a new tab with its publisher named. Honest where the data is thin: a plan's own window is not
 * "best", crowds say "Not checked yet", and a trip with no season says so.
 */
export function WhenToGo({ season, weather }: { season: Season | null; weather: TripWeather | null }) {
  return (
    <section className="sum-sec wtg" id="when-to-go" aria-labelledby="wtg-h">
      <h2 id="wtg-h" className="trip-kicker-h">When to go</h2>
      {season ? <SeasonBlock s={season} /> : <Banner kind="notice">The months this plan works in have not been written down, so check the season yourself before you pick dates.</Banner>}
      {weather ? <Weather w={weather} /> : null}
    </section>
  );
}

function SeasonBlock({ s }: { s: Season }) {
  const h = hero(s);
  const states = monthStates(s);
  const cs = cards(s.weather);
  const written = cs.some((c) => c.key !== 'crowds' && c.value);
  const notes = notesOf(s.weather.notes);
  const advice = notes.filter((n) => n.kind === 'info').length;
  const hazards = notes.length - advice;
  return (
    <>
      <div className="wtg-hero">
        <p className="wtg-kick">{h.kicker}</p>
        <p className="wtg-window">{h.window}</p>
        {h.sentence ? <p className="wtg-why">{h.sentence}</p> : null}
        {h.basisNote ? (
          <p className="wtg-basis">
            <Icon name="info" size={15} />
            <span>{h.basisNote}</span>
          </p>
        ) : null}
      </div>

      <MonthStrip states={states} />

      {written ? (
        <ul className="wtg-cards" aria-label="Weather and crowds at that time">
          {cs.map((c) => (
            <li key={c.key} className="wtg-card" data-card={c.key}>
              <p className="wtg-card-k">{c.label}</p>
              {c.value ? <p className="wtg-card-v">{c.value}</p> : <p className="wtg-card-v"><span className="wtg-gap">Not checked yet</span></p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="wtg-line"><span className="wtg-gap">Not checked yet</span> Temperature, rain, daylight and crowds for this trip.</p>
      )}

      <div className="wtg-sub">
        <h3 className="wtg-h3">Other weeks that work</h3>
        <p className="wtg-line wtg-quiet">Other weeks have not been researched yet.</p>
      </div>

      {notes.length ? (
        <div className="wtg-sub">
          <h3 className="wtg-h3">Worth knowing</h3>
          {advice > 0 ? <input type="checkbox" id="wtg-notes-more" className="sum-toggle sr-only" aria-label={hazards ? `Show ${advice} more notes` : `Show ${advice} ${advice === 1 ? 'note' : 'notes'}`} /> : null}
          <ul className="wtg-notes">
            {notes.map((n) => (
              <li key={n.text} data-kind={n.kind} data-extra={n.kind === 'info' || undefined}>
                <Icon name={n.kind === 'warn' ? 'warn' : 'info'} size={15} />
                <span>
                  {n.kind === 'warn' ? <span className="sr-only">Closure or hazard: </span> : null}
                  {n.text}
                </span>
              </li>
            ))}
          </ul>
          {advice > 0 ? (
            <label htmlFor="wtg-notes-more" className="sum-more-label wtg-more" data-print="hide">
              <span className="sum-more-off">{hazards ? `Show ${advice} more` : `Show ${advice} ${advice === 1 ? 'note' : 'notes'}`}</span>
              <span className="sum-more-on">Show fewer</span>
            </label>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

const rowsOf = (links: readonly WeatherLinkRow[], kinds: readonly WeatherKind[]) => kinds.map((k) => ({ kind: k, links: links.filter((l) => l.kind === k) })).filter((r) => r.links.length);

function Weather({ w }: { w: TripWeather }) {
  return (
    <div className="wtg-sub wtg-wx" data-print="hide">
      <h3 className="wtg-h3" id="wtg-wx-h">Weather</h3>
      <p className="wtg-note">The weather services&apos; own pages, in a new tab. Nothing is sent from this page.</p>
      <ul className="wtg-srcs" aria-labelledby="wtg-wx-h">
        {w.sources.map((src) => (
          <li key={src.name} className="wtg-src">
            <p className="wtg-src-n">{src.name}</p>
            {rowsOf(src.links, PRIMARY).map((r) => (
              <Row key={r.kind} src={src.name} kind={r.kind} links={r.links} />
            ))}
            {rowsOf(src.links, SECONDARY).map((r) => (
              <Row key={r.kind} src={src.name} kind={r.kind} links={r.links} secondary />
            ))}
          </li>
        ))}
      </ul>
      {w.partial ? <p className="wtg-note">Not every base has its own forecast page yet.</p> : null}
    </div>
  );
}

function Row({ src, kind, links, secondary }: { src: string; kind: WeatherKind; links: WeatherLinkRow[]; secondary?: boolean }) {
  return (
    <div className="wtg-row" data-secondary={secondary || undefined}>
      <p className="wtg-row-k">{ROW_LEAD[kind]}</p>
      <ul className="wtg-links">
        {links.map((l) => (
          <li key={l.href}>
            <a className="wtg-link" href={l.href} target="_blank" rel="noopener noreferrer">
              <span>{l.text}</span>
              {l.language ? <span className="wtg-lang">{l.language}</span> : null}
              <span className="sr-only">{`${ROW_LEAD[kind].toLowerCase()}, ${src}${l.language ? `, page in ${l.language}` : ''}, opens in a new tab`}</span>
              <Icon name="external" size={14} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
