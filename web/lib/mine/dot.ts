import { readLocal, writeLocal } from '@/lib/storage/safe';
import { PLANS_KEY } from '@/lib/plan/keys';
import { CHANGED_EVENT, COPIES_KEY, FAV_KEY, SEEN_KEY } from './keys';

/**
 * The Mine dot (mine-and-bar-spec 3.2). It needs only timestamps, so it reads the two envelopes as plain JSON and takes the newest
 * `copiedAt`, `favouredAt` or (unbuilt drafts) `createdAt`: running them through `readCopies` would put Zod in a chunk every visitor with a copy loads. A damaged
 * envelope gives 0 (no dot); the Mine page is where it is reported. Loaded on demand by the bar, only when a list exists.
 */
function newest(raw: string | null, field: string, keep: (item: Record<string, unknown>) => boolean = () => true): number {
  if (!raw) return 0;
  try {
    const items = (JSON.parse(raw) as { items?: unknown } | null)?.items;
    if (!Array.isArray(items)) return 0;
    let at = 0;
    for (const i of items) {
      if (!i || typeof i !== 'object' || !keep(i as Record<string, unknown>)) continue;
      const t = Date.parse((i as Record<string, string> | null)?.[field] ?? '');
      if (t > at) at = t;
    }
    return at;
  } catch {
    return 0;
  }
}

/**
 * A builder draft that has no build (and is not a copy's template): Mine lists it as "Draft · ready to build" (`lib/mine/deviceList.ts`).
 * Built drafts are not new items. `createdAt`, not `updatedAt`, so editing a draft does not bring the dot back.
 */
const unbuilt = (d: Record<string, unknown>): boolean => (d.lastBuild ?? null) === null && d.template === undefined;

/** True when a copy, a favourite or an unbuilt draft was added after the visitor last opened Mine. */
export function hasNewItems(): boolean {
  const seen = Date.parse(readLocal(SEEN_KEY) ?? '') || 0;
  const at = Math.max(newest(readLocal(COPIES_KEY), 'copiedAt'), newest(readLocal(FAV_KEY), 'favouredAt'), newest(readLocal(PLANS_KEY), 'createdAt', unbuilt));
  return at > seen;
}

/** Called when `/mine/` renders: everything now on the device counts as seen. */
export function markSeen(now: Date = new Date()): void {
  writeLocal(SEEN_KEY, now.toISOString()); // blocked: the dot stays as it is
  notifyMineChanged();
}

/** Tell the shell a list changed in this tab (the copy sheet and the heart call this after a write). */
export function notifyMineChanged(): void {
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

/** Calls `set` now and whenever the dot may change: a change in this tab, or a write by another tab. Returns the unsubscribe. */
export function watchDot(set: (on: boolean) => void): () => void {
  const update = () => set(hasNewItems());
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === COPIES_KEY || e.key === FAV_KEY || e.key === PLANS_KEY || e.key === SEEN_KEY) update();
  };
  window.addEventListener(CHANGED_EVENT, update);
  window.addEventListener('storage', onStorage);
  update();
  return () => {
    window.removeEventListener(CHANGED_EVENT, update);
    window.removeEventListener('storage', onStorage);
  };
}
