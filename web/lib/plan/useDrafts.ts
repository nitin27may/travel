'use client';

import { useEffect, useState } from 'react';
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { PLANS_CHANGED_EVENT } from './keys';
import { readDrafts, type DraftList } from './store';

/** The documents on this device, newest first; reads again when this tab or another writes the list. */
export function useDrafts(): DraftList & { ready: boolean; reload: () => void } {
  const [n, setN] = useState(0);
  const [list, setList] = useState<DraftList & { ready: boolean }>({ drafts: [], status: 'ok', ready: false });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the list is in the browser, so the first paint is empty and this reads it
    setList({ ...readDrafts(), ready: true });
  }, [n]);
  useEffect(() => {
    const again = () => setN((x) => x + 1);
    addEventListener(PLANS_CHANGED_EVENT, again);
    addEventListener('storage', again);
    return () => {
      removeEventListener(PLANS_CHANGED_EVENT, again);
      removeEventListener('storage', again);
    };
  }, []);
  return { ...list, reload: () => setN((x) => x + 1) };
}

export type { PlanDraft };
