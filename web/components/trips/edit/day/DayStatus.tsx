'use client';

import type { DayTimeline } from '@travel/core/schedule/types.ts';
import { Icon } from '@/components/ui/Icon';
import { levelLines } from '@/lib/trip-edit/dayWarnings';
import './day.css';

interface Props {
  n: number;
  note: string;
  tl: Pick<DayTimeline, 'warnings'>;
}

/**
 * Under a day's header in edit mode (STEP2-E4): the person's note on the day, then one line per warning level, "To fix" in the danger
 * colour and "To check" in the warning colour, each with the first message and how many more there are. Never colour alone: the word and
 * the triangle say it too (edit-mode-spec 11.1). STEP2-E5 adds the one fix button of each line.
 */
export function DayStatus({ n, note, tl }: Props) {
  const lines = levelLines(tl.warnings);
  if (!note && !lines.length) return null;
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
      {lines.map((l) => (
        <p key={l.level} className="day-warn" data-level={l.level}>
          <Icon name="warn" size={14} />
          <span>
            <b>{l.word}:</b> {l.text}
            {l.more > 0 ? <span className="day-warn-more"> and {l.more} more</span> : null}
          </span>
        </p>
      ))}
    </div>
  );
}
