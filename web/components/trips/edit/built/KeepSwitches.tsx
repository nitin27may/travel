'use client';

import type { TimelineEntry } from '@travel/core/schedule/types.ts';
import { builtMarks, keepState } from '@/lib/trip-edit/built';
import type { PlanDraft } from '@/lib/trip-edit/model';
import './built.css';

interface Props {
  entry: TimelineEntry;
  doc: PlanDraft;
  onKeep: (on: boolean) => void;
  onMust: (on: boolean) => void;
}

/**
 * The two switches of a built stop in its item sheet (edit-mode-spec 5; README 5.2): **Keep on Day n** (on for a stop the person placed or
 * locked, with the reason under it, TB-N2R R1; off is `release`, on is `lock`) and **Must see** (`setMust`). The stop's marks head the
 * group in words ("Moved by you · Kept on Day 3", 4.1). Menu rows with a checked state, so arrows reach them like the other rows.
 */
export function KeepSwitches({ entry: e, doc, onKeep, onMust }: Props) {
  const s = keepState(doc, e.id);
  const marks = builtMarks(doc)(e);
  const day = s.day ?? e.day;
  const why = `keep-why-${e.day}-${e.id.replace(/[^a-z0-9-]/gi, '-')}`;
  return (
    <div className="keep" role="group" aria-label={`Keep ${e.title}`}>
      {marks.length ? <p className="keep-marks">{marks.join(' · ')}</p> : null}
      <button type="button" role="menuitemcheckbox" aria-checked={s.on} aria-describedby={why} className="edit-row keep-row" onClick={() => onKeep(!s.on)}>
        <span className="switch-track" aria-hidden="true">
          <span className="switch-thumb" />
        </span>
        <span>Keep on Day {day}</span>
      </button>
      <p className="edit-why keep-why" id={why}>{s.reason}</p>
      <button type="button" role="menuitemcheckbox" aria-checked={s.must} className="edit-row keep-row" onClick={() => onMust(!s.must)}>
        <span className="switch-track" aria-hidden="true">
          <span className="switch-thumb" />
        </span>
        <span>Must see</span>
      </button>
      <hr className="edit-sep" />
    </div>
  );
}
