import type { TimelineEntry } from '@travel/core/schedule/types.ts';
import type { TimelineSession } from '@/lib/export/timelineState';
import { sourceLine } from '@/lib/export/licence';
import type { ExportStop, TripExport } from '@/lib/export/types';
import './actions.css';

/** What paper says for a fact the plan does not have yet: the site's gap wording. A free slot in a day is not a gap, so a stop with no time prints no time. */
const GAP = 'Not checked yet';

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
const PRINTED = new Set(['visit', 'trail']);

/** "Family, 6 · Standard": who the plan is for, as the page says it. */
export function profileLine(p: TimelineSession['profile']): string {
  return `${p.party === 'adults' ? 'Adults' : `Family, ${p.youngest}`} · ${p.pace[0]!.toUpperCase()}${p.pace.slice(1)}`;
}

interface Row { key: string; time: string | null; name: string; stop: ExportStop | null }

/** One day's rows. With the page's timeline, the times and the chosen version are the page's own; without it, the plan's stops as written, untimed. */
function rowsOf(day: number, stops: ExportStop[], session: TimelineSession | null): { rows: Row[]; version: string | null } {
  const tl = session?.timelines.find((t) => t.day === day);
  if (!tl) return { rows: stops.filter((s) => s.day === day).map((s) => ({ key: s.id, time: s.time, name: s.name, stop: s })), version: null };
  const mine = stops.filter((s) => s.day === day);
  const entries: TimelineEntry[] = tl.entries.filter((e) => PRINTED.has(e.kind) && !e.insideOf);
  const rows = entries.map((e) => ({
    key: e.id,
    time: tl.blocks ? (e.block ?? null) : e.start,
    name: e.title,
    stop: mine.find((s) => s.placeSlug && s.placeSlug === e.at?.placeSlug) ?? null,
  }));
  return { rows, version: tl.variant.key === 'main' ? null : tl.variant.label };
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
      {data.days.map((d) => {
        const { rows, version } = rowsOf(d.n, data.stops, session);
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
                    {r.stop?.durationMin ? ` · ${r.stop.durationMin} min` : ''}
                    {r.stop?.note ? <span className="print-model-note"> {r.stop.note}</span> : null}
                    {r.stop?.links[0] ? <span className="print-model-link">{r.stop.links[0]}</span> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p>{GAP}</p>
            )}
          </section>
        );
      })}
      <p className="print-model-source">{sourceLine(data.url)}</p>
    </div>
  );
}
