'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import type { DayTimeline, TimelineEntry } from '@travel/core/schedule/types.ts';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { warnText } from '@/components/trips/timeline/warnText';
import { rowName } from '@/lib/trip-edit/ruleRows';
import { collect, entryOf, type Warn } from '@/lib/trip-edit/warnings';
import { clearDay, report } from './store';
import { useFix, type PlanCtx } from './useFix';
import './warnings.css';

export interface FixActs {
  moveTo: (e: TimelineEntry, day: number, after: string | null) => void;
  remove: (e: TimelineEntry, dayEntries: readonly TimelineEntry[]) => void;
}

interface Props {
  n: number;
  tl: Pick<DayTimeline, 'warnings' | 'entries'>;
  plan: PlanCtx;
  canEdit: (e: TimelineEntry) => boolean;
  act: FixActs;
}

function FixRow({ w, tl, plan, canEdit, act }: { w: Warn } & Omit<Props, 'n'>) {
  const entry = entryOf(tl, w);
  const fix = useFix(w.code, entry, plan, !!entry && canEdit(entry));
  const name = entry ? rowName(entry) : '';
  return (
    <div className="wn" data-level="fix" data-code={w.code}>
      <p className="wn-text">
        <Icon name="warn" size={14} />
        <span>
          <b>To fix:</b> {warnText(w.message)}
        </span>
      </p>
      {entry && fix ? (
        <Button
          size="sm"
          className="wn-fix"
          onClick={() => (fix.kind === 'move' ? act.moveTo(entry, fix.day, fix.after) : act.remove(entry, tl.entries))}
        >
          {fix.kind === 'move' ? `Move ${name} to Day ${fix.day}` : `Remove ${name}`}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Under a day's header: its Fix-level warnings, each with the one fix button (in `--crit` text with the triangle, never a fill), then the
 * Check-level ones: one line, or "3 to check · Show" that opens the list, with no button (information). Hidden warnings never reach here.
 * It also tells the store what the day holds, so the sticky row and the Summary count the whole trip.
 */
export function DayWarnings({ n, tl, plan, canEdit, act }: Props) {
  const ws = useMemo(() => collect([{ day: n, warnings: tl.warnings }]), [n, tl.warnings]);
  useEffect(() => report(n, ws), [n, ws]);
  useEffect(() => () => clearDay(n), [n]);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const fixes = ws.filter((w) => w.level === 'fix');
  const checks = ws.filter((w) => w.level === 'check');
  if (!ws.length) return null;
  return (
    <div className="wns" data-testid={`day-warnings-${n}`}>
      {fixes.map((w) => (
        <FixRow key={`${w.code}|${w.entryId ?? ''}|${w.message}`} w={w} tl={tl} plan={plan} canEdit={canEdit} act={act} />
      ))}
      {checks.length === 1 ? (
        <div className="wn" data-level="check">
          <p className="wn-text">
            <Icon name="warn" size={14} />
            <span>
              <b>To check:</b> {warnText(checks[0]!.message)}
            </span>
          </p>
        </div>
      ) : checks.length > 1 ? (
        <div className="wn" data-level="check">
          <p className="wn-text">
            <Icon name="warn" size={14} />
            <span>
              <b>{checks.length} to check</b> ·{' '}
              <button type="button" className="wn-show" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((v) => !v)}>
                {open ? 'Hide' : 'Show'}
              </button>
            </span>
          </p>
          {open ? (
            <ul id={listId} className="wn-list">
              {checks.map((w) => (
                <li key={`${w.code}|${w.entryId ?? ''}|${w.message}`}>{warnText(w.message)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
