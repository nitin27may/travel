// A `mine=<id>` link on `/trips/<slug>/` (a bookmark, edit-mode-spec 2.6) goes to the copy's own page when the id is on this device or in
// this account's cache. Loaded by a dynamic import from useTripUrl, only when the address carries such a link and `tripEdit` is on.
import { ACCT_KEY_PREFIX } from '@/lib/mine/keys';
import { mineStorage } from '@/lib/mine/storage';
import { TRIP_EDIT_ON } from './flag';
import { findCopy } from './open';
import { isTripId, MINE_KEY, tripHref } from './keys';

const inAccountCache = (id: string): boolean => {
  try {
    const ls = mineStorage().storage as Storage;
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (!k?.startsWith(ACCT_KEY_PREFIX)) continue;
      const file = JSON.parse(ls.getItem(k) ?? 'null') as { rows?: { id?: string }[] } | null;
      if (file?.rows?.some((r) => r.id === id)) return true;
    }
  } catch {
    /* blocked or unreadable: not found */
  }
  return false;
};

/** Replaces the address with `/t/<id>/` (keeping `view`) when the copy is here; leaves the public page as it is otherwise. */
export function followMineLink(search: string = window.location.search): boolean {
  if (!TRIP_EDIT_ON) return false;
  const q = new URLSearchParams(search);
  const id = q.get(MINE_KEY);
  if (!isTripId(id)) return false;
  if (findCopy(mineStorage().storage, id).kind !== 'ok' && !inAccountCache(id)) return false;
  const view = q.get('view');
  window.location.replace(tripHref(id, view ? `view=${encodeURIComponent(view)}` : ''));
  return true;
}
