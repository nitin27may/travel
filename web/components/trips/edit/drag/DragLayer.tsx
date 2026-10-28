'use client';

// Drag and the keyboard model of edit mode (STEP2-E2; edit-mode-spec 5.2, 5.3; components 8.1; patterns 1.3). One delegated set of
// listeners on the page, loaded after the edit chunk: nothing is attached to the rows themselves. Three ways in, one way out:
//   mouse or pen  press on the handle and move 4 px, or on the row body and move 8 px; any day, or a day cell of the day rail
//   touch         long-press on the handle only (a press on the row body scrolls); only inside the stop's own day (ruling R4)
//   keyboard      Space or Enter on the handle lifts; arrows, Page keys, Home, End move; Space or Enter drops; Esc puts it back
// Every path ends in `dropOps` (E1's `moveItem`), so a drop is one undo step with E1's toast, exactly like the Move to day sheet.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Profile } from '@travel/core/schedule/types.ts';
import type { TimelineEntry } from '@travel/core/schedule/types.ts';
import type { TimelineModel } from '@/components/trips/timeline/model';
import { TRIP_EDIT_UI } from '@/lib/config/product';
import type { DayChoice } from '@/lib/trip-edit/moveFit';
import type { PlanDraft } from '@/lib/trip-edit/model';
import { nudgeOps, nudgedWords } from '@/lib/trip-edit/stopOps';
import type { EditSession } from '../useEditSession';
import { DRAG_HELP_ID } from './DragHandle';
import { loadChoices } from './fit';
import { KeysHelp } from './KeysHelp';
import {
  cancelledWords, dropOps, dropWords, droppedWords, edgeSpeed, indexAt, keyTarget, lifted, MOVE_KEYS, pillText, stepWords, type Target,
} from './plan';
import { dayNumbers, entryFor, parseKey, stopEntries, stopRows } from './registry';
import { readSingleKeys, writeSingleKeys } from './singleKeys';
import './drag.css';

export interface DragProps {
  doc: PlanDraft;
  model: TimelineModel;
  profile: Profile;
  start: string | null;
  commit: EditSession['commit'];
  announce: (s: string) => void;
  /** Remove with the layer's own focus rule (to the next stop, else the day's add row) */
  remove: (e: TimelineEntry, dayEntries: readonly TimelineEntry[]) => void;
  onDone: () => void;
}

type Hit = { kind: 'rail'; day: number } | { kind: 'slot'; t: Target } | null;
interface View {
  line: { left: number; top: number; width: number } | null;
  pill: { text: string; left: number; top: number; below: boolean } | null;
}
interface Live {
  via: 'pointer' | 'key';
  key: string;
  origin: Target;
  hit: Hit;
  touch: boolean;
  px: number;
  py: number;
  x: number;
  y: number;
  ghost: HTMLElement | null;
  raf: number;
  railTimer: number;
  railDay: number | null;
  choices: Map<number, DayChoice>;
  /** the pointer moved since the hit was last worked out */
  moved: boolean;
}
interface Pending {
  key: string;
  touch: boolean;
  handle: boolean;
  x0: number;
  y0: number;
  x: number;
  y: number;
  timer: number;
}

