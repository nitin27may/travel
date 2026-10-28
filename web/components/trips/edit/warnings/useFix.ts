'use client';

// The one fix of a Fix-level warning (edit-mode-spec 11.1). A "move" code (closed that day, a booking elsewhere) tries every other day with the
// scheduler, the way the Move to day list does, and offers the nearest day it fits cleanly; when no day does, or the code is a "remove" code,
// the fix is to remove the stop. Either way it is one of E1's operations with its own undo step and toast. The scheduler loads on demand and
// only for a day that has a Fix warning, so a clean trip pays nothing.
import { useEffect, useState } from 'react';
import type { Profile, TimelineEntry } from '@travel/core/schedule/types.ts';
import { candidateToItem, type TimelineModel } from '@/components/trips/timeline/model';
import type { PlanDraft } from '@/lib/trip-edit/model';
import { dayChoices } from '@/lib/trip-edit/moveFit';
import { deltaOfDraft } from '@/lib/trip-edit/source';
import { stopTarget } from '@/lib/trip-edit/stopOps';
import { fixKindOf } from '@/lib/trip-edit/warnings';

export type Fix = { kind: 'move'; day: number; after: string | null } | { kind: 'remove' };

export interface PlanCtx {
  doc: PlanDraft;
  model: TimelineModel;
  profile: Profile;
  start: string | null;
}

/**
 * The other day that takes the stop with no new warning, or null. Only days near the stop count (ER-001: a far day prices the drive wrongly
 * and clears the warning without making the day workable); the day the stop came from is tried first, then the nearest by number.
 */
export function nearestFit(rows: readonly { n: number; current: boolean; fit: 'fits' | 'tight' | 'fix'; last: string | null; near?: boolean }[], from: number, home?: number): { day: number; after: string | null } | null {
  // back on the day the plan put it on is always a fair fix unless the stop would break a rule there: that day's own checks were the plan's (Tight is not new)
  const own = home === undefined ? undefined : rows.find((r) => r.n === home && !r.current && r.fit !== 'fix' && r.near !== false);
  if (own) return { day: own.n, after: own.last };
  const ok = rows.filter((r) => !r.current && r.fit === 'fits' && r.near !== false);
  const best = ok.sort((a, b) => Math.abs(a.n - from) - Math.abs(b.n - from) || a.n - b.n)[0];
  return best ? { day: best.n, after: best.last } : null;
}

/** undefined while it is worked out, null when the warning has no fix here (a code or a row we cannot act on), else the fix. */
export function useFix(code: string, entry: TimelineEntry | null, ctx: PlanCtx, editable: boolean): Fix | null | undefined {
  const kind = fixKindOf(code);
  const [got, setGot] = useState<{ key: string; fix: Fix | null } | undefined>(undefined);
  const key = entry ? `${code}|${entry.day}:${entry.id}` : '';
  const { doc, model, profile, start } = ctx;
  useEffect(() => {
    if (!entry || !kind || !editable || kind === 'remove') return;
    let live = true;
    void import('@travel/core/schedule/template.ts').then((engine) => {
      if (!live) return;
      let fix: Fix = { kind: 'remove' };
      try {
        const rows = dayChoices({
          engine,
          days: model.days,
          delta: deltaOfDraft(doc),
          overrides: doc.template?.overrides ?? {},
          profile,
          addItem: (a) => {
            const c = model.addables[a.slug];
            return c ? candidateToItem(c) : null;
          },
          start,
          stop: stopTarget(doc, entry),
        });
        const best = nearestFit(rows, entry.day, stopTarget(doc, entry).day);
        if (best) fix = { kind: 'move', day: best.day, after: best.after };
      } catch {
        // the scheduler could not try a day: removing the stop is still a fix
      }
      setGot({ key, fix });
    });
    return () => {
      live = false;
    };
  }, [key, kind, editable, doc, model, profile, start, entry]);
  if (!entry || !kind || !editable) return null;
  if (kind === 'remove') return { kind: 'remove' };
  return got && got.key === key ? got.fix : undefined;
}
