'use client';

import { useEffect, useRef, useState } from 'react';
import type { DayTimeline, Profile, ScheduleItem } from '@travel/core/schedule/types.ts';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Radio } from '@/components/ui/Checkbox';
import { Select } from '@/components/ui/Select';
import type { TimelineDayModel } from '@/components/trips/timeline/model';
import { variantLine, type VariantLine } from '@/components/trips/timeline/consequence';
import { usePrefs } from '@/lib/format/prefs';
import { refOfDay } from '@/lib/trip-edit/dayMap';
import { dayDate } from '@/lib/trip-edit/moveFit';
import type { PlanDraft } from '@/lib/trip-edit/model';
import { ActionPanel } from '../panel/ActionPanel';
import { BackRow, NoteField } from '../panel/StopMenu';
import { addDayBlock, bookingQuestion, dayChanged, dayCount, dayNoteOf, dropStops, type DropHow } from './dayOps';
import './day.css';

export interface DayAct {
  add: (n: number) => void;
  drop: (n: number, how: DropHow, stops: DayTimeline['entries']) => void;
  reset: (n: number) => void;
  note: (n: number, text: string) => void;
  version: (n: number, key: 'A' | 'B' | 'C' | null) => void;
}

interface Props {
  n: number;
  doc: PlanDraft;
  tl: DayTimeline;
  day: TimelineDayModel;
  /** the days of our plan, for the cap */
  published: number;
  start: string | null;
  profile: Profile;
  /** the booked slots on this day, by name (dayBookings) */
  bookings: readonly string[];
  /** the places the person added to this day, as scheduler items, so a version's figures include them */
  addedItems: readonly ScheduleItem[];
  act: DayAct;
}

type View = 'rows' | 'drop' | 'note' | 'version';

/**
 * The `⋯` on a day's header (components 8.7 day rows; edit-mode-spec 6): Add a day after Day n, Add a note, Version of Day n, Reset Day n,
 * then Drop Day n last in the danger colour. Drop asks what happens to the day's stops in the same sheet, and confirms only when the day holds
 * a booking (patterns 4.4); an empty day drops at once. Every action closes the sheet first, so nothing is left over the page.
 */
export function DayMenu({ n, doc, tl, day, published, start, profile, bookings, addedItems, act }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('rows');
  const ref = refOfDay(doc.template?.days ?? [], n);
  const added = typeof ref === 'string';
  const stops = dropStops(tl.entries);
  const count = dayCount(doc, published);
  const block = addDayBlock(doc, published);
  const note = dayNoteOf(doc, n);
  const versions = !added && day.variants.length > 1;
  const changed = dayChanged(doc, ref);
  const base = day.base ?? tl.entries.find((e) => e.kind === 'start')?.at?.name ?? null;
  const date = dayDate(start, n);
  const meta = [date, base ? `Base: ${base}` : null].filter(Boolean).join(' · ');
  const show = setView;
  const reset = (o: boolean) => {
    setOpen(o);
    if (!o) setView('rows');
  };
  const done = (fn: () => void) => () => {
    reset(false);
    fn();
  };
  // an empty day with nothing booked drops at once (patterns 4.4); any other asks inside this sheet
  const drop = () => (stops.length === 0 && bookings.length === 0 ? done(() => act.drop(n, { kind: 'remove' }, stops))() : show('drop'));
  return (
    <ActionPanel label={`Actions for Day ${n}`} title={`Day ${n}`} meta={view === 'rows' ? meta || undefined : undefined} open={open} onOpenChange={reset} triggerClassName="edit-more day-more">
      {view === 'rows' ? (
        <>
          <button type="button" role="menuitem" className="edit-row" disabled={!!block} onClick={done(() => act.add(n))}>
            <Icon name="plus" size={16} /> <span>Add a day after Day {n}</span>
          </button>
          {block ? <p className="edit-why">{block}</p> : null}
          <button type="button" role="menuitem" className="edit-row" onClick={() => show('note')}>
            <Icon name="pencil" size={16} /> <span>{note ? 'Edit the note' : 'Add a note'}</span>
          </button>
          {versions ? (
            <button type="button" role="menuitem" className="edit-row" onClick={() => show('version')}>
              <Icon name="layers" size={16} /> <span>Version of Day {n}…</span>
            </button>
          ) : null}
          {added ? null : (
            <button type="button" role="menuitem" className="edit-row" disabled={!changed} onClick={done(() => act.reset(n))}>
              <Icon name="undo" size={16} /> <span>Reset Day {n}</span>
            </button>
          )}
          {added || changed ? null : <p className="edit-why">Day {n} is already our plan</p>}
          <hr className="edit-sep" />
          <button type="button" role="menuitem" className="edit-row edit-crit" disabled={count <= 1} onClick={drop}>
            <Icon name="close" size={16} /> <span>Drop Day {n}</span>
          </button>
          {count <= 1 ? <p className="edit-why">A trip needs at least one day</p> : null}
        </>
      ) : view === 'drop' ? (
        <DropView n={n} count={count} start={start} stops={stops} bookings={bookings} back={() => show('rows')} cancel={() => reset(false)} go={(how) => done(() => act.drop(n, how, stops))()} />
      ) : view === 'version' ? (
        <VersionView n={n} day={day} tl={tl} profile={profile} addedItems={addedItems} back={() => show('rows')} pick={(k) => done(() => act.version(n, k))()} />
      ) : (
        <NoteField initial={note} back={() => show('rows')} save={(t) => done(() => act.note(n, t))()} />
      )}
    </ActionPanel>
  );
}

