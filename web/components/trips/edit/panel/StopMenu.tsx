'use client';

import { useEffect, useState } from 'react';
import type { TimelineEntry } from '@travel/core/schedule/types.ts';
import type { Profile } from '@travel/core/schedule/types.ts';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { candidateToItem, type TimelineModel } from '@/components/trips/timeline/model';
import { deltaOfDraft } from '@/lib/trip-edit/source';
import { dayChoices, type DayChoice } from '@/lib/trip-edit/moveFit';
import { maybeOps, noteOf, placeRefOf, stopTarget } from '@/lib/trip-edit/stopOps';
import type { PlanDraft } from '@/lib/trip-edit/model';
import { ActionPanel } from './ActionPanel';

export interface StopAct {
  remove: (e: TimelineEntry) => void;
  moveTo: (e: TimelineEntry, day: number, after: string | null) => void;
  nudge: (e: TimelineEntry, dir: -1 | 1) => void;
  maybe: (e: TimelineEntry) => void;
  note: (e: TimelineEntry, text: string) => void;
}

interface Props {
  entry: TimelineEntry;
  /** the day's entries in time order, for Move up and Move down */
  dayEntries: readonly TimelineEntry[];
  doc: PlanDraft;
  model: TimelineModel;
  defaults: Profile;
  profile: Profile;
  start: string | null;
  act: StopAct;
}

type View = 'rows' | 'days' | 'note';

/** The stops a day holds, in time order: the entries that are stops, not legs, meals the rules placed or the sun (the ones with a source id). */
export const stopsOfDay = (entries: readonly TimelineEntry[]): TimelineEntry[] =>
  entries.filter((e) => !!e.sourceItemId && !e.insideOf && !e.block && e.kind !== 'sun' && e.kind !== 'leg' && e.kind !== 'booking');

/** The `⋯` of one stop and the sheet or menu it opens (components 8.7): Move to day…, Move up, Move down, Add to Maybe, Add a note, Open place page, then Remove last. */
export function StopMenu({ entry: e, dayEntries, doc, model, defaults, profile, start, act }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('rows');
  const stops = stopsOfDay(dayEntries);
  const i = stops.findIndex((s) => s.id === e.id);
  const alone = stops.length <= 1;
  const base = model.days.find((d) => d.n === e.day)?.base ?? null;
  const meta = [`Day ${e.day}`, e.start && e.kind !== 'leg' ? e.start : null, base ? `Base: ${base}` : null].filter(Boolean).join(' · ');
  const href = e.at?.placeSlug ? `/places/${e.at.placeSlug}/` : null;
  const canMaybe = !!doc.template && !!placeRefOf(e) && maybeOps(doc, e) !== null;
  const reset = (o: boolean) => {
    setOpen(o);
    if (!o) setView('rows');
  };
  const done = (fn: () => void) => () => {
    reset(false);
    fn();
  };
  const upBlock = i <= 0 ? (alone ? `${e.title} is the only stop on Day ${e.day}` : `${e.title} is already first on Day ${e.day}`) : null;
  const downBlock = i < 0 || i >= stops.length - 1 ? (alone ? `${e.title} is the only stop on Day ${e.day}` : `${e.title} is already last on Day ${e.day}`) : null;
  return (
    <ActionPanel label={`Actions for ${e.title}, Day ${e.day}`} title={e.title} meta={view === 'rows' ? meta : undefined} open={open} onOpenChange={reset}>
      {view === 'rows' ? (
        <>
          <button type="button" role="menuitem" className="edit-row" onClick={() => setView('days')}>
            <Icon name="arrow" size={16} /> <span>Move to day…</span>
          </button>
          <div className="edit-pair">
            <button type="button" role="menuitem" className="edit-row" disabled={!!upBlock} onClick={done(() => act.nudge(e, -1))}>
              <Icon name="chevronUp" size={16} /> <span>Move up</span>
            </button>
            <button type="button" role="menuitem" className="edit-row" disabled={!!downBlock} onClick={done(() => act.nudge(e, 1))}>
              <Icon name="chevronDown" size={16} /> <span>Move down</span>
            </button>
          </div>
          {upBlock && downBlock ? <p className="edit-why">{upBlock}</p> : upBlock ? <p className="edit-why">{upBlock}</p> : downBlock ? <p className="edit-why">{downBlock}</p> : null}
          {canMaybe ? (
            <button type="button" role="menuitem" className="edit-row" onClick={done(() => act.maybe(e))}>
              <Icon name="layers" size={16} /> <span>Add to Maybe</span>
            </button>
          ) : null}
          <button type="button" role="menuitem" className="edit-row" onClick={() => setView('note')}>
            <Icon name="pencil" size={16} /> <span>{noteOf(doc, e) ? 'Edit the note' : 'Add a note'}</span>
          </button>
          {href ? (
            <a role="menuitem" className="edit-row" href={href}>
              <Icon name="external" size={16} /> <span>Open place page</span>
            </a>
          ) : null}
          <hr className="edit-sep" />
          <button type="button" role="menuitem" className="edit-row edit-crit" onClick={done(() => act.remove(e))}>
            <Icon name="close" size={16} /> <span>Remove from Day {e.day}</span>
          </button>
        </>
      ) : view === 'days' ? (
        <DayList entry={e} doc={doc} model={model} defaults={defaults} profile={profile} start={start} back={() => setView('rows')} pick={(n, after) => done(() => act.moveTo(e, n, after))()} />
      ) : (
        <NoteField initial={noteOf(doc, e)} back={() => setView('rows')} save={(t) => done(() => act.note(e, t))()} />
      )}
    </ActionPanel>
  );
}

