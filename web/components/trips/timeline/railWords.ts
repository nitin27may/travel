// The sticky day rail says the party the bar says ("2 adults · 1 child (10) · Standard · Edit", spec 5.2). ProfileBar (the start chunk) writes
// the party and pace here as data; PlanBar (its own lazy chunk, which owns the party words) reads them. A tiny store, because the two
// are not parent and child, and no words are built here so the start chunk carries none of core `party.ts`.
import { useSyncExternalStore } from 'react';
import type { Pace } from '@travel/core/schedule/types.ts';

export interface RailParty {
  adults: number;
  children: (number | null)[];
  pace: Pace;
  /** The plan is a shared link's: the rail says so instead of a party (review UXB-2 S3). */
  shared?: boolean;
  /** The shared plan is the owner's own copy, opened from Mine (EM-B). */
  own?: boolean;
}

/** Set by the rail's Edit just before it opens the editor, so the close returns focus there (review S5). */
export const railOpen = { from: false };

let current: RailParty | null = null;
let key = '';
const listeners = new Set<() => void>();

export function setRailParty(next: RailParty | null): void {
  const k = JSON.stringify(next);
  if (k === key) return;
  key = k;
  current = next;
  listeners.forEach((l) => l());
}

export function useRailParty(): RailParty | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}
