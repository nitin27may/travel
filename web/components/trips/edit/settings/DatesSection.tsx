'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DayTimeline } from '@travel/core/schedule/types.ts';
import { CalendarPicker } from '@/components/actions/CalendarPicker';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Select } from '@/components/ui/Select';
import { Stepper } from '@/components/ui/Stepper';
import { formatDate, iso } from '@/lib/export/dates';
import { dayDate } from '@/lib/trip-edit/moveFit';
import type { PlanDraft, PlanOp } from '@/lib/trip-edit/model';
import { newOpId } from '@/lib/trip-edit/stopOps';
import { dayBookings, dropStops } from '../day/dayOps';
import { bookingsLine, lengthLine, lengthOps, stayingDay, type LengthChange } from './lengthPlan';
import { PLAN_DOC_LIMITS } from '@travel/core/config/plans.ts';

interface Props {
  doc: PlanDraft;
  /** the days the trip shows now */
  days: number;
  timelines?: readonly DayTimeline[];
  bookings: readonly { name: string; day: number | null }[];
  open: boolean;
  copy: boolean;
  /** A trip in the account can have no date; a copy on this device always keeps its start (copies/1 holds a date), so it is not offered there. */
  canClear: boolean;
  run: (ops: PlanOp[], label: string) => boolean;
}

/**
 * Dates (edit-mode-spec 9.2). A new start date relabels the days and re-checks them at once and never moves a stop (9.1); "No date" shows
 * Day numbers only. A copy can also change its length: the stepper stages the change and asks one question before Apply, where the new days
 * go or which days go and what happens to their stops, then Apply makes the `insertDay` or `dropDay` operations as one undo step.
 */
export function DatesSection({ doc, days, timelines, bookings, open, copy, canClear, run }: Props) {
  const [calendar, setCalendar] = useState(false);
  const [today, setToday] = useState<string | null>(null);
  // the calendar needs the local date, read after hydration
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const d = new Date(); setToday(iso(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())))); }, [open]);
  return (
    <section className="own-set-when" aria-labelledby="own-when-h">
      <h3 id="own-when-h" className="field-label">Starts</h3>
      <div className="own-set-dates">
        <button type="button" className="own-set-date" aria-expanded={calendar} aria-controls="own-set-cal" data-empty={doc.start ? undefined : ''} onClick={() => setCalendar((v) => !v)}>
          <Icon name="calendar" size={16} />
          <span>{doc.start ? formatDate(doc.start) : 'No date'}</span>
          <Icon name={calendar ? 'chevronUp' : 'chevronDown'} size={16} />
        </button>
        {doc.start && canClear ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCalendar(false);
              run([{ kind: 'setDates', id: newOpId(), start: null }], 'The trip has no dates · days are numbered only');
            }}
          >
            No date
          </Button>
        ) : null}
      </div>
      {calendar && today ? (
        <div id="own-set-cal">
          <CalendarPicker
            value={doc.start ?? null}
            onChange={(v) => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(v) && v !== doc.start) run([{ kind: 'setDates', id: newOpId(), start: v }], `The trip starts ${formatDate(v)} · days relabelled, no stop moved`);
              setCalendar(false);
            }}
            length={Math.max(1, days)}
            today={today}
          />
        </div>
      ) : null}
      {copy ? <Length doc={doc} days={days} timelines={timelines} bookings={bookings} run={run} /> : null}
    </section>
  );
}

