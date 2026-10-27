'use client';

import { useEffect, useState } from 'react';
import { PLAN_SYNC } from '@travel/core/config/plans.ts';
import { ACCT_KEY_PREFIX, OUTBOX_KEY_PREFIX } from './keys';
import type { AccountSync, SyncSnapshot } from './sync';

/**
 * Drives the account sync while Mine is open (edit-my-trip 4.4 step 5, EM7: no Realtime): a pass now, on focus, when the tab becomes
 * visible, when the network returns, and every PLAN_SYNC.refetchSeconds while the tab is visible. The engine (and the plan document it
 * imports) loads here, lazily, and only when `enabled`: the flag is on and a person is signed in. Another tab's write to the cache or the
 * outbox is read again.
 */
export function useAccountTrips(userId: string | null, enabled: boolean): { engine: AccountSync | null; snap: SyncSnapshot | null } {
  const [state, setState] = useState<{ engine: AccountSync; snap: SyncSnapshot } | null>(null);

  useEffect(() => {
    if (!enabled || !userId) return;
    let live = true;
    let engine: AccountSync | null = null;
    let tick: ReturnType<typeof setInterval> | undefined;
    const cleanups: (() => void)[] = [];
    void Promise.all([import('./sync'), import('./storage')]).then(async ([sync, store]) => {
      const hash = await sync.hashOf(userId);
      if (!live) return;
      const e = new sync.AccountSync({ storage: store.mineStorage().storage, hash }).init();
      engine = e;
      const show = () => live && setState({ engine: e, snap: e.snapshot() });
      cleanups.push(e.subscribe(show));
      show();
      const pass = () => void e.sync();
      const onVisible = () => document.visibilityState === 'visible' && pass();
      const onStorage = (ev: StorageEvent) => {
        if (ev.key === null || ev.key.startsWith(ACCT_KEY_PREFIX) || ev.key.startsWith(OUTBOX_KEY_PREFIX)) e.reload();
      };
      addEventListener('focus', pass);
      addEventListener('online', pass);
      addEventListener('storage', onStorage);
      document.addEventListener('visibilitychange', onVisible);
      tick = setInterval(() => document.visibilityState === 'visible' && pass(), PLAN_SYNC.refetchSeconds * 1000);
      cleanups.push(() => {
        removeEventListener('focus', pass);
        removeEventListener('online', pass);
        removeEventListener('storage', onStorage);
        document.removeEventListener('visibilitychange', onVisible);
      });
      pass();
    });
    return () => {
      live = false;
      clearInterval(tick);
      for (const c of cleanups) c();
      engine?.dispose();
    };
  }, [enabled, userId]);

  return enabled && userId && state ? state : { engine: null, snap: null };
}
