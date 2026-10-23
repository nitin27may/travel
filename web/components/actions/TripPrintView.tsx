import { sourceLine } from '@/lib/export/licence';
import type { TripExport } from '@/lib/export/types';
import './actions.css';

/** What paper says for a value the plan does not have yet: the site's gap wording, never a blank. */
const GAP = 'Not checked yet';

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/**
 * The page's print view (Q46, P7), laid out from the trip's `json` export model and nothing else: every day in order, each stop with its time,
 * place, area and links, the gaps written out, and the source line. It is mounted only while the browser prints (ExportMenu), shown only in
 * the print media, and holds no household data because the model has none. The page itself is hidden for the print (actions.css).
 */
export function TripPrintView({ data }: { data: TripExport }) {
  const stops = [...data.stops].sort((a, b) => a.order - b.order);
  return (
    <div className="print-model" data-print-model-root data-testid="trip-print-view">
      <h1>{data.title}</h1>
      <p>
        {data.url} · {plural(data.nights, 'night')} · {data.seasonLabel ?? `Season: ${GAP}`}
      </p>
      {data.days.map((d) => {
        const mine = stops.filter((s) => s.day === d.n);
        return (
          <section key={d.n} className="print-model-day">
            <h2>
              Day {d.n}: {d.title || GAP}
              {d.base ? ` (base ${d.base})` : ''}
            </h2>
            {mine.length ? (
              <ol>
                {mine.map((s) => (
                  <li key={s.id}>
                    <b>{s.time ?? GAP}</b> · {s.name}
                    {s.area ? `, ${s.area}` : ''}
                    {s.lane ? ` · ${s.lane}` : ''}
                    {s.durationMin ? ` · ${s.durationMin} min` : ''}
                    {s.note ? <span className="print-model-note"> {s.note}</span> : null}
                    {s.links.map((u) => (
                      <span key={u} className="print-model-link">
                        {u}
                      </span>
                    ))}
                  </li>
                ))}
              </ol>
            ) : (
              <p>{GAP}</p>
            )}
          </section>
        );
      })}
      <p className="print-model-source">{sourceLine(data.url)} Map data © OpenStreetMap contributors (ODbL).</p>
    </div>
  );
}