function DropView({ n, count, start, stops, bookings, back, cancel, go }: { n: number; count: number; start: string | null; stops: DayTimeline['entries']; bookings: readonly string[]; back: () => void; cancel: () => void; go: (how: DropHow) => void }) {
  // the default is the day before (the day after, for Day 1)
  const [to, setTo] = useState(n > 1 ? n - 1 : 2);
  const keep = stops.some((e) => !!e.at?.placeSlug);
  const [kind, setKind] = useState<DropHow['kind']>('move');
  const others = Array.from({ length: count }, (_, i) => i + 1).filter((d) => d !== n);
  const how: DropHow = kind === 'move' ? { kind: 'move', to } : { kind };
  const question = bookings.length ? bookingQuestion(n, bookings) : null;
  // Cancel takes focus first (patterns 4.4) without scrolling the page after the anchor
  const foot = useRef<HTMLDivElement>(null);
  useEffect(() => foot.current?.querySelector('button')?.focus({ preventScroll: true }), []);
  return (
    <div className="edit-drop" role={question ? 'alertdialog' : 'group'} aria-labelledby="edit-drop-h">
      <BackRow onBack={back} title={`Drop Day ${n}`} />
      {stops.length ? (
        <fieldset className="edit-drop-set">
          <legend id="edit-drop-h" className="edit-drop-legend">
            {stops.length === 1 ? 'Its stop' : `Its ${stops.length} stops`}
          </legend>
          <Radio name="drop-how" checked={kind === 'move'} onChange={() => setKind('move')}>
            <span className="edit-drop-move">
              Move to
              <Select compact aria-label="Move to day" value={to} onChange={(e) => setTo(Number(e.target.value))} onFocus={() => setKind('move')}>
                {others.map((d) => (
                  <option key={d} value={d}>
                    {[`Day ${d}`, dayDate(start, d)].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </Select>
            </span>
          </Radio>
          {keep ? (
            <Radio name="drop-how" checked={kind === 'maybe'} onChange={() => setKind('maybe')}>
              Go to Maybe
            </Radio>
          ) : null}
          <Radio name="drop-how" checked={kind === 'remove'} onChange={() => setKind('remove')}>
            Are removed with the day
          </Radio>
        </fieldset>
      ) : (
        <p id="edit-drop-h" className="edit-why">Day {n} has no stops.</p>
      )}
      {question ? <p className="edit-confirm-text edit-drop-ask">{question}</p> : null}
      <div className="edit-confirm-foot" ref={foot}>
        <Button onClick={cancel}>
          Cancel
        </Button>
        <Button variant={question ? 'danger' : 'secondary'} onClick={() => go(how)}>
          Drop Day {n}
        </Button>
      </div>
    </div>
  );
}

function VersionView({ n, day, tl, profile, addedItems, back, pick }: { n: number; day: TimelineDayModel; tl: DayTimeline; profile: Profile; addedItems: readonly ScheduleItem[]; back: () => void; pick: (k: 'A' | 'B' | 'C' | null) => void }) {
  const [prefs] = usePrefs();
  const [lines, setLines] = useState<Map<string, VariantLine> | null>(null);
  useEffect(() => {
    let live = true;
    void import('@travel/core/schedule/schedule.ts').then((engine) => {
      if (!live) return;
      const out = new Map<string, VariantLine>([[tl.variant.key, variantLine(tl, prefs.distance)]]);
      for (const v of day.variants) if (v.key !== tl.variant.key) out.set(v.key, variantLine(engine.scheduleDay(day.input, profile, { variant: v.key, added: [...addedItems] }), prefs.distance));
      setLines(out);
    });
    return () => {
      live = false;
    };
    // worked out once per open: the day does not change while the list is showing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const picked = tl.variant.chosenBy === 'override';
  return (
    <div className="edit-days">
      <BackRow onBack={back} title={`Version of Day ${n}`} />
      <ul className="edit-daylist">
        {day.variants.map((v) => {
          const on = v.key === tl.variant.key;
          const l = lines?.get(v.key);
          return (
            <li key={v.key}>
              <button type="button" role="menuitem" className="edit-row edit-day" disabled={on} onClick={() => pick(v.key === 'main' ? null : (v.key as 'A' | 'B' | 'C'))}>
                <span className="edit-day-main">
                  <span className="edit-day-name">{on ? `${v.label} (now)` : v.label}</span>
                  <span className="edit-day-sub num">{l ? l.line : lines === null ? 'Checking this version' : ''}</span>
                  {l?.warn ? <span className="edit-day-reason" data-level={l.level ?? 'fix'}>{l.warn}</span> : null}
                </span>
              </button>
            </li>
          );
        })}
        {picked ? (
          <li>
            <button type="button" role="menuitem" className="edit-row" onClick={() => pick(null)}>
              <Icon name="undo" size={16} /> <span>Back to the version chosen for your settings</span>
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
