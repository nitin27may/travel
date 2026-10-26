import { CHANGED_EVENT, COPIES_KEY, FAV_KEY, SEEN_KEY } from './keys';

/**
 * The Mine dot (mine-and-bar-spec 3.2). It needs only timestamps, so it reads the two envelopes as plain JSON and takes the newest
 * `copiedAt` or `favouredAt`: running them through `readCopies` would put Zod in a chunk every visitor with a copy loads. A damaged
 * envelope gives 0 (no dot); the Mine page is where it is reported. Loaded on demand by the bar, only when a list exists.
 */
function newest(raw: string | null, field: string): number {
  if (!raw) return 0;
  try {
    const items = (JSON.parse(raw) as { items?: unknown } | null)?.items;
    if (!Array.isArray(items)) return 0;
    let at = 0;
    for (const i of items) {
      const t = Date.parse((i as Record<string, string> | null)?.[field] ?? '');
      if (t > at) at = t;
    }
    return at;
  } catch {
    return 0;
  }
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** True when a copy or favourite was added after the visitor last opened Mine. */
export function hasNewItems(): boolean {
  const seen = Date.parse(read(SEEN_KEY) ?? '') || 0;
  return Math.max(newest(read(COPIES_KEY), 'copiedAt'), newest(read(FAV_KEY), 'favouredAt')) > seen;
}

/** Called when `/mine/` renders: everything now on the device counts as seen. */
export function markSeen(now: Date = new Date()): void {
  try {
    window.localStorage.setItem(SEEN_KEY, now.toISOString());
  } catch {
    /* blocked: the dot stays as it is */
  }
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
    if (e.key === null || e.key === COPIES_KEY || e.key === FAV_KEY || e.key === SEEN_KEY) update();
  };
  window.addEventListener(CHANGED_EVENT, update);
  window.addEventListener('storage', onStorage);
  update();
  return () => {
    window.removeEventListener(CHANGED_EVENT, update);
    window.removeEventListener('storage', onStorage);
  };
}
