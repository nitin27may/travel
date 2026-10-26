import { fmtHM } from '@travel/core/schedule/rules.ts';
import type { TimelineEntry } from '@travel/core/schedule/types.ts';
import { printTime } from '@travel/core/export/plan.ts';
import { bookAheadText } from '@travel/core/export/bookings.ts';
import type { TimelineSession } from '@/lib/export/timelineState';
import { sourceLine } from '@/lib/export/licence';
import type { ExportStop, TripExport } from '@/lib/export/types';
import './actions.css';

/** What paper says for a fact the plan does not have yet: the site's gap wording. A free slot in a day is not a gap, so a stop with no time prints no time. */
const GAP = 'Not checked yet';

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
const PRINTED = new Set(['visit', 'trail']);
const TRAVEL_SKIPPED = new Set(['start', 'checkout']);

/** "Family, 6 · Standard": who the plan is for, as the page says it. */
export function profileLine(p: TimelineSession['profile']): string {
  return `${p.party === 'adults' ? 'Adults' : `Family, ${p.youngest}`} · ${p.pace[0]!.toUpperCase()}${p.pace.slice(1)}`;
}

interface Row { key: string; time: string | null; name: string; duration: string | null; note: string | null; stop: ExportStop | null }

/**
 * One day's rows. With the page's timeline, every printed field is the timeline entry's own (time, duration in the page's formatter, note),
 * the stop only adds its area, links and a note the entry has none of; without it, the plan's stops as written, untimed.
 */
function rowsOf(day: number, stops: ExportStop[], session: TimelineSession | null): { rows: Row[]; version: string | null; travel: boolean } {
  const tl = (session?.display ?? session?.timelines)?.find((t) => t.day === day);
  const plain = (s: ExportStop): Row => ({ key: s.id, time: null, name: s.name, duration: s.durationMin ? `${s.durationMin} min` : null, note: s.note, stop: s });
  if (!tl) return { rows: stops.filter((s) => s.day === day).map(plain), version: null, travel: false };
  const mine = stops.filter((s) => s.day === day);
  const of = (e: TimelineEntry): Row => {
    const stop = mine.find((s) => s.placeSlug && s.placeSlug === e.at?.placeSlug) ?? null;
    return { key: e.id, time: printTime(e, tl.blocks), name: e.title, duration: e.durationMin > 0 ? fmtHM(e.durationMin) : null, note: e.time.note ?? stop?.note ?? null, stop };
  };
  const rows = tl.entries.filter((e) => PRINTED.has(e.kind) && !e.insideOf).map(of);
  // a day with no visit (a travel day) prints its travel, not a missing-fact marker: every entry of the day but the start and the check-out
  // (the legs, the breaks, the arrival or anchor such as "At the airport"), in timeline order with its time
  if (!rows.length) return { rows: tl.entries.filter((e) => !TRAVEL_SKIPPED.has(e.kind) && !e.insideOf).map(of), version: tl.variant.key === 'main' ? null : tl.variant.label, travel: true };
  return { rows, version: tl.variant.key === 'main' ? null : tl.variant.label, travel: false };
}

/**
 * The page's print view (Q46, P7), laid out from the trip's `json` export model and the timeline the page shows: every day in order, each
 * stop with the time the page gives it for the chosen profile and version, its area and its place page. Mounted only while the browser prints
 * (ExportMenu), shown only in the print media; it holds no household data because the model has none (the profile line is party and pace only).
 */
export function TripPrintView({ data, session = null }: { data: TripExport; session?: TimelineSession | null }) {
  return (
    <div className="print-model" data-print-model-root data-testid="trip-print-view">
      <h1>{data.title}</h1>
      <p>
        {data.url} · {plural(data.nights, 'night')} · {data.seasonLabel ?? `Season: ${GAP}`}
      </p>
      {session ? <p>Planned for {profileLine(session.profile)}</p> : null}
      {data.bookings.length ? (
        <section className="print-model-book" aria-label="Book ahead">
          <h2>Book ahead</h2>
          <ul>
            {data.bookings.map((b) => (
              <li key={b.ref}>
                <b>{b.name}</b>
                {b.day ? <span> · Day {b.day}</span> : null}
                {bookAheadText(b) ? <span className="print-model-note">{bookAheadText(b)}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {data.days.map((d) => {
        const { rows, version, travel } = rowsOf(d.n, data.stops, session);
        return (
          <section key={d.n} className="print-model-day">
            <h2>
              Day {d.n}: {d.title || GAP}
              {d.base ? ` (base ${d.base})` : ''}
            </h2>
            {version ? <p className="print-model-note">{version}</p> : null}
            {rows.length ? (
              <ol>
                {rows.map((r) => (
                  <li key={r.key}>
                    {r.time ? <b>{r.time} · </b> : null}
                    {r.name}
                    {r.stop?.area ? `, ${r.stop.area}` : ''}
                    {r.duration ? ` · ${r.duration}` : ''}
                    {r.note ? <span className="print-model-note"> {r.note}</span> : null}
                    {r.stop?.bookAhead ? <span className="print-model-note print-model-bookline">Book ahead: {r.stop.bookAhead}</span> : null}
                    {r.stop?.links[0] ? <span className="print-model-link">{r.stop.links[0]}</span> : null}
                  </li>
                ))}
              </ol>
            ) : travel ? null : (
              <p>{GAP}</p>
            )}
          </section>
        );
      })}
      <p className="print-model-source">{sourceLine(data.url)}</p>
    </div>
  );
}
