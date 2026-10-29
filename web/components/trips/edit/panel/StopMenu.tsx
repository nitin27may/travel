'use client';

import { useEffect, useState } from 'react';
import type { TimelineEntry } from '@travel/core/schedule/types.ts';
import type { Profile } from '@travel/core/schedule/types.ts';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { candidateToItem, type TimelineModel } from '@/components/trips/timeline/model';
import { usePrefs } from '@/lib/format/prefs';
import { formatDistance } from '@/lib/format/units';
import { deltaOfDraft } from '@/lib/trip-edit/source';
import { dayChoices, type DayChoice } from '@/lib/trip-edit/moveFit';
import { peekTimeline } from '@/lib/export/timelineState';
import { maybeOps, noteOf, placeRefOf, stopTarget } from '@/lib/trip-edit/stopOps';
import { ruleItemOfEntry, ruleNote } from '@/lib/trip-edit/ruleRows';
import type { PlanDraft } from '@/lib/trip-edit/model';
import { ActionPanel } from './ActionPanel';
import { KeepSwitches } from '../built/KeepSwitches';

export interface StopAct {
  remove: (e: TimelineEntry) => void;
  moveTo: (e: TimelineEntry, day: number, after: string | null) => void;
  nudge: (e: TimelineEntry, dir: -1 | 1) => void;
  maybe: (e: TimelineEntry) => void;
  note: (e: TimelineEntry, text: string) => void;
  /** Swap with another stop of the trip (edit-mode-spec 5.2): both change places, one undo step. */
  swap: (e: TimelineEntry, other: TimelineEntry) => void;
  /** Swap for a nearby place: opens the add picker for this stop. Absent when the trip is not a copy. */
  swapNearby?: (e: TimelineEntry, dayEntries: readonly TimelineEntry[]) => void;
  /** Keep on Day n and Must see (STEP2-B2): a built trip's stops only. */
  keep?: (e: TimelineEntry, on: boolean) => void;
  must?: (e: TimelineEntry, on: boolean) => void;
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

type View = 'rows' | 'days' | 'note' | 'swap';

/** The stops a day holds, in time order: the entries that are stops, not legs, meals the rules placed or the sun (the ones with a source id). */
export const stopsOfDay = (entries: readonly TimelineEntry[]): TimelineEntry[] =>
  entries.filter((e) => !!e.sourceItemId && !e.insideOf && !e.block && e.kind !== 'sun' && e.kind !== 'leg' && e.kind !== 'booking');

/**
 * The `⋯` of one row and the sheet or menu it opens (components 8.7): Move to day…, Move up, Move down, Swap with…, Swap for a nearby
 * place, Add to Maybe, Add a note, Open place page, then Remove last. A row the rules made (a meal, a rest, the hire car, check-in, the end of the day; STEP2-E1B) is not a
 * place and keeps its place in the day, so it offers Add a note and Remove only, with one line on what stays when removing it leaves the
 * day relying on it (edit-mode-spec 5.4).
 */
export function StopMenu({ entry: e, dayEntries, doc, model, defaults, profile, start, act }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('rows');
  const stops = stopsOfDay(dayEntries);
  const i = stops.findIndex((s) => s.id === e.id);
  const alone = stops.length <= 1;
  const base = model.days.find((d) => d.n === e.day)?.base ?? null;
  const meta = [`Day ${e.day}`, e.start && e.kind !== 'leg' ? e.start : null, base ? `Base: ${base}` : null].filter(Boolean).join(' · ');
  const rule = !!doc.template && ruleItemOfEntry(e) !== null;
  const consequence = rule ? ruleNote(e, dayEntries) : null;
  const href = !rule && e.at?.placeSlug ? `/places/${e.at.placeSlug}/` : null;
  const canMaybe = !rule && !!doc.template && !!placeRefOf(e) && maybeOps(doc, e) !== null;
  const reset = (o: boolean) => {
    setOpen(o);
    if (!o) setView('rows');
  };
  const done = (fn: () => void) => () => {
    reset(false);
    fn();
  };
  const others = rule || i < 0 || !swappable(e) ? [] : otherStopsOf(e);
  const upBlock = i <= 0 ? (alone ? `${e.title} is the only stop on Day ${e.day}` : `${e.title} is already first on Day ${e.day}`) : null;
  const downBlock = i < 0 || i >= stops.length - 1 ? (alone ? `${e.title} is the only stop on Day ${e.day}` : `${e.title} is already last on Day ${e.day}`) : null;
  return (
    <ActionPanel label={`Actions for ${e.title}, Day ${e.day}`} title={e.title} meta={view === 'rows' ? meta : undefined} open={open} onOpenChange={reset}>
      {view === 'rows' ? (
        <>
          {rule ? null : (
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
              {upBlock ? <p className="edit-why">{upBlock}</p> : downBlock ? <p className="edit-why">{downBlock}</p> : null}
              {others.length ? (
                <button type="button" role="menuitem" className="edit-row" onClick={() => setView('swap')}>
                  <Icon name="swap" size={16} /> <span>Swap with…</span>
                </button>
              ) : null}
              {act.swapNearby ? (
                <button type="button" role="menuitem" className="edit-row" onClick={done(() => act.swapNearby!(e, dayEntries))}>
                  <Icon name="pin" size={16} /> <span>Swap for a nearby place</span>
                </button>
              ) : null}
            </>
          )}
          {act.keep && act.must && !doc.template && !rule ? <KeepSwitches entry={e} doc={doc} onKeep={(on) => act.keep!(e, on)} onMust={(on) => act.must!(e, on)} /> : null}
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
          {consequence ? <p className="edit-why edit-consequence" id={`edit-why-${e.day}-${e.id}`}>{consequence}</p> : null}
          <button type="button" role="menuitem" className="edit-row edit-crit" aria-describedby={consequence ? `edit-why-${e.day}-${e.id}` : undefined} onClick={done(() => act.remove(e))}>
            <Icon name="close" size={16} /> <span>Remove from Day {e.day}</span>
          </button>
        </>
      ) : view === 'swap' ? (
        <SwapList entry={e} others={others} back={() => setView('rows')} pick={(o) => done(() => act.swap(e, o))()} />
      ) : view === 'days' ? (
        <DayList entry={e} doc={doc} model={model} defaults={defaults} profile={profile} start={start} back={() => setView('rows')} pick={(n, after) => done(() => act.moveTo(e, n, after))()} />
      ) : (
        <NoteField initial={noteOf(doc, e)} back={() => setView('rows')} save={(t) => done(() => act.note(e, t))()} />
      )}
    </ActionPanel>
  );
}

/** A place the person visits: the stops that swap (a regroup row, a meal or a break is not one). */
const swappable = (e: TimelineEntry): boolean => e.kind === 'visit' || e.kind === 'trail';

/** The other stops of the trip, in day order, from the timelines the page shows. */
function otherStopsOf(e: TimelineEntry): TimelineEntry[] {
  const tls = peekTimeline()?.timelines ?? [];
  return [...tls].sort((a, b) => a.day - b.day).flatMap((tl) => stopsOfDay(tl.entries)).filter((o) => swappable(o) && !(o.id === e.id && o.day === e.day));
}

function SwapList({ entry: e, others, back, pick }: { entry: TimelineEntry; others: TimelineEntry[]; back: () => void; pick: (o: TimelineEntry) => void }) {
  const days = [...new Set(others.map((o) => o.day))];
  return (
    <div className="edit-days">
      <BackRow onBack={back} title="Swap with" />
      <ul className="edit-daylist">
        {days.map((d) => (
          <li key={d} className="edit-swap-day">
            <p className="edit-swap-h num">{d === e.day ? `Day ${d} (this day)` : `Day ${d}`}</p>
            <ul className="edit-daylist">
              {others.filter((o) => o.day === d).map((o) => (
                <li key={o.id}>
                  <button type="button" role="menuitem" className="edit-row edit-day" onClick={() => pick(o)} aria-label={`Swap ${e.title} with ${o.title}, Day ${o.day}`}>
                    <span className="edit-day-main">
                      <span className="edit-day-name">{o.title}</span>
                      {o.start ? <span className="edit-day-sub num">{o.start}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BackRow({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="edit-back">
      <button type="button" className="edit-back-btn" onClick={onBack} aria-label="Back to actions">
        <Icon name="chevronLeft" size={18} />
      </button>
      <span className="edit-back-title">{title}</span>
    </div>
  );
}

export function NoteField({ initial, back, save }: { initial: string; back: () => void; save: (t: string) => void }) {
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
  const [prefs] = usePrefs();
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
        setRows(model.days.map((d) => ({ n: d.n, label: `Day ${d.n}`, base: d.base, current: d.n === e.day, ends: null, driving: null, fit: 'fits' as const, reason: null, last: null, km: null, near: true })));
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
                  <span className="edit-day-sub num">{[!r.current && r.km !== null ? `${formatDistance(r.km, prefs.distance)} from ${r.base ?? 'the day'}` : r.base ? `Base: ${r.base}` : null, r.ends ? `ends ${r.ends}` : null, r.driving ? `${r.driving} ≈` : null].filter(Boolean).join(' · ')}</span>
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
