'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Radio } from '@/components/ui/Checkbox';
import { Select } from '@/components/ui/Select';
import { dayDate } from '@/lib/trip-edit/moveFit';
import type { PlanDraft } from '@/lib/trip-edit/model';
import { ActionPanel } from '../panel/ActionPanel';
import { BackRow, NoteField } from '../panel/StopMenu';
import { addBuiltDayBlock, builtDayCount, builtDayNote, builtStopsOn, moveBuiltDayOps, resetBuiltDay, type BuiltDrop } from './dayOps';
import '../day/day.css';

export interface BuiltDayAct {
  add: (n: number) => void;
  drop: (n: number, how: BuiltDrop, stops: number) => void;
  reset: (n: number) => void;
  note: (n: number, text: string) => void;
  move: (n: number, dir: -1 | 1) => void;
}

interface Props {
  n: number;
  doc: PlanDraft;
  base: string | null;
  start: string | null;
  act: BuiltDayAct;
}

type View = 'rows' | 'drop' | 'note';

/**
 * The `⋯` on a built day's header (edit-mode-spec 6, 13.1 built column): Add a day after Day n, Add a note, Move Day n earlier or later
 * (inside one base's run), Reset Day n (to the built plan), then Drop Day n last in the danger colour. No version menu: a built day has
 * one plan. Drop asks in the same sheet where the day's stops go; an empty day drops at once (patterns 4.4).
 */
export function BuiltDayMenu({ n, doc, base, start, act }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('rows');
  const count = builtDayCount(doc);
  const stops = builtStopsOn(doc, n).length;
  const block = addBuiltDayBlock(doc);
  const note = builtDayNote(doc, n);
  const canReset = resetBuiltDay(doc, n, () => 'o-probe') !== null;
  const earlier = moveBuiltDayOps(doc, n, -1, () => 'o-probe') !== null;
  const later = moveBuiltDayOps(doc, n, 1, () => 'o-probe') !== null;
  const meta = [dayDate(start, n), base ? `Base: ${base}` : null].filter(Boolean).join(' · ');
  const reset = (o: boolean) => {
    setOpen(o);
    if (!o) setView('rows');
  };
  const done = (fn: () => void) => () => {
    reset(false);
    fn();
  };
  const drop = () => (stops === 0 ? done(() => act.drop(n, { kind: 'remove' }, 0))() : setView('drop'));
  return (
    <ActionPanel label={`Actions for Day ${n}`} title={`Day ${n}`} meta={view === 'rows' ? meta || undefined : undefined} open={open} onOpenChange={reset} triggerClassName="edit-more day-more">
      {view === 'rows' ? (
        <>
          <button type="button" role="menuitem" className="edit-row" disabled={!!block} onClick={done(() => act.add(n))}>
            <Icon name="plus" size={16} /> <span>Add a day after Day {n}</span>
          </button>
          {block ? <p className="edit-why">{block}</p> : null}
          <button type="button" role="menuitem" className="edit-row" onClick={() => setView('note')}>
            <Icon name="pencil" size={16} /> <span>{note ? 'Edit the note' : 'Add a note'}</span>
          </button>
          {earlier || later ? (
            <div className="edit-pair">
              <button type="button" role="menuitem" className="edit-row" disabled={!earlier} aria-label={`Move Day ${n} earlier`} onClick={done(() => act.move(n, -1))}>
                <Icon name="chevronUp" size={16} /> <span>Day earlier</span>
              </button>
              <button type="button" role="menuitem" className="edit-row" disabled={!later} aria-label={`Move Day ${n} later`} onClick={done(() => act.move(n, 1))}>
                <Icon name="chevronDown" size={16} /> <span>Day later</span>
              </button>
            </div>
          ) : null}
          <button type="button" role="menuitem" className="edit-row" disabled={!canReset} onClick={done(() => act.reset(n))}>
            <Icon name="undo" size={16} /> <span>Reset Day {n}</span>
          </button>
          {canReset ? null : <p className="edit-why">Day {n} is as the plan was built</p>}
          <hr className="edit-sep" />
          <button type="button" role="menuitem" className="edit-row edit-crit" disabled={count <= 1} onClick={drop}>
            <Icon name="close" size={16} /> <span>Drop Day {n}</span>
          </button>
          {count <= 1 ? <p className="edit-why">A trip needs at least one day</p> : null}
        </>
      ) : view === 'drop' ? (
        <DropView n={n} count={count} start={start} stops={stops} back={() => setView('rows')} cancel={() => reset(false)} go={(how) => done(() => act.drop(n, how, stops))()} />
      ) : (
        <NoteField initial={note} back={() => setView('rows')} save={(t) => done(() => act.note(n, t))()} />
      )}
    </ActionPanel>
  );
}

function DropView({ n, count, start, stops, back, cancel, go }: { n: number; count: number; start: string | null; stops: number; back: () => void; cancel: () => void; go: (how: BuiltDrop) => void }) {
  const [to, setTo] = useState(n > 1 ? n - 1 : 2);
  const [kind, setKind] = useState<BuiltDrop['kind']>('move');
  const others = Array.from({ length: count }, (_, i) => i + 1).filter((d) => d !== n);
  const foot = useRef<HTMLDivElement>(null);
  // Cancel takes focus first (patterns 4.4)
  useEffect(() => foot.current?.querySelector('button')?.focus({ preventScroll: true }), []);
  return (
    <div className="edit-drop" role="group" aria-labelledby="bdrop-h">
      <BackRow onBack={back} title={`Drop Day ${n}`} />
      <fieldset className="edit-drop-set">
        <legend id="bdrop-h" className="edit-drop-legend">{stops === 1 ? 'Its stop' : `Its ${stops} stops`}</legend>
        <Radio name="bdrop-how" checked={kind === 'move'} onChange={() => setKind('move')}>
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
        <Radio name="bdrop-how" checked={kind === 'remove'} onChange={() => setKind('remove')}>
          Are removed with the day
        </Radio>
      </fieldset>
      <div className="edit-confirm-foot" ref={foot}>
        <Button onClick={cancel}>Cancel</Button>
        <Button onClick={() => go(kind === 'move' ? { kind: 'move', to } : { kind: 'remove' })}>Drop Day {n}</Button>
      </div>
    </div>
  );
}
