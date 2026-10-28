// What each day header last reported, so the sticky row and the Summary can count the trip's warnings (STEP2-E5). A day reports from its
// own render, so the count follows every edit (a removal, an add, a drag, a day change) with no second computation. Module state, one trip
// at a time; the edit layer clears it when edit mode ends.
import { useSyncExternalStore } from 'react';
import { countOf, NO_COUNTS, type Counts, type Warn } from '@/lib/trip-edit/warnings';

const byDay = new Map<number, Warn[]>();
let snap: Counts = NO_COUNTS;
const subs = new Set<() => void>();

function publish(): void {
  const all = [...byDay.entries()].sort((a, b) => a[0] - b[0]).flatMap(([, w]) => w);
  const next = countOf(all);
  if (next.fix === snap.fix && next.check === snap.check && next.firstFixDay === snap.firstFixDay) return;
  snap = next;
  subs.forEach((f) => f());
}

export function report(day: number, ws: readonly Warn[]): void {
  if (ws.length) byDay.set(day, [...ws]);
  else byDay.delete(day);
  publish();
}
export function clearDay(day: number): void {
  if (byDay.delete(day)) publish();
}
export function clearAll(): void {
  byDay.clear();
  publish();
}

const subscribe = (f: () => void): (() => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
export const useWarnCounts = (): Counts => useSyncExternalStore(subscribe, () => snap, () => NO_COUNTS);

/** Scroll to the first Fix warning and put focus on its fix button (or its line): "n to fix" is a button, not a label (review M5). */
export function jumpToFirstFix(): void {
  const row = document.querySelector<HTMLElement>('.wn[data-level="fix"]');
  if (!row) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  row.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  const target = row.querySelector<HTMLElement>('button') ?? row;
  if (!target.matches('button')) target.tabIndex = -1;
  target.focus({ preventScroll: true });
}
