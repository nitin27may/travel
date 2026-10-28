'use client';

import type { DayTimeline, TimelineEntry } from '@travel/core/schedule/types.ts';
import { Icon } from '@/components/ui/Icon';
import { DayWarnings, type FixActs } from '../warnings/DayWarnings';
import type { PlanCtx } from '../warnings/useFix';
import './day.css';

interface Props {
  n: number;
  note: string;
  tl: Pick<DayTimeline, 'warnings' | 'entries'>;
  plan: PlanCtx;
  canEdit: (e: TimelineEntry) => boolean;
  act: FixActs;
}

/**
 * Under a day's header in edit mode: the person's note on the day (STEP2-E4), then its warnings in two levels with the one fix of each Fix
 * line (STEP2-E5, warnings/DayWarnings.tsx). Never colour alone: the word and the triangle say it too (edit-mode-spec 11.1).
 */
export function DayStatus({ n, note, tl, plan, canEdit, act }: Props) {
  return (
    <div className="day-status" data-testid={`day-status-${n}`}>
      {note ? (
        <p className="day-note">
          <Icon name="pencil" size={14} />
          <span>
            <b className="day-note-label">Your note</b> {note}
          </span>
        </p>
      ) : null}
      <DayWarnings n={n} tl={tl} plan={plan} canEdit={canEdit} act={act} />
    </div>
  );
}
