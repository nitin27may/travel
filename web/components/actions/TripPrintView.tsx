import { fmtHM } from '@travel/core/schedule/rules.ts';
import type { TimelineEntry } from '@travel/core/schedule/types.ts';
import { adultsText, ageText, PACE_WORD } from '@travel/core/trips/partyWords.ts';
import { printTime } from '@travel/core/export/plan.ts';
import { bookAheadText, bookingCounts } from '@travel/core/export/bookings.ts';
import { BOOKING_GROUPS } from '@/components/trips/tabs/bookingGroups';
import type { TimelineSession } from '@/lib/export/timelineState';
import { sourceLine } from '@/lib/export/licence';
import type { OwnTrip } from '@/lib/export/ownState';
import type { ExportStop, TripExport } from '@/lib/export/types';
import './actions.css';

/** What paper says for a fact the plan does not have yet: the site's gap wording. A free slot in a day is not a gap, so a stop with no time prints no time. */
const GAP = 'Not checked yet';

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
const PRINTED = new Set(['visit', 'trail']);
const TRAVEL_SKIPPED = new Set(['start', 'checkout']);

/** "2 adults · youngest 6 · Standard pace": who the plan is for, in the party words the page uses everywhere (ER-018). The profile keeps the youngest's age, not every child's. */
export function profileLine(p: TimelineSession['profile']): string {
  return [adultsText(p.adults), p.party === 'adults' || p.youngest === null ? null : `youngest ${ageText(p.youngest)}`, `${PACE_WORD[p.pace]} pace`].filter(Boolean).join(' · ');
}

interface Row { key: string; time: string | null; name: string; duration: string | null; note: string | null; mine: string | null; stop: ExportStop | null }

/**
 * One day's rows. With the page's timeline, every printed field is the timeline entry's own (time, duration in the page's formatter, note),
 * the stop only adds its area, links and a note the entry has none of; without it, the plan's stops as written, untimed.
 */
function rowsOf(day: number, stops: ExportStop[], session: TimelineSession | null, own: OwnTrip | null): { rows: Row[]; version: string | null; travel: boolean } {
  const tl = (session?.display ?? session?.timelines)?.find((t) => t.day === day);
  const plain = (s: ExportStop): Row => ({ key: s.id, time: null, name: s.name, duration: s.durationMin ? `${s.durationMin} min` : null, note: s.note, mine: null, stop: s });
  if (!tl) return { rows: stops.filter((s) => s.day === day).map(plain), version: null, travel: false };
  const mine = stops.filter((s) => s.day === day);
  const of = (e: TimelineEntry): Row => {
    const stop = mine.find((s) => s.placeSlug && s.placeSlug === e.at?.placeSlug) ?? null;
    return { key: e.id, time: printTime(e, tl.blocks), name: /^Drive on to /.test(e.title) ? 'Drive on' : e.title, duration: e.durationMin > 0 ? fmtHM(e.durationMin) : null, note: e.time.note ?? stop?.note ?? null, mine: own?.noteOf(e) || null, stop };
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
export function TripPrintView({ data, session = null, parkLines = [], own = null }: { data: TripExport; session?: TimelineSession | null; parkLines?: readonly string[]; own?: OwnTrip | null }) {
  return (
    <div className="print-model" data-print-model-root data-testid="trip-print-view">
      <h1>{data.title}</h1>
      {own ? <p className="print-model-own" data-testid="print-own-header">{own.header}</p> : null}
      <p>
        {data.url} · {plural(data.nights, 'night')} · {data.seasonLabel ?? `Season: ${GAP}`}
      </p>
      {session ? <p>Planned for {profileLine(session.profile)}</p> : null}
      {parkLines.length ? (
        <section className="print-model-parks" aria-label="Park entry">
          <h2>Park entry</h2>
          <ul>
            {parkLines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {data.days.map((d) => {
        const { rows, version, travel } = rowsOf(d.n, data.stops, session, own);
        return (
          <section key={d.n} className="print-model-day">
            <h2>
              Day {d.n}: {d.title || GAP}
              {d.base ? ` (base ${d.base})` : ''}
            </h2>
            {version ? <p className="print-model-note">{version}</p> : null}
            {own?.dayNote(d.n) ? <p className="print-model-note print-model-own-note">Your note on this day: {own.dayNote(d.n)}</p> : null}
            {rows.length ? (
              <ol>
                {rows.map((r) => (
                  <li key={r.key}>
                    {r.time ? <b>{r.time} · </b> : null}
                    {r.name}
                    {r.stop?.area ? `, ${r.stop.area}` : ''}
                    {r.duration ? ` · ${r.duration}` : ''}
                    {r.stop?.address ? <span className="print-model-note print-model-addr">{r.stop.address}</span> : null}
                    {r.note ? <span className="print-model-note"> {r.note}</span> : null}
                    {r.mine ? <span className="print-model-note print-model-own-note">Your note: {r.mine}</span> : null}
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
      {bookingCounts(data.bookings).toBook ? (
        <section className="print-model-book" aria-label="Book ahead">
          <h2>Book ahead</h2>
          <ul>
            {data.bookings.filter((b) => b.kind === 'booking').map((b) => (
              <li key={b.ref}>
                <b>{b.name}</b>
                {b.day ? <span> · Day {b.day}</span> : null}
                {bookAheadText(b) ? <span className="print-model-note">{bookAheadText(b)}</span> : null}
                {b.link ? <span className="print-model-link">{b.link}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {BOOKING_GROUPS.filter((g) => g.kind !== 'booking').map((g) => {
        const rows = data.bookings.filter((b) => b.kind === g.kind);
        return rows.length ? (
          <section key={g.kind} className="print-model-book" aria-label={g.heading}>
            <h2>{g.heading}</h2>
            <ul>
              {rows.map((b) => (
                <li key={b.ref}>
                  <b>{b.name}</b>
                  {b.day ? <span> · Day {b.day}</span> : null}
                  {bookAheadText(b) ? <span className="print-model-note">{bookAheadText(b)}</span> : null}
                  {b.link ? <span className="print-model-link">{b.link}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null;
      })}
      <p className="print-model-source">{sourceLine(data.url)}</p>
    </div>
  );
}
