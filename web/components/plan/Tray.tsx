'use client';

import type { Dispatch } from 'react';
import { Button } from '@/components/ui/Button';
import { estimateDays, type FlowAction, type FlowState } from '@/lib/plan/flow';
import { APPROX, plural } from '@/lib/plan/format';

/** The summary the action bar's second line and the tray header share: "6 picked · Must see 1" and "about 5 days (4 nights) ≈". */
export function trayWords(flow: Pick<FlowState, 'picks' | 'visit' | 'pace'>): { line1: string; line2: string } {
  const must = flow.picks.filter((p) => p.must).length;
  const est = estimateDays(flow);
  return {
    line1: `${flow.picks.length} picked${must ? ` · Must see ${must}` : ''}`,
    line2: flow.picks.length ? `about ${plural(est.days, 'day')} (${plural(est.nights, 'night')}) ${APPROX}` : 'Nothing picked yet',
  };
}

/** The tray (components 9.4): the picks, each with Must see and Remove. A column on desktop, a sheet's body on a phone. */
export function Tray({ flow, dispatch, now, bare }: { flow: FlowState; dispatch: Dispatch<FlowAction>; now: () => string; bare?: boolean }) {
  const words = trayWords(flow);
  return (
    <div className="tray">
      <div className="tray-head">
        {bare ? null : <h2 className="plan-h3">Your picks ({flow.picks.length})</h2>}
        <p className="tray-est" aria-live="polite">
          {words.line2}
        </p>
      </div>
      {flow.picks.length ? (
        <ul className="tray-rows" role="list">
          {flow.picks.map((p) => (
            <li key={p.ref} className="tray-row">
              <span className="tray-name">{p.name}</span>
              <button type="button" className="must-btn" aria-pressed={p.must} aria-label={`Must see ${p.name}`} onClick={() => dispatch({ t: 'must', ref: p.ref, now: now() })}>
                Must see
              </button>
              <Button variant="ghost" size="sm" aria-label={`Remove ${p.name}`} onClick={() => dispatch({ t: 'unpick', ref: p.ref, now: now() })}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="plan-help">Pick places from the list. A place you mark Must see is never left out of the plan.</p>
      )}
    </div>
  );
}
