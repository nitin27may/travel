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

/** The picks grouped by area when they span two or more (a trip across regions, TB-W2); one group named "" otherwise. Picks with no known area go last under "Other". */
export function trayGroups(flow: Pick<FlowState, 'picks' | 'pickAreas'>): { area: string; picks: FlowState['picks'] }[] {
  const names = new Set(flow.picks.map((p) => flow.pickAreas?.[p.ref]).filter((x): x is string => Boolean(x)));
  if (names.size < 2) return [{ area: '', picks: flow.picks }];
  const out: { area: string; picks: FlowState['picks'] }[] = [];
  for (const p of flow.picks) {
    const area = flow.pickAreas?.[p.ref] ?? 'Other';
    const g = out.find((x) => x.area === area);
    if (g) g.picks = [...g.picks, p];
    else out.push({ area, picks: [p] });
  }
  return out.sort((a, b) => (a.area === 'Other' ? 1 : b.area === 'Other' ? -1 : 0));
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
        <div className="tray-groups">
          {trayGroups(flow).map((g) => (
            <section key={g.area} className="tray-group" aria-label={g.area || undefined}>
              {g.area ? (
                <h3 className="tray-area">
                  {g.area} <span className="num">({g.picks.length})</span>
                </h3>
              ) : null}
              <ul className="tray-rows" role="list">
                {g.picks.map((p) => (
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
            </section>
          ))}
        </div>
      ) : (
        <p className="plan-help">Pick places from the list. A place you mark Must see is never left out of the plan.</p>
      )}
    </div>
  );
}
