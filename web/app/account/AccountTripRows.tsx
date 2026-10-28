'use client';

import { useState } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { CopyRow } from '@/components/mine/CopyRow';
import { changedLabel, localToday, rowModel } from '@/lib/mine/rows';
import type { SyncSnapshot } from '@/lib/mine/sync';
import { MINE_TRIPS } from './account-links';
import '@/components/mine/my-trips.css';

/**
 * The rows of the Account page's My trips (review ACCT-PR MF1): Mine's own row, as a link only (no menu: managing stays in Mine), with
 * "Changed 24 Oct" as its fourth line, then "See all in Mine". A lazy chunk of AccountTrips, so the page's start chunk stays without
 * the copy readers.
 */
export function AccountTripRows({ items, rows }: { items: SyncSnapshot['items']; rows: SyncSnapshot['rows'] }) {
  const [today] = useState(() => localToday());
  return (
    <>
      <ul className="mt-list">
        {items.map((item) => (
          <CopyRow key={item.id} row={rowModel(item, today)} linkOnly note={changedLabel(rows[item.id]?.changedAt ?? '') || undefined} />
        ))}
      </ul>
      <ButtonLink href={MINE_TRIPS} variant="ghost" className="acct-see-all">
        See all in Mine
        <Icon name="arrow" size={14} />
      </ButtonLink>
    </>
  );
}