const U = TRIP_EDIT_UI;
const EMPTY: View = { line: null, pill: null };
const reduced = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const typing = (t: EventTarget | null): boolean => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
const insideOverlay = (t: Element): boolean => !!t.closest('[role="menu"],[role="dialog"],dialog,[aria-modal="true"],[role="listbox"]');
const handleOf = (key: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-drag-handle="${CSS.escape(key)}"]`);
const rowOf = (key: string): HTMLElement | null => document.querySelector<HTMLElement>(`li.tl-entry[data-entry="${CSS.escape(key)}"]`);

/** The number of OTHER stops on each day (the dragged one left out). */
function otherCounts(key: string): Map<number, number> {
  return new Map(dayNumbers().map((d) => [d, stopRows(d).filter((li) => li.dataset.entry !== key).length]));
}
const othersOf = (day: number, key: string): HTMLElement[] => stopRows(day).filter((li) => li.dataset.entry !== key);
const timeOf = (li: HTMLElement | undefined): string | null => {
  const t = li?.querySelector<HTMLElement>('.tl-time > span')?.textContent?.replace('~', '').trim();
  return t && /^\d/.test(t) ? t : null;
};

/** Where the insertion line sits for a target: the content column to the right edge, at the top of the stop it lands before. */
function lineFor(t: Target, key: string): { left: number; top: number; width: number; before: string | null } | null {
  const day = document.getElementById(`day-${t.day}`);
  const rail = day?.querySelector<HTMLElement>('.tl-rail');
  if (!day || !rail) return null;
  const others = othersOf(t.day, key);
  const rr = rail.getBoundingClientRect();
  const body = (others[0] ?? rail.querySelector<HTMLElement>('li.tl-entry'))?.querySelector<HTMLElement>('.tl-body')?.getBoundingClientRect();
  const left = body ? body.left : rr.left + rr.width * 0.25;
  const next = others[t.index];
  const prev = others[t.index - 1];
  const top = next ? next.getBoundingClientRect().top : prev ? prev.getBoundingClientRect().bottom : rr.top + 12;
  return { left, top, width: Math.max(0, rr.right - left), before: timeOf(next) };
}

export default function DragLayer(props: DragProps) {
  const P = useRef(props);
  const [view, setView] = useState<View>(EMPTY);
  const [helpOpen, setHelpOpen] = useState(false);
  const [single, setSingleState] = useState(readSingleKeys);
  const singleRef = useRef(single);
  const lastView = useRef('');
  useEffect(() => {
    P.current = props;
  });
  const setSingle = useCallback((on: boolean) => {
    singleRef.current = on;
    setSingleState(on);
    writeSingleKeys(on);
  }, []);

  useEffect(() => {
    let live: Live | null = null;
    let pending: Pending | null = null;
    let swallowClick = false;
    const w = window;
    const say = (s: string) => P.current.announce(s);

    const render = (v: View) => {
      const j = JSON.stringify(v);
      if (j === lastView.current) return;
      lastView.current = j;
      setView(v);
    };

    /** Where a pointer is: a day cell of the rail, or a slot of a day. Touch stays in the stop's own day. */
    const hitAt = (L: Live, x: number, y: number): Hit => {
      if (!L.touch) {
        for (const el of document.elementsFromPoint(x, y)) {
          const cell = el.closest<HTMLElement>('.tl-rail-cell');
          if (cell) {
            const n = Number(/\d+/.exec(cell.getAttribute('aria-label') ?? '')?.[0]);
            if (n) return { kind: 'rail', day: n };
          }
        }
        const top = document.elementFromPoint(x, y);
        if (top?.closest('.tl-planbar,header,[role="dialog"],.toast')) return null;
      }
      let day: number | null = null;
      if (L.touch) day = L.origin.day;
      else {
        let best = 48;
        for (const n of dayNumbers()) {
          const r = document.getElementById(`day-${n}`)?.getBoundingClientRect();
          if (!r || x < r.left - 24 || x > r.right + 24) continue;
          const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
          if (d < best || (d === 0 && best === 0)) {
            best = d;
            day = n;
          }
        }
      }
      if (day === null) return null;
      const mids = othersOf(day, L.key).map((li) => {
        const r = li.getBoundingClientRect();
        return r.top + r.height / 2;
      });
      return { kind: 'slot', t: { day, index: indexAt(mids, y) } };
    };

    const show = (L: Live, hit: Hit) => {
      L.hit = hit;
      L.ghost?.toggleAttribute('data-over-rail', hit?.kind === 'rail');
      for (const c of document.querySelectorAll('[data-drop-target]')) c.removeAttribute('data-drop-target');
      let nextRail: number | null = null;
      if (!hit) return render(EMPTY);
      if (hit.kind === 'rail') {
        nextRail = hit.day;
        const cell = [...document.querySelectorAll<HTMLElement>('.tl-rail-cell')].find((c) => Number(/\d+/.exec(c.getAttribute('aria-label') ?? '')?.[0]) === hit.day);
        cell?.setAttribute('data-drop-target', '');
        const r = cell?.getBoundingClientRect();
        const text = pillText(hit.day, null, hit.day === L.origin.day ? null : (L.choices.get(hit.day)?.driving ?? null));
        render({ line: null, pill: r ? { text, left: r.left, top: r.bottom + 6, below: true } : null });
      } else {
        const g = lineFor(hit.t, L.key);
        if (!g) return render(EMPTY);
        const text = pillText(hit.t.day, g.before, hit.t.day === L.origin.day ? null : (L.choices.get(hit.t.day)?.driving ?? null));
        render({ line: { left: g.left, top: g.top, width: g.width }, pill: { text, left: g.left, top: g.top, below: false } });
      }
      // hovering a day cell for a moment scrolls to that day (components 8.1)
      if (nextRail !== L.railDay) {
        w.clearTimeout(L.railTimer);
        L.railDay = nextRail;
        if (nextRail !== null) {
          const d = nextRail;
          L.railTimer = w.setTimeout(() => document.getElementById(`day-${d}`)?.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }), U.railHoverMs);
        }
      }
    };

    const release = (L: Live) => {
      w.cancelAnimationFrame(L.raf);
      w.clearTimeout(L.railTimer);
      L.ghost?.remove();
      for (const c of document.querySelectorAll('[data-drop-target],[data-drag-origin]')) {
        c.removeAttribute('data-drop-target');
        c.removeAttribute('data-drag-origin');
      }
      const h = handleOf(L.key);
      h?.removeAttribute('aria-pressed');
      delete document.documentElement.dataset.tripDragging;
      lastView.current = '';
      setView(EMPTY);
      w.removeEventListener('pointermove', onMove);
      w.removeEventListener('pointerup', onUp);
      w.removeEventListener('pointercancel', onCancel);
    };

    /** Finish: drop (commit) or cancel (put it back). */
    const finish = (doDrop: boolean) => {
      const L = live;
      if (!L) return;
      live = null;
      const hit = L.hit;
      release(L);
      const e = entryFor(L.key);
      if (!e) return;
      const t: Target | null = !doDrop || !hit ? null : hit.kind === 'rail' ? { day: hit.day, index: othersOf(hit.day, L.key).length } : hit.t;
      const here = otherCounts(L.key).get(L.origin.day) ?? 0;
      if (!t) {
        say(cancelledWords(e, L.origin, here));
        if (L.via === 'key') handleOf(L.key)?.focus({ preventScroll: true });
        return;
      }
      const others = othersOf(t.day, L.key);
      const ops = dropOps(P.current.doc, e, t, others.map((li) => ({ id: parseKey(li.dataset.entry ?? '').id })), L.origin);
      if (!ops) {
        say(cancelledWords(e, L.origin, here));
        if (L.via === 'key') handleOf(L.key)?.focus({ preventScroll: true });
        return;
      }
      if (!P.current.commit(ops, dropWords(e, t, L.origin, others.length))) return;
      say(droppedWords(e, t, others.length, t.day !== L.origin.day));
      swallowClick = L.via === 'pointer';
      w.setTimeout(() => {
        swallowClick = false;
        const li = rowOf(`${t.day}:${e.id}`);
        if (!li) return;
        // the scheduler has the last word on the order (a fixed-time stop holds its place): say where the stop really is when that differs from the line
        const rows = stopRows(t.day);
        const at = rows.indexOf(li);
        if (at >= 0 && at !== t.index) say(droppedWords(e, { day: t.day, index: at }, rows.length - 1, t.day !== L.origin.day));
        if (L.via === 'key') {
          handleOf(`${t.day}:${e.id}`)?.focus({ preventScroll: true });
          const r = li.getBoundingClientRect();
          if (r.top < 120 || r.bottom > w.innerHeight - 24) li.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
        }
        if (!reduced()) {
          li.style.setProperty('--settle-ms', `${U.settleMs}ms`);
          li.setAttribute('data-settle', '');
          w.setTimeout(() => li.removeAttribute('data-settle'), U.settleMs);
        }
      }, 80);
    };

    const tick = () => {
      const L = live;
      if (!L) return;
      // the day rail sits in the top edge when the page bar is stuck there: a pointer deliberately on a day cell must not scroll the page away
      const dy = L.hit?.kind === 'rail' ? 0 : edgeSpeed(L.y, w.innerHeight, U.autoscrollEdgePx, U.autoscrollMaxPx);
      if (dy) w.scrollBy(0, dy);
      if (L.ghost) L.ghost.style.translate = `${L.x - L.px}px ${L.y - L.py}px`;
      // a day cell stays the target until the pointer moves: scrolling to that day makes the rail follow it, which slides another cell under a still pointer
      if (L.moved || L.hit?.kind !== 'rail') show(L, hitAt(L, L.x, L.y));
      L.moved = false;
      L.raf = w.requestAnimationFrame(tick);
    };

    const originOf = (key: string): Target | null => {
      const { day } = parseKey(key);
      const i = stopRows(day).findIndex((li) => li.dataset.entry === key);
      return i < 0 ? null : { day, index: i };
    };
    const fetchChoices = (L: Live, e: TimelineEntry) => {
      void loadChoices({ doc: P.current.doc, model: P.current.model, profile: P.current.profile, start: P.current.start, entry: e }).then((m) => {
        L.choices = m;
        if (live === L) show(L, L.hit);
      });
    };

    const beginPointer = (p: Pending) => {
      const li = rowOf(p.key);
      const origin = originOf(p.key);
      const e = entryFor(p.key);
      if (!li || !origin || !e) return;
      w.getSelection()?.removeAllRanges();
      const r = li.getBoundingClientRect();
      const ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.setAttribute('aria-hidden', 'true');
      const clone = li.cloneNode(true) as HTMLElement;
      for (const n of [clone, ...clone.querySelectorAll<HTMLElement>('[id],[data-entry],[data-flash],.tl-edit-trail')]) {
        n.removeAttribute('id');
        n.removeAttribute('data-entry');
        n.removeAttribute('data-flash');
      }
      clone.querySelector('.tl-edit-trail')?.remove();
      clone.querySelector('.drag-handle')?.setAttribute('tabindex', '-1');
      const rail = li.closest<HTMLElement>('.tl-rail');
      ghost.style.gridTemplateColumns = rail ? w.getComputedStyle(rail).gridTemplateColumns : '';
      ghost.style.columnGap = rail ? w.getComputedStyle(rail).columnGap : '';
      ghost.style.left = `${r.left - 8}px`;
      ghost.style.top = `${r.top}px`;
      ghost.style.width = `${r.width + 16}px`;
      ghost.appendChild(clone);
      document.body.appendChild(ghost);
      w.requestAnimationFrame(() => ghost.setAttribute('data-lift', ''));
      li.setAttribute('data-drag-origin', '');
      handleOf(p.key)?.setAttribute('aria-pressed', 'true');
      document.documentElement.dataset.tripDragging = '';
      if (p.touch) navigator.vibrate?.(12);
      const L: Live = { via: 'pointer', key: p.key, origin, hit: { kind: 'slot', t: origin }, touch: p.touch, px: p.x0, py: p.y0, x: p.x, y: p.y, ghost, raf: 0, railTimer: 0, railDay: null, choices: new Map(), moved: true };
      live = L;
      L.raf = w.requestAnimationFrame(tick);
      fetchChoices(L, e);
    };

    const clearPending = () => {
      if (pending) w.clearTimeout(pending.timer);
      pending = null;
    };
    function onMove(ev: PointerEvent) {
      if (live?.via === 'pointer') {
        live.x = ev.clientX;
        live.y = ev.clientY;
        live.moved = true;
        return;
      }
      if (!pending) return;
      pending.x = ev.clientX;
      pending.y = ev.clientY;
      const d = Math.hypot(pending.x - pending.x0, pending.y - pending.y0);
      if (pending.touch) {
        // a finger that moves before the long-press fires is scrolling, not lifting
        if (d > U.longPressSlopPx) {
          clearPending();
          w.removeEventListener('pointermove', onMove);
          w.removeEventListener('pointerup', onUp);
          w.removeEventListener('pointercancel', onCancel);
        }
        return;
      }
      if (d >= (pending.handle ? U.dragHandlePx : U.dragRowPx)) {
        const p = pending;
        clearPending();
        beginPointer(p);
      }
    }
    function onUp() {
      if (live?.via === 'pointer') finish(true);
      clearPending();
      w.removeEventListener('pointermove', onMove);
      w.removeEventListener('pointerup', onUp);
      w.removeEventListener('pointercancel', onCancel);
    }
    function onCancel() {
      if (live?.via === 'pointer') finish(false);
      clearPending();
      w.removeEventListener('pointermove', onMove);
      w.removeEventListener('pointerup', onUp);
      w.removeEventListener('pointercancel', onCancel);
    }

    const onDown = (ev: PointerEvent) => {
      if (live) return;
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      const t = ev.target;
      if (!(t instanceof Element)) return;
      const row = t.closest<HTMLElement>('li.tl-entry[data-edit]');
      const key = row?.dataset.entry;
      if (!row || !key) return;
      const handle = !!t.closest('.drag-handle');
      const touch = ev.pointerType === 'touch';
      if (touch && !handle) return;
      if (!handle && t.closest('a,button,input,textarea,select,summary,label,[role="menuitem"],.tl-edit-trail')) return;
      clearPending();
      pending = { key, touch, handle, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, timer: 0 };
      if (touch) {
        pending.timer = w.setTimeout(() => {
          const p = pending;
          pending = null;
          if (p) beginPointer(p);
        }, U.longPressMs);
      }
      w.addEventListener('pointermove', onMove);
      w.addEventListener('pointerup', onUp);
      w.addEventListener('pointercancel', onCancel);
    };

    // ---- the keyboard ----
    const beginKey = (handle: HTMLElement) => {
      const key = handle.dataset.dragHandle ?? '';
      const origin = originOf(key);
      const e = entryFor(key);
      if (!origin || !e) return;
      rowOf(key)?.setAttribute('data-drag-origin', '');
      handle.setAttribute('aria-pressed', 'true');
      const L: Live = { via: 'key', key, origin, hit: { kind: 'slot', t: origin }, touch: false, px: 0, py: 0, x: 0, y: 0, ghost: null, raf: 0, railTimer: 0, railDay: null, choices: new Map(), moved: false };
      live = L;
      show(L, L.hit);
      say(lifted(e, origin, otherCounts(key).get(origin.day) ?? 0));
      fetchChoices(L, e);
    };
    const moveKey = (L: Live, k: string) => {
      const cur = L.hit?.kind === 'slot' ? L.hit.t : L.origin;
      const next = keyTarget(cur, MOVE_KEYS[k]!, otherCounts(L.key), dayNumbers());
      const e = entryFor(L.key);
      if (!e) return;
      const same = next.day === cur.day && next.index === cur.index;
      show(L, { kind: 'slot', t: next });
      const g = lineFor(next, L.key);
      if (g && (g.top < 150 || g.top > w.innerHeight - 60)) w.scrollBy({ top: g.top - w.innerHeight / 2, behavior: reduced() ? 'auto' : 'smooth' });
      const n = otherCounts(L.key).get(next.day) ?? 0;
      say(same ? `${stepWords(e, next, n)}, ${MOVE_KEYS[k] === 'up' || MOVE_KEYS[k] === 'home' ? 'top' : 'end'} of the day` : stepWords(e, next, n));
    };
    const focusBack = (key: string, intended?: number) => {
      w.setTimeout(() => {
        const row = rowOf(key);
        // the scheduler has the last word on the order: say where the stop really is when that differs from the step taken
        const e = entryFor(key);
        if (row && e && intended !== undefined) {
          const rows = stopRows(e.day);
          const at = rows.indexOf(row);
          if (at >= 0 && at !== intended) say(stepWords(e, { day: e.day, index: at }, rows.length - 1));
        }
        if (row && !row.contains(document.activeElement)) handleOf(key)?.focus({ preventScroll: true });
        row?.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
      }, 80);
    };
    const nudge = (key: string, dir: -1 | 1) => {
      const e = entryFor(key);
      if (!e) return;
      const stops = stopEntries(e.day);
      const i = stops.findIndex((s) => s.id === e.id);
      const ops = nudgeOps(P.current.doc, e, stops, dir);
      if (!ops) return say(`${e.title} is already ${dir < 0 ? 'first' : 'last'} on Day ${e.day}`);
      if (P.current.commit(ops, nudgedWords(e, dir))) {
        say(`${e.title}, Day ${e.day}, position ${i + dir + 1} of ${stops.length}`);
        focusBack(key, i + dir);
      }
    };
    const openMenuItem = (row: HTMLElement, name: RegExp) => {
      row.querySelector<HTMLElement>('.tl-edit-trail button')?.click();
      let tries = 0;
      const find = () => {
        const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((n) => name.test(n.textContent?.trim() ?? ''));
        if (item) item.click();
        else if (++tries < 30) w.requestAnimationFrame(find);
      };
      w.requestAnimationFrame(find);
    };

    const onKey = (ev: KeyboardEvent) => {
      const L = live;
      if (L) {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          return finish(false);
        }
        if (L.via !== 'key') return;
        if (ev.key === ' ' || ev.key === 'Enter') {
          ev.preventDefault();
          return finish(true);
        }
        if (ev.key in MOVE_KEYS) {
          ev.preventDefault();
          return moveKey(L, ev.key);
        }
        if (ev.key === 'Tab') finish(false);
        return;
      }
      const t = ev.target;
      if (!(t instanceof Element) || typing(t) || insideOverlay(t)) return;
      const bare = !ev.ctrlKey && !ev.metaKey && !ev.altKey;
      const handle = t.closest<HTMLElement>('.drag-handle');
      if (handle && bare && !ev.shiftKey && (ev.key === ' ' || ev.key === 'Enter')) {
        ev.preventDefault();
        return beginKey(handle);
      }
      const row = t.closest<HTMLElement>('li.tl-entry[data-edit]');
      const key = row?.dataset.entry;
      if (row && key && ev.altKey && !ev.ctrlKey && !ev.metaKey && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown')) {
        ev.preventDefault();
        return nudge(key, ev.key === 'ArrowUp' ? -1 : 1);
      }
      if (!bare || !singleRef.current) {
        if (ev.key === '?' && !ev.ctrlKey && !ev.metaKey && !ev.altKey) setHelpOpen(true);
        return;
      }
      const onPage = t === document.body || !!t.closest('main');
      if (!onPage) return;
      if (ev.key === '?') return setHelpOpen(true);
      if (ev.shiftKey) return;
      const k = ev.key.toLowerCase();
      if (k === 'e') {
        ev.preventDefault();
        return P.current.onDone();
      }
      if (k === 'a') {
        const day = t.closest<HTMLElement>('li.tl-day');
        const open = day?.querySelector<HTMLElement>('.tl-add-open');
        if (open) {
          ev.preventDefault();
          open.click();
        }
        return;
      }
      if (!row || !key) return;
      if (k === 'm') {
        ev.preventDefault();
        return openMenuItem(row, /^Move to day/);
      }
      if (k === 's') {
        ev.preventDefault();
        return openMenuItem(row, /^Swap with/);
      }
      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        const e = entryFor(key);
        if (!e) return;
        ev.preventDefault();
        P.current.remove(e, stopEntries(e.day));
      }
    };
    // a lifted stop whose handle loses focus goes back where it was
    const onFocusOut = (ev: FocusEvent) => {
      if (live?.via === 'key' && ev.target instanceof Element && ev.target.closest('.drag-handle') && !(ev.relatedTarget instanceof Element && ev.relatedTarget.closest('.drag-handle'))) finish(false);
    };
    const stop = (ev: Event) => {
      if (live || pending) ev.preventDefault();
    };
    const noClick = (ev: MouseEvent) => {
      if (swallowClick) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    };

    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('dragstart', stop);
    document.addEventListener('contextmenu', stop);
    document.addEventListener('selectstart', stop);
    document.addEventListener('click', noClick, true);
    return () => {
      if (live) {
        const L = live;
        live = null;
        release(L);
      }
      clearPending();
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('dragstart', stop);
      document.removeEventListener('contextmenu', stop);
      document.removeEventListener('selectstart', stop);
      document.removeEventListener('click', noClick, true);
      w.removeEventListener('pointermove', onMove);
      w.removeEventListener('pointerup', onUp);
      w.removeEventListener('pointercancel', onCancel);
    };
  }, []);

  return (
    <>
      <p id={DRAG_HELP_ID} className="sr-only">Space or Enter lifts this stop. Arrow keys move it, Page Up and Page Down change the day, Space drops it, Escape puts it back. Alt with the arrow keys moves it without lifting. Press question mark for every key.</p>
      {view.line ? <div className="drag-line" aria-hidden="true" style={{ left: view.line.left, top: view.line.top, width: view.line.width }} /> : null}
      {view.pill ? (
        <div className="drag-pill" data-below={view.pill.below || undefined} aria-hidden="true" style={{ left: view.pill.left, top: view.pill.top, maxWidth: `calc(100vw - ${view.pill.left}px - var(--s-3))` }}>
          {view.pill.text}
        </div>
      ) : null}
      <KeysHelp open={helpOpen} onClose={() => setHelpOpen(false)} single={single} onSingle={setSingle} />
    </>
  );
}
