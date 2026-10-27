'use client';

import { Fragment, useEffect, useRef } from 'react';
import type { DayTimeline } from '@travel/core/schedule/types.ts';
import type { ShapeModel, ShapeNote, ShapeRow } from '@travel/core/trips/shape.ts';
import { DaySign } from '@/components/ui/DaySign';
import { Icon } from '@/components/ui/Icon';
import { hoursMinutes } from '../format';

// The trip's shape, expanded (spec 4.2, W5): one real table with a caption, a row a day, the whole row a link to that day in Days (P5).
// A phone draws each row on up to three lines (day, base and drive; the plan; the notes) and keeps the same table underneath.

interface Props {
  model: ShapeModel;
  timelines: readonly DayTimeline[];
  /** The count phrase the table is filtered to, or null for every day. */
  filter: Exclude<ShapeModel['phrases'][number]['key'], 'days'> | null;
  onClear: () => void;
  /** The table is in the page: the shell may now open the body (so the first open grows from nothing). */
  onReady: () => void;
}

const UNKNOWN = 'Not checked yet';

function driveCell(r: ShapeRow, max: number) {
  if (r.driveMin === null) return <span className="shape-unknown">{UNKNOWN}</span>;
  if (r.driveMin <= 0) return <span className="shape-none">No driving</span>;
  return (
    <>
      <span className="shape-bar" aria-hidden="true">
        <span style={{ width: `${Math.round((max > 0 ? r.driveMin / max : 0) * 100)}%` }} />
      </span>
      <span className="shape-drive-v num">{hoursMinutes(r.driveMin)}</span>
    </>
  );
}

function footCell(r: ShapeRow, condensed: boolean) {
  if (condensed) return <span className="shape-unknown">{UNKNOWN}</span>;
  if (r.walkKm <= 0) return <span className="shape-none">No walk planned</span>;
  return <span className="num">{r.walkKm >= 10 ? Math.round(r.walkKm) : Math.round(r.walkKm * 10) / 10} km</span>;
}

function Notes({ notes }: { notes: ShapeNote[] }) {
  if (!notes.length) return <span className="sr-only">No notes</span>;
  return (
    <>
      {notes.map((n, i) => (
        <Fragment key={`${n.kind}-${i}`}>
          {i > 0 ? (
            <span className="shape-dot" aria-hidden="true">
              {' · '}
            </span>
          ) : null}
          <span className="shape-note" data-kind={n.kind}>
            {n.text}
          </span>
        </Fragment>
      ))}
    </>
  );
}

export default function TripShapeRows({ model, timelines, filter, onClear, onReady }: Props) {
  const ref = useRef<HTMLTableElement>(null);
  useEffect(() => {
    // paint the closed body once, then let the shell open it: the first open grows instead of appearing
    ref.current?.getBoundingClientRect();
    onReady();
  }, [onReady]);
  const condensed = new Set(timelines.filter((t) => t.blocks).map((t) => t.day));
  const set = filter ? new Set(model.sets[filter]) : null;
  const rows = set ? model.rows.filter((r) => set.has(r.n)) : model.rows;
  const filterText = filter ? model.phrases.find((p) => p.key === filter)?.text : null;
  return (
    <table className="shape-table" ref={ref} role="table">
      <caption>
        <span className="shape-cap">{filterText ? `The trip's shape, ${filterText} of ${model.days}` : `The trip's shape, ${model.days} ${model.days === 1 ? 'day' : 'days'}`}</span>
        {filter ? (
          <button type="button" className="shape-all" onClick={onClear}>
            Show all days
          </button>
        ) : null}
      </caption>
      <thead role="rowgroup">
        <tr role="row">
          <th scope="col" role="columnheader">Day</th>
          <th scope="col" role="columnheader">Base and plan</th>
          <th scope="col" role="columnheader">Driving</th>
          <th scope="col" role="columnheader">On foot</th>
          <th scope="col" role="columnheader">Notes</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {rows.map((r) => (
          <tr key={r.n} className="shape-row" role="row" data-day={r.n} data-quiet={r.notes.length ? undefined : ''}>
            <th scope="row" role="rowheader" className="shape-day">
              <a className="shape-link" href={`?view=day#day-${r.n}`} data-tab-link="">
                <DaySign n={r.n} size="s" />
              </a>
            </th>
            <td className="shape-plan" role="cell">
              {r.base ? <span className="shape-base">{r.base}</span> : null}
              <span className="shape-title">{r.title}</span>
            </td>
            <td className="shape-drive" role="cell">
              {driveCell(r, model.maxDriveMin)}
              <Icon name="chevronRight" size={16} className="shape-go" />
            </td>
            <td className="shape-foot" role="cell">
              {footCell(r, condensed.has(r.n))}
            </td>
            <td className="shape-notes" role="cell">
              <Notes notes={r.notes} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
