import { CHANGED_EVENT, FAV_KEY } from '@/lib/mine/keys';
import { readLocal } from '@/lib/storage/safe';

/**
 * The cheap half of the favourites store (FAV-1): which pages are hearted, read as plain JSON with no Zod, so the heart and the card
 * badges can paint their state without loading the core readers. The writers (`store.ts`) load on the first tap. A damaged or newer
 * envelope reads as "no hearts here" and is left as it is; Mine is where it is reported.
 */

/** Handles (`place:<slug>`, `trip:<slug>`) hearted while the browser keeps nothing: this page's session list (spec 4.3). */
const session = new Set<string>();

/** `store.ts` mirrors its per-tab memory list here after every change, so a blocked browser still shows its hearts as pressed. */
export function setSession(handles: Iterable<string>): void {
  session.clear();
  for (const h of handles) session.add(h);
}

export const sessionHandles = (): ReadonlySet<string> => session;

/** Every handle on this device (the stored list and the session list). */
export function heartedHandles(): Set<string> {
  const out = new Set<string>(session);
  const raw = readLocal(FAV_KEY);
  if (!raw) return out;
  try {
    const items = (JSON.parse(raw) as { items?: unknown } | null)?.items;
    if (Array.isArray(items)) {
      for (const i of items as { space?: unknown; slug?: unknown }[]) {
        if ((i?.space === 'place' || i?.space === 'trip') && typeof i.slug === 'string') out.add(`${i.space}:${i.slug}`);
      }
    }
  } catch {
    /* a damaged list shows no hearts; Mine reports it */
  }
  return out;
}

export const isHearted = (space: 'place' | 'trip', slug: string): boolean => heartedHandles().has(`${space}:${slug}`);

/** Calls `on` after a change in this tab (`notifyMineChanged`) or another one (`storage`). Returns the unsubscribe. */
export function watchHearts(on: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === FAV_KEY) on();
  };
  window.addEventListener(CHANGED_EVENT, on);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGED_EVENT, on);
    window.removeEventListener('storage', onStorage);
  };
}