function Length({ doc, days, timelines, bookings, run }: Pick<Props, 'doc' | 'days' | 'timelines' | 'bookings' | 'run'>) {
  const max = PLAN_DOC_LIMITS.templateDays;
  const [want, setWant] = useState(days);
  const [after, setAfter] = useState(days);
  const [how, setHow] = useState<'move' | 'maybe' | 'remove'>('move');
  const [picked, setPicked] = useState<number[] | null>(null);
  // the stage clears when the trip's length changes under it (Apply, Undo, or another device)
  const [seen, setSeen] = useState(days);
  if (seen !== days) {
    setSeen(days);
    setWant(days);
    setAfter(days);
    setPicked(null);
  }
  const stopsOf = useMemo(() => (n: number) => dropStops(timelines?.find((t) => t.day === n)?.entries ?? []), [timelines]);
  const delta = want - days;
  // days to drop: the last ones by default, or the ones the person chose
  const k = Math.max(0, -delta);
  const defaults = Array.from({ length: k }, (_, i) => days - i);
  const drops = picked && picked.length === k ? picked : defaults;
  const distinct = new Set(drops).size === drops.length;
  const change: LengthChange | null = delta > 0 ? { kind: 'add', count: delta, after } : delta < 0 && distinct ? { kind: 'drop', days: drops, how } : null;
  const names = delta < 0 && distinct ? drops.flatMap((n) => dayBookings(timelines?.find((t) => t.day === n) ?? { entries: [] }, bookings, null)) : [];
  const anyStops = drops.some((n) => stopsOf(n).length > 0);
  const stay = change?.kind === 'drop' ? stayingDay(Math.max(...drops), days, new Set(drops)) : null;
  const clear = () => {
    setWant(days);
    setPicked(null);
  };
  return (
    <div className="own-set-length">
      <Stepper label="Days" value={want} min={1} max={max} decLabel="Fewer days" incLabel="More days" onChange={setWant} />
      {delta !== 0 ? (
        <div className="own-set-ask" role="group" aria-label={delta > 0 ? 'Where the new days go' : 'Which days go'}>
          {delta > 0 ? (
            <label className="own-set-pick">
              <span className="own-set-pick-l">New days go</span>
              <Select compact value={after} onChange={(e) => setAfter(Number(e.target.value))}>
                <option value={days}>At the end</option>
                {Array.from({ length: days - 1 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>After Day {n}{dayDate(doc.start ?? null, n) ? ` · ${dayDate(doc.start ?? null, n)}` : ''}</option>
                ))}
              </Select>
            </label>
          ) : (
            <>
              {drops.map((n, i) => (
                <label className="own-set-pick" key={i}>
                  <span className="own-set-pick-l">{k === 1 ? 'Day to drop' : `Day to drop (${i + 1})`}</span>
                  <Select compact value={n} onChange={(e) => setPicked(drops.map((x, j) => (j === i ? Number(e.target.value) : x)))}>
                    {Array.from({ length: days }, (_, j) => j + 1).map((d) => (
                      <option key={d} value={d}>Day {d}{dayDate(doc.start ?? null, d) ? ` · ${dayDate(doc.start ?? null, d)}` : ''}</option>
                    ))}
                  </Select>
                </label>
              ))}
              {!distinct ? <p className="own-set-why">Pick a different day for each.</p> : null}
              {anyStops && distinct ? (
                <label className="own-set-pick">
                  <span className="own-set-pick-l">Their stops</span>
                  <Select compact value={how} onChange={(e) => setHow(e.target.value as typeof how)}>
                    <option value="move">{stay === null ? 'Move to another day' : `Move to Day ${stay}`}</option>
                    <option value="maybe">Go to Maybe</option>
                    <option value="remove">Are removed</option>
                  </Select>
                </label>
              ) : null}
            </>
          )}
          {change ? <p className="own-set-effect" role="status">{lengthLine(change, days, stopsOf)}</p> : null}
          {names.length ? <p className="own-set-effect own-set-crit" role="alert">{bookingsLine(drops, names)} Nothing is cancelled; check with the operator.</p> : null}
          <div className="own-set-apply">
            <Button size="sm" onClick={clear}>Cancel</Button>
            <Button
              size="sm"
              variant={names.length ? 'danger' : 'secondary'}
              disabled={!change}
              onClick={() => {
                if (!change) return;
                const label = lengthLine(change, days, stopsOf);
                if (run(lengthOps(doc, change, days, stopsOf, newOpId), label)) clear();
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
