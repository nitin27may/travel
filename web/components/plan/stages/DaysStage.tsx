'use client';

import { useState } from 'react';
import type { PlanCandidateRow } from '@travel/core/schema/api/plan.ts';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { Stepper } from '@/components/ui/Stepper';
import { Switch } from '@/components/ui/Switch';
import { PLAN_BUILDER_UI } from '@/lib/config/product';
import { youngestOf } from '@/lib/plan/draft';
import { asksDriveDay, asksMoves, estimateDays, leftOutIfShort, nightsRange, type Moves, type Pace } from '@/lib/plan/flow';
import { APPROX, durationText, plural } from '@/lib/plan/format';
import { candidateQuery } from '@/lib/plan/query';
import { useCandidates } from '@/lib/plan/useCandidates';
import { CandidateRow } from '../CandidateRow';
import { BaseEstimate, BasesSection } from './BasesSection';
import type { StageProps } from './types';

const PACES: { value: Pace; label: string }[] = [
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'standard', label: 'Standard' },
  { value: 'full', label: 'Full' },
];
const MOVES: { value: Moves; label: string }[] = [
  { value: 'fewer', label: 'Fewer' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'shorter', label: 'Shorter' },
];

/** Stage 4 (FLOW 4): nights, the driving on a day out, pace, moves, and more places in range. Its primary builds the plan. */
export function DaysStage({ flow, dispatch, party, now }: StageProps) {
  const range = nightsRange(flow.kind);
  const est = estimateDays(flow);
  const short = leftOutIfShort(flow);
  const youngest = youngestOf(party);
  const anchor = flow.picks.at(-1) ?? null;
  const q = anchor ? candidateQuery(flow, party, { near: anchor.slug, limit: PLAN_BUILDER_UI.alsoWithin, strip: true }) : null;
  const { state } = useCandidates(q);
  const extra = state.status === 'ok' ? state.rows.filter((r) => r.slug !== anchor?.slug && !flow.picks.some((p) => p.ref === r.ref)) : [];
  const [all, setAll] = useState(false);
  const shown = all ? extra : extra.slice(0, 3);
  const add = (r: PlanCandidateRow) => dispatch({ t: 'pick', pick: { ref: r.ref, slug: r.slug, name: r.name, must: false }, visitMin: r.visitMin, now: now() });
  const driveMin = flow.driveDayMin ?? PLAN_BUILDER_UI.driveDay.defaultMin;

  return (
    <div className="plan-two plan-two-even">
      <div className="plan-col">
        <div className="plan-card" role="status">
          <p className="plan-card-line">
            Your {plural(flow.picks.length, 'pick')} {flow.picks.length === 1 ? 'needs' : 'need'} about {plural(est.days, 'day')} ({plural(est.nights, 'night')}) {APPROX}
          </p>
          {short > 0 ? (
            <p className="plan-card-warn">
              {plural(flow.nights, 'night')} will leave about {plural(short, 'place')} out
            </p>
          ) : null}
          <BaseEstimate flow={flow} />
        </div>

        <Stepper
          label="Nights"
          value={flow.nights}
          min={range.min}
          max={range.max}
          decLabel="Fewer nights"
          incLabel="More nights"
          format={(n) => `${n} · ${plural(n + 1, 'day')}`}
          onChange={(n) => dispatch({ t: 'nights', nights: n, now: now() })}
        />

        {flow.nights >= 2 ? <BasesSection flow={flow} dispatch={dispatch} party={party} now={now} /> : null}

        {asksDriveDay(flow) ? (
          <div className="plan-field">
            <p className="plan-label" id="plan-dd-l">
              Driving on a day out from your base, in total
            </p>
            <Switch checked={flow.driveDayMin === null} onCheckedChange={(on) => dispatch({ t: 'patch', patch: { driveDayMin: on ? null : driveMin }, now: now() })}>
              Let the pace decide
            </Switch>
            {flow.driveDayMin !== null ? (
              <Slider label="Driving on a day out from your base, in total" value={flow.driveDayMin} min={PLAN_BUILDER_UI.driveDay.min} max={PLAN_BUILDER_UI.driveDay.max} step={PLAN_BUILDER_UI.driveDay.step} format={durationText} onValueChange={(v) => dispatch({ t: 'patch', patch: { driveDayMin: v }, now: now() })} />
            ) : (
              <p className="plan-help">Relaxed days drive least, full days most.</p>
            )}
          </div>
        ) : null}

        <div className="plan-field">
          <p className="plan-label" id="plan-pace-l">
            Pace
          </p>
          <Segmented className="plan-seg" label="Pace" value={flow.pace} onChange={(v) => dispatch({ t: 'patch', patch: { pace: v }, now: now() })} segments={PACES} />
        </div>

        {asksMoves(flow) ? (
          <div className="plan-field">
            <p className="plan-label" id="plan-moves-l">
              Moves
            </p>
            <Segmented className="plan-seg" label="Moves" value={flow.moves} onChange={(v) => dispatch({ t: 'patch', patch: { moves: v }, now: now() })} segments={MOVES} />
            <p className="plan-help">Fewer moves means fewer hotels to pack up. Shorter means less driving between them.</p>
          </div>
        ) : null}
      </div>

      <section className="plan-aside plan-aside-list" aria-labelledby="plan-also-h">
        <h2 id="plan-also-h" className="plan-cap">
          Also within your driving{state.status === 'ok' ? ` (${extra.length})` : ''}
        </h2>
        {state.status === 'loading' ? <p className="plan-help">Finding more places…</p> : null}
        {state.status === 'error' || state.status === 'unavailable' ? <p className="plan-help">We cannot list places near your picks yet. Pick more on the last step, or add them on the trip&apos;s page.</p> : null}
        {state.status === 'ok' && !extra.length ? <p className="plan-help">Nothing else we hold near your picks. Add days or pick more on the last step.</p> : null}
        {shown.length ? (
          <ul className="cand-list" role="list">
            {shown.map((r) => (
              <CandidateRow key={r.ref} row={r} picked={false} youngest={youngest} from={anchor?.name} onToggle={add} full={flow.picks.length >= PLAN_BUILDER_UI.maxPicks} />
            ))}
          </ul>
        ) : null}
        {extra.length > 3 ? (
          <button type="button" className="link-btn" aria-expanded={all} onClick={() => setAll(!all)}>
            {all ? 'Show fewer' : `Show ${extra.length - 3} more`}
          </button>
        ) : null}
      </section>
    </div>
  );
}