function BackRow({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="edit-back">
      <button type="button" className="edit-back-btn" onClick={onBack} aria-label="Back to actions">
        <Icon name="chevronLeft" size={18} />
      </button>
      <span className="edit-back-title">{title}</span>
    </div>
  );
}

function NoteField({ initial, back, save }: { initial: string; back: () => void; save: (t: string) => void }) {
  const [t, setT] = useState(initial);
  return (
    <form
      className="edit-note"
      onSubmit={(ev) => {
        ev.preventDefault();
        save(t);
      }}
    >
      <BackRow onBack={back} title="Add a note" />
      <label className="sr-only" htmlFor="edit-note-t">Note</label>
      <textarea id="edit-note-t" className="edit-note-t" rows={3} maxLength={2000} value={t} onChange={(ev) => setT(ev.target.value)} placeholder="A reminder for you" />
      <div className="edit-note-foot">
        <Button type="button" onClick={back}>Cancel</Button>
        <Button type="submit" variant="secondary">{t.trim() ? 'Save note' : initial ? 'Remove note' : 'Save note'}</Button>
      </div>
    </form>
  );
}

function DayList({ entry: e, doc, model, defaults, profile, start, back, pick }: Pick<Props, 'entry' | 'doc' | 'model' | 'defaults' | 'profile' | 'start'> & { back: () => void; pick: (n: number, after: string | null) => void }) {
  const [rows, setRows] = useState<DayChoice[] | null>(null);
  useEffect(() => {
    let live = true;
    void import('@travel/core/schedule/template.ts').then((engine) => {
      if (!live) return;
      try {
        const r = dayChoices({
          engine,
          days: model.days,
          delta: deltaOfDraft(doc),
          overrides: doc.template?.overrides ?? {},
          profile,
          addItem: (a) => {
            const c = model.addables[a.slug];
            return c ? candidateToItem(c) : null;
          },
          start,
          stop: stopTarget(doc, e),
        });
        setRows(r);
      } catch {
        // the scheduler could not try a day: the list still offers every day, with no fit words
        setRows(model.days.map((d) => ({ n: d.n, label: `Day ${d.n}`, base: d.base, current: d.n === e.day, ends: null, driving: null, fit: 'fits' as const, reason: null, last: null })));
      }
    });
    return () => {
      live = false;
    };
    // the list is worked out once per open: the document does not change while it is showing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  void defaults;
  return (
    <div className="edit-days">
      <BackRow onBack={back} title="Move to day" />
      {rows === null ? (
        <p className="edit-why" role="status">Checking each day</p>
      ) : (
        <ul className="edit-daylist">
          {rows.map((r) => (
            <li key={r.n}>
              <button type="button" role="menuitem" className="edit-row edit-day" disabled={r.current} onClick={() => pick(r.n, r.last)} data-fit={r.fit}>
                <span className="edit-day-main">
                  <span className="edit-day-name">{r.current ? `Now on Day ${r.n}` : r.label}</span>
                  <span className="edit-day-sub num">{[r.base ? `Base: ${r.base}` : null, r.ends ? `ends ${r.ends}` : null, r.driving ? `${r.driving} ≈` : null].filter(Boolean).join(' · ')}</span>
                  {r.reason ? <span className="edit-day-reason">{r.reason}</span> : null}
                </span>
                {r.current || r.fit === 'fix' ? null : <span className="edit-fit" data-fit={r.fit}>{r.fit === 'fits' ? 'Fits' : 'Tight'}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
