import { Banner } from '@/components/ui/Banner';
import { Icon } from '@/components/ui/Icon';
import type { Season } from '@/lib/public/types';
import type { TripWeather, WeatherKind, WeatherLinkRow } from '@/lib/public/weatherLinks';
import type { TripWindows, WindowRow } from '@/lib/public/windows';
import '@/styles/when-to-go.css';
import { MonthStrip } from './MonthStrip';
import { VERDICT_WORD, cards, crowdsCard, goodMonths, hero, monthStates, notesOf, otherWeeks } from './whenModel';

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
export function WhenToGo({ season, weather, windows = null }: { season: Season | null; weather: TripWeather | null; windows?: TripWindows | null }) {
  const h = season ? hero(season) : null;
  return (
    <section className="sum-sec wtg" id="when-to-go" aria-labelledby="wtg-h">
      <div className="wtg-head">
        <h2 id="wtg-h" className="trip-kicker-h">When to go</h2>
        {h ? (
          <>
            <span className="wtg-dot" aria-hidden="true">&nbsp;&middot;</span>{' '}
            <p className="wtg-kick">{h.kicker}</p>
          </>
        ) : null}
      </div>
      {season && h ? <SeasonBlock s={season} h={h} windows={windows} /> : <Banner kind="notice">The months this plan works in have not been written down, so check the season yourself before you pick dates.</Banner>}
      {weather ? <Weather w={weather} /> : null}
    </section>
  );
}

