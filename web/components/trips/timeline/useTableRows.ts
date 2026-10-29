'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TableRowsMode } from './tableRows';

const fromAddress = (): TableRowsMode | null => {
  const v = new URLSearchParams(window.location.search).get('rows');
  return v === 'stops' ? 'stops' : v === 'all' ? 'all' : null;
};

/**
 * Which rows the Table view shows: Everything, or Stops only (`rows=stops`, remembered per trip on this device). The address wins; with none
 * the remembered choice applies once the Table is on screen. A choice rewrites the address with `replaceState` (a filter, not a place in the
 * history) and is remembered through the lazy storage module, so the start JS carries only this small hook.
 */
export function useTableRows(slug: string, active: boolean): [TableRowsMode, (m: TableRowsMode) => void] {
  const [mode, setMode] = useState<TableRowsMode>('all');
  useEffect(() => {
    if (!active) return;
    const asked = fromAddress();
    if (asked) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the address is outside React: read once when the Table opens
      setMode(asked);
      return;
    }
    let live = true;
    void import('@/lib/storage/tripUi').then((m) => {
      if (live && m.readTripEntry(slug).rows === 'stops') setMode('stops');
    });
    return () => {
      live = false;
    };
  }, [slug, active]);
  const choose = useCallback(
    (next: TableRowsMode) => {
      setMode(next);
      const u = new URL(window.location.href);
      if (next === 'stops') u.searchParams.set('rows', 'stops');
      else u.searchParams.delete('rows');
      window.history.replaceState(window.history.state, '', `${u.pathname}${u.search}${u.hash}`);
      void import('@/lib/storage/tripUi').then((m) => m.writeTripEntry(slug, { rows: next }));
    },
    [slug],
  );
  return [mode, choose];
}
