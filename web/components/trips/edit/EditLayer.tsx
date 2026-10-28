'use client';

// Edit mode on the trip details page (STEP2-E1). This chunk loads on the first Edit trip press, a `?edit=1` address, or the first Show of
// the changes line; read mode and the public page never fetch it (patterns 3.13 item 14). It renders nothing in the page's flow: it holds
// the edit session (the undo stack, the toasts, the announcements), publishes the slots the timeline draws (`TimelineExtras.edit`, the
// sticky bar's tools, the cover's `⋯`) through EditHost, and mounts the phone's edit bar and the changes sheet.
//
// Slots: `handle` (E2, drag), `addPicker` (E3, add/), `dayMenu` and `dayStatus` (E4: the day's `⋯` and its note and warning levels;
// E5 adds the fixes); see components/trips/timeline/editSlots.ts.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TimelineEntry, Profile } from '@travel/core/schedule/types.ts';
import type { AddCandidate, TimelineModel } from '@/components/trips/timeline/model';
import type { DayCtx, EditSlots } from '@/components/trips/timeline/editSlots';
import { TRIP_EDIT_UI } from '@/lib/config/product';
import { changeRows, type ChangeRow } from '@/lib/trip-edit/changes';
import { changeCount } from '@/lib/trip-edit/marks';
import type { PlanDraft, PlanOp } from '@/lib/trip-edit/model';
import type { SaveResult, SyncWord, Where } from '@/lib/trip-edit/open';
import { refOfDay } from '@/lib/trip-edit/dayMap';
import { candidateToItem } from '@/components/trips/timeline/model';
import { ruleItemOfEntry, ruleName } from '@/lib/trip-edit/ruleRows';
import { maybeOps, maybeWords, movedWords, moveToDayOps, newOpId, noteOps, nudgeOps, nudgedWords, removeOps, removedWords } from '@/lib/trip-edit/stopOps';
import type { Published } from './shell/EditHost';
import { EditBar, EditTools } from './panel/EditChrome';
import { ChangesSheet } from './panel/ChangesSheet';
import { StopMenu, stopsOfDay } from './panel/StopMenu';
import { TripMenu } from './panel/TripMenu';
import { DragHandle } from './drag/DragHandle';
import { AddRow } from './add/AddRow';
import { DayMenu } from './day/DayMenu';
import { DayStatus } from './day/DayStatus';
import { clearAll } from './warnings/store';
import { SummaryChecks } from './warnings/WarnCount';
import { addDayOps, addedDayNumber, dayBookings, dayNoteOf, dayNoteOps, droppedWords, dropDayOps, resetDayOps, versionOps, type DropHow } from './day/dayOps';
import { useEditSession } from './useEditSession';
import './add/add.css';
import './edit.css';

// drag and the keyboard model load after the chunk (STEP2-E2): the handle itself is tiny and static, the listeners and the `?` list are not
const DragLayer = lazy(() => import('./drag/DragLayer'));
// the picker, its scheduler and its reads are their own chunk: they load on the first press of an add row or an `add=` address
const AddPicker = lazy(() => import('./add/AddPicker').then((m) => ({ default: m.AddPicker })));

export interface LayerProps {
  id: string;
  /** the public trip's slug (the id for a built trip): Print asks the export menu under it */
  slug: string;
  doc: PlanDraft;
  save: (ops: readonly PlanOp[]) => SaveResult;
  title: string;
  ours: { href: string; title: string } | null;
  model: TimelineModel;
  defaults: Profile;
  profile: Profile;
  start: string | null;
  where: Where;
  /** the rows of the Bookings tab (name and the day each counts from), so Drop Day n can ask when a booking is on it */
  bookings: readonly { name: string; day: number | null }[];
  word: SyncWord;
  retry: (() => void) | null;
  /** edit mode is on (the address says so) */
  on: boolean;
  onDone: () => void;
  onSettings: () => void;
  /** a request from outside to open the changes sheet; `n` makes each press a new request */
  command: { n: number } | null;
  publish: (p: Published | null) => void;
  /** hands the page a place the plan model does not carry, so the timeline can schedule it (STEP2-E3) */
  register: (c: AddCandidate) => void;
}