function SeasonBlock({ s, h, windows }: { s: Season; h: ReturnType<typeof hero>; windows: TripWindows | null }) {
  const rows = windows?.rows ?? [];
  const states = monthStates(s, goodMonths(rows));
  const cs = cards(s.weather, crowdsCard(rows));
  const others = otherWeeks(rows);
  const written = cs.some((c) => c.key !== 'crowds' && c.value);
  const notes = notesOf(s.weather.notes);
  const folded = notes.filter((n) => n.fold).length;
  return (
    <>
      <div className="wtg-hero">
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
              {c.value && c.sub ? <p className="wtg-card-sub">{c.sub}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="wtg-line"><span className="wtg-gap">Not checked yet</span> Temperature, rain, daylight and crowds for this trip.</p>
      )}

      <div className="wtg-sub">
        <h3 className="wtg-h3">Other weeks that work</h3>
        {rows.length ? (
          others.length ? (
            <ul className="wtg-weeks">
              {others.map((w) => (
                <Week key={w.id} w={w} />
              ))}
            </ul>
          ) : (
            <p className="wtg-line wtg-quiet">No other week has been researched yet.</p>
          )
        ) : (
          <p className="wtg-line wtg-quiet">Other weeks have not been researched yet.</p>
        )}
      </div>

      {notes.length ? (
        <div className="wtg-sub">
          <h3 className="wtg-h3">Worth knowing</h3>
          {folded > 0 ? <input type="checkbox" id="wtg-notes-more" className="sum-toggle sr-only" /> : null}
          <ul className="wtg-notes">
            {notes.map((n) => (
              <li key={n.text} data-kind={n.kind} data-extra={n.fold || undefined}>
                <Icon name={n.kind === 'warn' ? 'warn' : 'info'} size={15} />
                <span>
                  {n.kind === 'warn' ? <span className="sr-only">Closure or hazard: </span> : null}
                  {n.text}
                </span>
              </li>
            ))}
          </ul>
          {folded > 0 ? (
            <label htmlFor="wtg-notes-more" className="sum-more-label wtg-more" data-print="hide">
              <span className="sum-more-off">Show {folded} more</span>
              <span className="sum-more-on">Show fewer</span>
            </label>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

const rowsOf = (links: readonly WeatherLinkRow[], kinds: readonly WeatherKind[]) => kinds.map((k) => ({ kind: k, links: links.filter((l) => l.kind === k) })).filter((r) => r.links.length);

/** One other window: its label, the verdict and crowd in words, one plus and one minus (spec 6.2 item 4). No "Plan for this window" link: that is OVR-1. */
function Week({ w }: { w: WindowRow }) {
  return (
    <li className="wtg-week">
      <p className="wtg-week-h">
        <b>{w.label}</b>
        <span className="wtg-week-v">{VERDICT_WORD[w.verdict]}</span>
        {w.crowd ? <span className="wtg-week-c">Crowds {w.crowd.level}</span> : null}
      </p>
      {w.plus ? (
        <p className="wtg-week-p">
          <span aria-hidden="true">+</span>
          <span className="sr-only">Plus: </span>
          {w.plus}
        </p>
      ) : null}
      {w.minus ? (
        <p className="wtg-week-p">
          <span aria-hidden="true">&minus;</span>
          <span className="sr-only">Minus: </span>
          {w.minus}
        </p>
      ) : null}
    </li>
  );
}

function Weather({ w }: { w: TripWeather }) {
  const forecasts = w.sources.reduce((n, s) => n + s.links.filter((l) => l.kind === 'forecast').length, 0);
  const others = w.sources.reduce((n, s) => n + s.links.filter((l) => l.kind !== 'forecast').length, 0);
  // phones show the forecast row at rest; climate, mountain and aurora fold behind one counted disclosure (UXB-4 review I2). Nothing folds when there is no forecast to keep.
  const foldable = forecasts > 0 && others > 0;
  return (
    <div className="wtg-sub wtg-wx" data-print="hide">
      <h3 className="wtg-h3" id="wtg-wx-h">Weather</h3>
      {w.sources.length ? <p className="wtg-note">The weather services&apos; own pages, in a new tab. Nothing is sent from this page.</p> : null}
      {foldable ? <input type="checkbox" id="wtg-wx-more" className="sum-toggle sr-only" /> : null}
      {w.sources.length ? (
        <ul className="wtg-srcs" aria-labelledby="wtg-wx-h">
          {w.sources.map((src) => (
            <li key={src.name} className="wtg-src" data-extra={(foldable && !src.links.some((l) => l.kind === 'forecast')) || undefined}>
              <p className="wtg-src-n">{src.name}</p>
              {rowsOf(src.links, PRIMARY).map((r) => (
                <Row key={r.kind} src={src.name} kind={r.kind} links={r.links} extra={foldable && r.kind !== 'forecast'} />
              ))}
              {rowsOf(src.links, SECONDARY).map((r) => (
                <Row key={r.kind} src={src.name} kind={r.kind} links={r.links} secondary extra={foldable} />
              ))}
            </li>
          ))}
        </ul>
      ) : null}
      {foldable ? (
        <label htmlFor="wtg-wx-more" className="sum-more-label wtg-more">
          <span className="sum-more-off">More weather pages ({others})</span>
          <span className="sum-more-on">Show fewer</span>
        </label>
      ) : null}
      {w.partial ? <p className="wtg-note">Some weather pages for this trip are not linked yet: we have not found or checked them.</p> : null}
    </div>
  );
}

function Row({ src, kind, links, secondary, extra }: { src: string; kind: WeatherKind; links: WeatherLinkRow[]; secondary?: boolean; extra?: boolean }) {
  return (
    <div className="wtg-row" data-secondary={secondary || undefined} data-extra={extra || undefined}>
      <p className="wtg-row-k">{ROW_LEAD[kind]}</p>
      <ul className="wtg-links">
        {links.map((l) => (
          <li key={l.href}>
            <a className="wtg-link" href={l.href} target="_blank" rel="noopener noreferrer" hrefLang={l.lang ?? undefined}>
              <span className="wtg-link-t">{l.text}</span>
              {l.language ? <span className="wtg-lang">{l.language}</span> : null}
              <span className="sr-only">{`${ROW_LEAD[kind].toLowerCase()}, ${src}, opens in a new tab`}</span>
              <Icon name="external" size={14} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
