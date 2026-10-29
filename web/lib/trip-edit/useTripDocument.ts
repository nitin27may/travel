'use client';

// The trip document on a page (STEP2-T1): loads `travel.copies.local` and, signed in with `accountTrips` on, the account's engine; says
// when the answer is final ("not found" only once the account list has answered), and hands back one `save(ops)`. The engine and its
// plan code load lazily, only for a signed-in person, so a signed-out visitor pays nothing for them (P1).
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { PlanOp } from '@travel/core/plan/ops.ts';
import type { PlanTripFacts } from '@travel/core/plan/doc.ts';
import type { CopyItem } from '@travel/core/schema/copies.ts';
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { ACCOUNT_TRIPS_ON } from '@/lib/mine/flag';
import { CHANGED_EVENT } from '@/lib/mine/keys';
import { mineStorage } from '@/lib/mine/storage';
import { useAccountTrips } from '@/lib/mine/useSync';
import { DOC_CHANGED_EVENT } from './keys';
import { openTrip, saveOps, syncWord, type SaveResult, type SyncWord, type Where } from './open';

export type DocumentState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'newer' }
  | { status: 'ok'; doc: PlanDraft; where: Where; copy: CopyItem | null; word: SyncWord; retry: (() => void) | null };

export interface TripDocument {
  state: DocumentState;
  /** Applies operations and saves them (device at once; the account's outbox when signed in). */
  save: (ops: readonly PlanOp[]) => SaveResult;
}

const noSubscribe = () => () => {};
/** False on the server and on the hydrating render, true after: the one safe way to read browser-only state without a hydration mismatch. */
const useHydrated = () => useSyncExternalStore(noSubscribe, () => true, () => false);

export function useTripDocument(id: string, signIn: boolean, facts?: (slug: string) => PlanTripFacts | null): TripDocument {
  // who is signed in: asked once, lazily; the account engine starts only for a person
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionKnown, setSessionKnown] = useState(!signIn || !ACCOUNT_TRIPS_ON);
  useEffect(() => {
    if (!signIn || !ACCOUNT_TRIPS_ON) return;
    let live = true;
    void import('@/lib/auth/client')
      .then(({ getAuthClient }) => getAuthClient().getSession())
      .then((r) => {
        const u = (r as { data?: { user?: { id?: string } } } | null)?.data?.user;
        if (live && u?.id) setUserId(u.id);
      })
      .catch(() => {})
      .finally(() => live && setSessionKnown(true));
    return () => {
      live = false;
    };
  }, [signIn]);
  const acct = useAccountTrips(userId, ACCOUNT_TRIPS_ON && signIn);
  const engine = acct.engine;
  const snap = acct.snap;

  // a write in this tab or another re-reads the device list; the engine's snapshot re-renders on its own
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const again = () => setRev((n) => n + 1);
    for (const e of [DOC_CHANGED_EVENT, CHANGED_EVENT, 'storage']) addEventListener(e, again);
    return () => {
      for (const e of [DOC_CHANGED_EVENT, CHANGED_EVENT, 'storage']) removeEventListener(e, again);
    };
  }, []);

  // The page is rendered on the server with no storage. The first client render must match it ('loading'), or React discards the server
  // HTML and re-renders the whole document, which rebuilds <html> from the layout's props and resets the stored dark theme to light.
  const hydrated = useHydrated();
  const state = useMemo<DocumentState>(() => {
    void rev;
    if (!hydrated || typeof window === 'undefined') return { status: 'loading' };
    const r = openTrip(id, { storage: mineStorage().storage, account: engine, facts });
    if (r.kind === 'ok') {
      const row = snap?.rows[id];
      const word = syncWord(r.where, row?.state ?? 'quiet');
      return { status: 'ok', doc: r.doc, where: r.where, copy: r.copy, word, retry: engine && row?.state === 'retry' ? () => void engine.retry(id) : null };
    }
    if (r.kind === 'newer') return { status: 'newer' };
    // signed in: the trip may be in the account but not fetched yet; wait for the list's first answer
    if (!sessionKnown) return { status: 'loading' };
    if (userId && (!engine || !snap?.ready || snap.reachable === null)) return { status: 'loading' };
    return { status: 'missing' };
  }, [id, engine, snap, facts, sessionKnown, userId, rev, hydrated]);

  const save = useCallback(
    (ops: readonly PlanOp[]): SaveResult => {
      const r = saveOps(id, ops, { storage: mineStorage().storage, account: engine, facts });
      // the listener above re-reads; Mine's list and the phone bar's dot hear the same event
      if (r.ok) {
        window.dispatchEvent(new Event(DOC_CHANGED_EVENT));
        window.dispatchEvent(new Event(CHANGED_EVENT));
      }
      return r;
    },
    [id, engine, facts],
  );
  return { state, save };
}
