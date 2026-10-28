'use client';

// Edit mode on the trip details page (STEP2-E1). This chunk loads on the first Edit trip press, a `?edit=1` address, or the first Show of
// the changes line; read mode and the public page never fetch it (patterns 3.13 item 14). It renders nothing in the page's flow: it holds
// the edit session (the undo stack, the toasts, the announcements), publishes the slots the timeline draws (`TimelineExtras.edit`, the
// sticky bar's tools, the cover's `⋯`) through EditHost, and mounts the phone's edit bar and the changes sheet.
//
// Slots left for the other E packages, wired but empty: `handle` (E2, drag), `addPicker` (E3), `dayMenu` (E4), `dayStatus` (E5); see
// components/trips/timeline/editSlots.ts.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TimelineEntry, Profile } from '@travel/core/schedule/types.ts';
import type { TimelineModel } from '@/components/trips/timeline/model';
import type { EditSlots } from '@/components/trips/timeline/editSlots';
import { TRIP_EDIT_UI } from '@/lib/config/product';
import { changeRows, type ChangeRow } from '@/lib/trip-edit/changes';
import { changeCount } from '@/lib/trip-edit/marks';
import type { PlanDraft, PlanOp } from '@/lib/trip-edit/model';
import type { SaveResult, SyncWord, Where } from '@/lib/trip-edit/open';
import { maybeOps, maybeWords, movedWords, moveToDayOps, newOpId, noteOps, nudgeOps, nudgedWords, removeOps, removedWords } from '@/lib/trip-edit/stopOps';
import type { Published } from './shell/EditHost';
import { EditBar, EditTools } from './panel/EditChrome';
import { ChangesSheet } from './panel/ChangesSheet';
import { StopMenu, stopsOfDay } from './panel/StopMenu';
import { TripMenu } from './panel/TripMenu';
import { useEditSession } from './useEditSession';
import './edit.css';

export interface LayerProps {
  id: string;
  doc: PlanDraft;
  save: (ops: readonly PlanOp[]) => SaveResult;
  title: string;
  ours: { href: string; title: string } | null;
  model: TimelineModel;
  defaults: Profile;
  profile: Profile;
  start: string | null;
  where: Where;
  word: SyncWord;
  retry: (() => void) | null;
  /** edit mode is on (the address says so) */
  on: boolean;
  onDone: () => void;
  onSettings: () => void;
  /** a request from outside to open the changes sheet; `n` makes each press a new request */
  command: { n: number } | null;
  publish: (p: Published | null) => void;
}

const typing = (t: EventTarget | null): boolean => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function EditLayer(p: LayerProps) {
  const { doc, model, on } = p;
  const s = useEditSession(p.id, doc, p.save, TRIP_EDIT_UI.announceClearMs);
  const { commit, undo, redo } = s;
  const [changesOpen, setChangesOpen] = useState(false);
  const changes = changeCount(doc);

  const names = useMemo(() => {
    const items = new Map<string, string>();
    for (const d of model.days) for (const v of d.input.variants) for (const it of v.items) items.set(it.id, it.title);
    return { item: (id: string) => items.get(id) ?? null, place: (slug: string) => model.addables[slug]?.name ?? null };
  }, [model]);
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
        const stops = stopsOfDay(dayEntries);
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
    [doc, commit, focusAfter],
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
  const copy = !!doc.template;
  const published = useMemo<Published>(() => {
    const edit: EditSlots = {
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
      cover: <TripMenu id={p.id} title={p.title} where={p.where} copy={copy} changes={changes} canUndo={s.canUndo} canRedo={s.canRedo} onUndo={undo} onRedo={redo} onReset={resetAll} />,
    };
  }, [doc, model, p.defaults, p.profile, p.start, p.word, p.retry, p.onSettings, p.onDone, p.id, p.title, p.where, act, s.canUndo, s.canRedo, s.undoLabel, s.redoLabel, undo, redo, copy, changes, resetAll]);
  useEffect(() => {
    publish(published);
  }, [published, publish]);
  useEffect(() => () => publish(null), [publish]);

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{s.say}</div>
      {on ? <EditBar title={p.title} onSettings={p.onSettings} onDone={p.onDone} /> : null}
      <ChangesSheet open={changesOpen} onClose={() => setChangesOpen(false)} rows={rows} ours={p.ours} onRow={onRow} onReset={resetAll} />
    </>
  );
}
