import { COPIES_KEY, readCopies } from '@travel/core/schema/copies.ts';
import type { CopyItem, StorageLike } from '@travel/core/schema/copies.ts';
import { FAV_LOCAL_KEY, SNOOZE_MORE } from '@travel/core/schema/favourites.ts';
import type { FavItem } from '@travel/core/schema/favourites.ts';
import { readFavourites, snoozeNotice, updateFavourites } from '@travel/core/favourites/envelope.ts';
import { updateCopies } from '@travel/core/schema/copies.ts';

/** What one list holds, or why it could not be read. A failed read never writes (the envelope stays as it is). */
export type ListState<T> = { ok: true; items: readonly T[]; newest: number; snoozedUntil: string | null; snoozedAtCount: number | null } | { ok: false; reason: 'corrupt' | 'newer' | 'invalid' };

export interface Overview {
  copies: ListState<CopyItem>;
  favourites: ListState<FavItem>;
}

const at = (iso: string): number => Date.parse(iso) || 0;

function get(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** Reads both lists through the core readers (never a bare parse). */
export function readOverview(storage: StorageLike): Overview {
  const c = readCopies(get(storage, COPIES_KEY));
  const f = readFavourites(get(storage, FAV_LOCAL_KEY));
  return {
    copies: c.ok
      ? { ok: true, items: c.envelope.items, newest: Math.max(0, ...c.envelope.items.map((i) => at(i.copiedAt))), snoozedUntil: c.envelope.snoozedUntil, snoozedAtCount: null }
      : { ok: false, reason: c.reason },
    favourites: f.ok
      ? { ok: true, items: f.envelope.items, newest: Math.max(0, ...f.envelope.items.map((i) => at(i.favouredAt))), snoozedUntil: f.envelope.snoozedUntil, snoozedAtCount: f.envelope.snoozedAtCount }
      : { ok: false, reason: f.reason },
  };
}

export type MineTab = 'trips' | 'favourites';

export const parseShow = (v: string | null): MineTab | null => (v === 'trips' || v === 'favourites' ? v : null);

/** The tab opened with no `?show=`: the one with the newest item; My trips when both lists are empty or tied (spec 5.1). */
export function defaultTab(o: Overview): MineTab {
  const c = o.copies.ok ? o.copies.newest : 0;
  const f = o.favourites.ok ? o.favourites.newest : 0;
  return f > c ? 'favourites' : 'trips';
}

const size = (l: ListState<unknown>): number => (l.ok ? l.items.length : 0);

/**
 * The signed-out device notice (spec 7): shown while something is kept and it is not snoozed. "Got it" snoozes 30 days on both lists;
 * it comes back after the 30 days or when the favourites grew by SNOOZE_MORE. The copies envelope has no count field, so copies alone do
 * not bring it back early (a contract limit, noted in UI-NOTES).
 */
export function noticeDue(o: Overview, now: Date): boolean {
  if (size(o.copies) + size(o.favourites) === 0) return false;
  const untils = [o.copies, o.favourites].flatMap((l) => (l.ok && l.snoozedUntil ? [at(l.snoozedUntil)] : []));
  if (untils.length === 0) return true;
  if (now.getTime() >= Math.max(...untils)) return true;
  const f = o.favourites;
  return f.ok && f.snoozedAtCount !== null && f.items.length >= f.snoozedAtCount + SNOOZE_MORE;
}

/** "Got it": snooze each list that holds something for 30 days (an empty list is not written). Returns whether anything was written. */
export function snoozeNoticeNow(storage: StorageLike, o: Overview, now: Date): boolean {
  const until = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  let wrote = false;
  if (size(o.copies) > 0) wrote = updateCopies(storage, (env) => ({ envelope: { ...env, snoozedUntil: until }, value: null })).ok || wrote;
  if (size(o.favourites) > 0) wrote = updateFavourites(storage, FAV_LOCAL_KEY, (env) => ({ envelope: snoozeNotice(env, now), value: null })).ok || wrote;
  return wrote;
}