const typing = (t: EventTarget | null): boolean => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function EditLayer(p: LayerProps) {
  const { doc, model, on } = p;
  const s = useEditSession(p.id, doc, p.save, TRIP_EDIT_UI.announceClearMs);
  const { commit, undo, redo } = s;
  const [changesOpen, setChangesOpen] = useState(false);
  // the add picker: for a day (the add row), or for a place a page sent (`add=<slug>`, edit-mode-spec 7.4)
  const [pick, setPick] = useState<{ day: number | null; slug: string | null } | null>(null);
  const pickDay = useRef<number | null>(null);
  const openPicker = useCallback((day: number) => {
    pickDay.current = day;
    setPick({ day, slug: null });
  }, []);
  // closing returns focus to the day's add row (edit-mode-spec 7.3)
  const closePicker = useCallback(() => {
    const day = pickDay.current;
    pickDay.current = null;
    setPick(null);
    if (day) window.setTimeout(() => document.querySelector<HTMLElement>(`#day-${day} .tl-add-open`)?.focus({ preventScroll: true }), 80);
  }, []);
  const changes = changeCount(doc);

  const names = useMemo(() => {
    const items = new Map<string, string>();
    for (const d of model.days) for (const v of d.input.variants) for (const it of v.items) items.set(it.id, it.title);
    return {
      item: (id: string) => items.get(id) ?? null,
      place: (slug: string) => model.addables[slug]?.name ?? null,
      rule: (day: number, item: string) => ruleName(model.defaultTimelines, day, item),
    };
  }, [model]);
  // every row of a day has actions (STEP2-E1B): the stops, and on a copy the rows the rules made (a built trip's wait for STEP2-B2)
  const copy = !!doc.template;
  // a row the rules made on a day the person added has no published day number to key its removal on (edit-mode-spec 5.4), so it has no menu
  const canEdit = useCallback(
    (e: TimelineEntry) => stopsOfDay([e]).length === 1 || (copy && ruleItemOfEntry(e) !== null && typeof refOfDay(doc.template?.days ?? [], e.day) === 'number'),
    [copy, doc.template?.days],
  );
  const rows = useMemo(() => changeRows(doc, names, newOpId), [doc, names]);

  // a request from outside (Show on the changes line) opens the sheet once per press
  const [seenCommand, setSeenCommand] = useState(p.command);
  if (p.command !== seenCommand) {
    setSeenCommand(p.command);
    if (p.command) setChangesOpen(true);
  }

  // while editing: the phone's public bar steps aside (CSS reads this), and the mode is announced once each way
  useEffect(() => {
    if (!on) return;
    document.documentElement.dataset.tripEditing = '';
    s.announce(`Editing ${p.title}`);
    return () => {
      delete document.documentElement.dataset.tripEditing;
      s.announce('Done editing');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the announcement is for entering and leaving only
  }, [on]);

  // a place page sent `add=<slug>`: the picker opens with it, and the key leaves the address (patterns 1.2)
  useEffect(() => {
    if (!on) return;
    const u = new URL(window.location.href);
    const slug = u.searchParams.get('add');
    if (!slug) return;
    u.searchParams.delete('add');
    window.history.replaceState(window.history.state, '', `${u.pathname}${u.search}${u.hash}`);
    if (/^[a-z0-9][a-z0-9-]*$/.test(slug)) setPick({ day: null, slug });
  }, [on]);

  // Ctrl or Cmd+Z undoes, with Shift redoes (patterns 1.3), anywhere on the page but a field
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== 'z' || typing(e.target)) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [undo, redo]);

  // focus: after Remove to the next stop, else the day's add row; after Move to day the moved stop, scrolled to (patterns 3.13 item 15)
  const focusAfter = useCallback((where: { entry: string } | { next: string | null; day: number }) => {
    window.setTimeout(() => {
      if ('entry' in where) {
        void import('@/components/trips/revealEntry').then((m) => m.revealEntry(where.entry));
        return;
      }
      const li = where.next ? document.querySelector<HTMLElement>(`[data-entry="${CSS.escape(`${where.day}:${where.next}`)}"]`) : null;
      const target = li?.querySelector<HTMLElement>('.tl-edit-trail button') ?? document.querySelector<HTMLElement>(`#day-${where.day} .tl-add-open`);
      target?.focus({ preventScroll: true });
    }, 80);
  }, []);

  const act = useMemo(
    () => ({
      remove: (e: TimelineEntry, dayEntries: readonly TimelineEntry[]) => {
        const stops = dayEntries.filter(canEdit);
        const i = stops.findIndex((x) => x.id === e.id);
        const next = stops[i + 1]?.id ?? stops[i - 1]?.id ?? null;
        if (commit(removeOps(doc, e), removedWords(e))) focusAfter({ next, day: e.day });
      },
      moveTo: (e: TimelineEntry, day: number, after: string | null) => {
        if (commit(moveToDayOps(doc, e, day, after), movedWords(e, day))) focusAfter({ entry: `${day}:${e.id}` });
      },
      nudge: (e: TimelineEntry, dir: -1 | 1, dayEntries: readonly TimelineEntry[]) => {
        const ops = nudgeOps(doc, e, stopsOfDay(dayEntries), dir);
        if (ops && commit(ops, nudgedWords(e, dir))) focusAfter({ entry: `${e.day}:${e.id}` });
      },
      maybe: (e: TimelineEntry) => {
        const ops = maybeOps(doc, e);
        if (ops) commit(ops, maybeWords(e));
      },
      note: (e: TimelineEntry, text: string) => {
        commit(noteOps(doc, e, text), text.trim() ? `Saved a note on ${e.title}` : `Removed the note on ${e.title}`);
      },
    }),
    [doc, commit, focusAfter, canEdit],
  );

  // the day actions (STEP2-E4): each is one undo step; the new or neighbouring day is scrolled to once the scheduler has drawn it
  const afterDays = useCallback((selector: string) => {
    const t0 = performance.now();
    const look = () => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
        el.focus({ preventScroll: true });
      } else if (performance.now() - t0 < 2500) requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  }, []);
  const dayAct = useMemo(
    () => ({
      add: (n: number) => {
        const ops = addDayOps(doc, n);
        const at = addedDayNumber(doc, ops[0]!);
        if (commit(ops, `Added Day ${at ?? n + 1}`) && at) afterDays(`#day-${at} .tl-add-open`);
      },
      drop: (n: number, how: DropHow, stops: readonly TimelineEntry[]) => {
        if (commit(dropDayOps(doc, n, how, stops), droppedWords(n, how, stops.length))) afterDays(`#day-${Math.max(1, n - 1)} .day-more`);
      },
      reset: (n: number) => {
        const ops = resetDayOps(doc, n);
        if (ops) commit(ops, `Day ${n} is back to our plan`);
      },
      note: (n: number, text: string) => {
        commit(dayNoteOps(doc, n, text), text.trim() ? `Saved a note on Day ${n}` : `Removed the note on Day ${n}`);
      },
      version: (n: number, key: 'A' | 'B' | 'C' | null) => {
        const ops = versionOps(doc, n, key);
        if (ops) commit(ops, key ? `Day ${n} now uses version ${key}` : `Day ${n} is back to the version chosen for your settings`);
      },
    }),
    [doc, commit, afterDays],
  );
  const addedFor = useCallback(
    (n: number) => {
      const ref = refOfDay(doc.template?.days ?? [], n);
      return (doc.template?.added ?? []).flatMap((a) => {
        const c = a.day === ref && a.ref.startsWith('place/') ? model.addables[a.ref.slice('place/'.length)] : undefined;
        return c ? [candidateToItem(c)] : [];
      });
    },
    [doc, model],
  );

  const resetAll = useCallback(() => {
    commit([{ kind: 'reset', id: newOpId(), day: null } as PlanOp], 'Reset to our plan');
  }, [commit]);
  const onRow = useCallback(
    (r: ChangeRow) => {
      commit(r.ops, r.done);
    },
    [commit],
  );

  const { publish } = p;
  const published = useMemo<Published>(() => {
    const edit: EditSlots = {
      canEdit,
      handle: (e) => <DragHandle entry={e} />,
      ...(copy
        ? {
            addPicker: (day: number) => <AddRow day={day} onOpen={openPicker} />,
            dayMenu: (n: number, ctx: DayCtx) => (
              <DayMenu
                n={n}
                doc={doc}
                tl={ctx.tl}
                day={ctx.day}
                published={model.days.length}
                start={p.start}
                profile={p.profile}
                bookings={dayBookings(ctx.tl, p.bookings, typeof ctx.day.ref === 'number' ? ctx.day.ref : null)}
                addedItems={addedFor(n)}
                act={dayAct}
              />
            ),
            dayStatus: (n: number, ctx: DayCtx) => <DayStatus n={n} note={dayNoteOf(doc, n)} tl={ctx.tl} plan={{ doc, model, profile: p.profile, start: p.start }} canEdit={canEdit} act={{ moveTo: act.moveTo, remove: act.remove }} />,
          }
        : {}),
      trail: (e, dayEntries) => (
        <StopMenu
          entry={e}
          dayEntries={dayEntries}
          doc={doc}
          model={model}
          defaults={p.defaults}
          profile={p.profile}
          start={p.start}
          act={{ remove: (x) => act.remove(x, dayEntries), moveTo: act.moveTo, nudge: (x, d) => act.nudge(x, d, dayEntries), maybe: act.maybe, note: act.note }}
        />
      ),
    };
    return {
      edit,
      tools: (
        <EditTools
          canUndo={s.canUndo}
          canRedo={s.canRedo}
          undoLabel={s.undoLabel}
          redoLabel={s.redoLabel}
          onUndo={undo}
          onRedo={redo}
          changes={copy ? changes : 0}
          onShowChanges={() => setChangesOpen(true)}
          word={p.word}
          onRetry={p.retry}
          onSettings={p.onSettings}
          onDone={p.onDone}
        />
      ),
      commit: (ops, label) => commit(ops, label),
      checks: copy ? <SummaryChecks /> : null,
      cover: <TripMenu id={p.id} slug={p.slug} title={p.title} where={p.where} copy={copy} changes={changes} canUndo={s.canUndo} canRedo={s.canRedo} onUndo={undo} onRedo={redo} onReset={resetAll} />,
    };
  }, [canEdit, openPicker, doc, model, p.defaults, p.profile, p.start, p.bookings, dayAct, addedFor, p.word, p.retry, p.onSettings, p.onDone, p.id, p.title, p.where, act, commit, s.canUndo, s.canRedo, s.undoLabel, s.redoLabel, undo, redo, copy, changes, resetAll]);
  useEffect(() => {
    publish(published);
  }, [published, publish]);
  useEffect(() => () => publish(null), [publish]);
  // the warning counts belong to the edit session: a new session starts from the day headers' own reports
  useEffect(() => clearAll, []);

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{s.say}</div>
      {on ? (
        <Suspense fallback={null}>
          <DragLayer doc={doc} model={model} profile={p.profile} start={p.start} commit={commit} announce={s.announce} remove={act.remove} onDone={p.onDone} />
        </Suspense>
      ) : null}
      {on ? <EditBar title={p.title} canUndo={s.canUndo} canRedo={s.canRedo} undoLabel={s.undoLabel} redoLabel={s.redoLabel} onUndo={undo} onRedo={redo} onSettings={p.onSettings} onDone={p.onDone} /> : null}
      {pick && copy ? (
        <Suspense fallback={null}>
          <AddPicker doc={doc} model={model} profile={p.profile} start={p.start} day={pick.day} slug={pick.slug} onClose={closePicker} commit={commit} register={p.register} undo={undo} undoLabel={s.undoLabel} />
        </Suspense>
      ) : null}
      <ChangesSheet open={changesOpen} onClose={() => setChangesOpen(false)} rows={rows} ours={p.ours} onRow={onRow} onReset={resetAll} />
    </>
  );
}
