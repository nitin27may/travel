'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo } from 'react';
import { Banner } from '@/components/ui/Banner';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton } from '@/components/ui/Skeleton';
import { ACCOUNT_TRIPS_ON } from '@/lib/mine/flag';
import { useAccountTrips } from '@/lib/mine/useSync';
import type { SyncSnapshot } from '@/lib/mine/sync';
import { leaveSession } from '@/lib/auth/session-lost';
import { ACCOUNT_PAGE } from '@travel/core/config/account.ts';
import { AccountSection } from './AccountSections';
import { MINE_TRIPS } from './account-links';

// Mine's rows (and the copy readers and Zod behind them) load only when there are rows to draw, as on Mine itself
const AccountTripRows = dynamic(() => import('./AccountTripRows').then((m) => m.AccountTripRows), { ssr: false });

/** The rows this page shows: the account's live trips, newest change first, at most `shown` (pure, for the tests). */
export function newestTrips(snap: Pick<SyncSnapshot, 'items' | 'rows'>, shown: number = ACCOUNT_PAGE.tripsShown): SyncSnapshot['items'] {
  const at = (id: string) => snap.rows[id]?.changedAt ?? '';
  return [...snap.items].sort((a, b) => at(b.id).localeCompare(at(a.id)) || a.id.localeCompare(b.id)).slice(0, shown);
}

/**
 * My trips on the Account page (review ACCT-PR MF1; spec 2.1 row 5, AP-30). The same live account rows as Mine's My trips, read through
 * the same hook and engine (`useAccountTrips`: tombstones and title-only rows never reach `items`), drawn with Mine's row (one row
 * component), newest change first, five, then "See all in Mine". Each row opens the trip as Mine does; there is no menu here: renaming,
 * changing dates and removing stay in Mine, one set of actions (P3, P4). With the `accountTrips` flag off nothing is kept in the
 * account yet, and the empty state says where the copies are.
 */
export function AccountTrips({ userId }: { userId: string }) {
  const acct = useAccountTrips(userId, ACCOUNT_TRIPS_ON);
  const snap = acct.snap;

  // a 401 on the list: the session ended (as a 401 on any account write)
  const expired = !!snap?.expired;
  useEffect(() => {
    if (expired) leaveSession();
  }, [expired]);

  const rows = useMemo(() => (snap ? newestTrips(snap) : []), [snap]);
  const count = snap ? snap.items.length : undefined;

  if (!ACCOUNT_TRIPS_ON) {
    return (
      <AccountSection id="my-trips" title="My trips">
        <EmptyState
          glyph="layers"
          as="h3"
          title="No trips in your account yet."
          why="Trips you copy stay on this device for now. See them in Mine."
          action={<ButtonLink href={MINE_TRIPS}>Open Mine</ButtonLink>}
        />
      </AccountSection>
    );
  }

  // the engine has not read its cache or the account yet
  const loading = !snap || (snap.items.length === 0 && snap.reachable === null);
  return (
    <AccountSection id="my-trips" title="My trips" count={loading ? undefined : count} className="acct-trips">
      {loading ? (
        <ul className="account-list" aria-label="Loading your trips">
          <RowSkeleton />
        </ul>
      ) : rows.length === 0 ? (
        snap.reachable === false ? (
          <Banner kind="notice">We can&apos;t reach your account right now. Your trips show here when we can.</Banner>
        ) : (
          <EmptyState
            glyph="layers"
            as="h3"
            title="No trips in your account yet."
            why="Copy a trip while signed in and it is kept here and in Mine."
            action={<ButtonLink href="/trips/">Browse trips</ButtonLink>}
          />
        )
      ) : (
        <AccountTripRows items={rows} rows={snap.rows} />
      )}
    </AccountSection>
  );
}
