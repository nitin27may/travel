'use client';

import { useEffect, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { gettingThere } from '@/lib/trip-edit/gettingThere';
import { builtDayChecks } from '@/lib/trip-edit/built';
import { warnLevel, type PlanDraft } from '@/lib/trip-edit/model';
import { clearDay, report } from '../warnings/store';
import { builtDayNote } from './dayOps';
import '../day/day.css';
import '../warnings/warnings.css';
import './built.css';

/**
 * Under a built day's header in edit mode: the person's note, then the engine's checks for the day at their level (core WARN_LEVEL; Fix in
 * `--crit` text with the triangle, Check on `--warn-soft`), then the day's driving from the build. The builder's codes carry no one-button
 * fix yet (edit-mode-spec 11.1: "levelled but not offered"), so the line says what is wrong and Move, Remove and Re-flow do the rest. A day
 * the person changed since the build reads "Checks wait for a re-flow": the build's figures no longer describe it. The counts reach the
 * sticky row and the Summary like a copy's (warnings/store.ts).
 */
export function BuiltDayStatus({ n, doc, onSettings }: { n: number; doc: PlanDraft; onSettings?: () => void }) {
  const note = builtDayNote(doc, n);
  const c = useMemo(() => builtDayChecks(doc, n, (code) => warnLevel(code)), [doc, n]);
  useEffect(() => report(n, c.checks.map((x) => ({ day: n, code: x.code, message: x.text, entryId: null, level: x.level }))), [n, c]);
  useEffect(() => () => clearDay(n), [n]);
  const gt = gettingThere(doc, n);
  if (!note && !c.checks.length && !c.line && !c.stale && !gt) return null;
  return (
    <div className="day-status bday-checks" data-testid={`day-status-${n}`}>
      {gt ? (
        <p className="bday-gt" data-testid={`getting-${gt.end}`} data-missing={gt.missing || undefined}>
          <Icon name="flight" size={14} />
          <span>
            <b>{gt.label}</b> {gt.text}
            {gt.missing && onSettings ? (
              <>
                {' '}
                <button type="button" className="own-link" onClick={onSettings}>
                  Choose the airport
                </button>
              </>
            ) : null}
          </span>
        </p>
      ) : null}
      {note ? (
        <p className="day-note">
          <Icon name="pencil" size={14} />
          <span>
            <b className="day-note-label">Your note</b> {note}
          </span>
        </p>
      ) : null}
      {c.checks.map((x) => (
        <div key={x.code} className="wn" data-level={x.level} data-code={x.code}>
          <p className="wn-text">
            <Icon name="warn" size={14} />
            <span>
              <b>{x.level === 'fix' ? 'To fix:' : 'To check:'}</b> {x.text}
            </span>
          </p>
        </div>
      ))}
      {c.stale ? (
        <p className="bday-line">Checks wait for a re-flow: this day changed since it was built.</p>
      ) : c.line ? (
        <p className="bday-line num">
          <b>Checks</b>
          {c.line}
        </p>
      ) : null}
    </div>
  );
}
