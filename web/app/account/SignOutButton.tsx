'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { getAuthClient } from '@/lib/auth/client';
import { clearAccountParty } from '@/lib/account/seed-party';
import { leaveSession } from '@/lib/auth/session-lost';
import { ACCOUNT_TRIPS_ON } from '@/lib/mine/flag';
import type { UnsentSummary } from '@/lib/mine/signout';

// the question and the sync module load only when the `accountTrips` flag is on and there is something to ask
const SignOutConfirm = dynamic(() => import('@/components/mine/SignOutConfirm').then((m) => m.SignOutConfirm), { ssr: false });
const signout = () => import('@/lib/mine/signout');

/**
 * Sign out, then unload all prior-user client state with a full page change (review C2). A plain
 * secondary button, not danger. `leaveSession()` reloads to `/`, which drops the Realtime client and
 * the previous user's rows and re-reads the session.
 *
 * With the `accountTrips` flag on (edit-my-trip 4.6): changes that never reached the account are named first, with Try again, Sign out
 * and discard, or Cancel; once signed out, the account's cache and outbox are deleted from this device. Flag off: exactly as before.
 */
export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [ask, setAsk] = useState<{ unsent: UnsentSummary; offline: boolean; busy: boolean; stillWaiting: boolean } | null>(null);

  const leave = async () => {
    setPending(true);
    setAsk(null);
    if (ACCOUNT_TRIPS_ON) {
      // nothing of the account stays on the device (4.6); copies made while signed out are not account data and stay
      try {
        const m = await signout();
        m.clearAccountData(m.mineStorage().storage);
      } catch {
        /* the storage is unavailable: nothing to clear */
      }
    }
    try {
      await getAuthClient().signOut();
    } catch {
      /* leave anyway: the session change must unload client state regardless */
    }
    // a shared computer shows nothing of the previous person: a party the account put here goes, the browser's own stays (spec 5.4)
    clearAccountParty();
    leaveSession();
  };

  const press = async () => {
    if (!ACCOUNT_TRIPS_ON) return leave();
    setPending(true);
    try {
      const m = await signout();
      const unsent = m.unsentSummary(m.mineStorage().storage);
      if (unsent.count > 0) {
        setPending(false);
        setAsk({ unsent, offline: !navigator.onLine, busy: false, stillWaiting: false });
        return;
      }
    } catch {
      /* the question could not be asked: sign out as before */
    }
    return leave();
  };

  const tryAgain = async () => {
    setAsk((a) => (a ? { ...a, busy: true } : a));
    let left: UnsentSummary | null = null;
    try {
      const m = await signout();
      const session = (await getAuthClient().getSession()) as { data?: { user?: { id?: string } } } | null;
      const id = session?.data?.user?.id;
      left = id ? await m.sendWaiting(m.mineStorage().storage, await m.hashOf(id)) : m.unsentSummary(m.mineStorage().storage);
    } catch {
      /* the question stays open */
    }
    if (left && left.count === 0) return leave();
    setAsk((a) => (a ? { unsent: left && left.count > 0 ? left : a.unsent, offline: !navigator.onLine, busy: false, stillWaiting: true } : a));
  };

  return (
    <>
      <Button variant="secondary" loading={pending} onClick={press}>
        Sign out
      </Button>
      {ask ? (
        <SignOutConfirm {...ask} onTryAgain={tryAgain} onDiscard={leave} onCancel={() => setAsk(null)} />
      ) : null}
    </>
  );
}
