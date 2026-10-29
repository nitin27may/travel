'use client';

import { Segmented } from '@/components/ui/Segmented';
import type { Party } from '@travel/core/trips/party.ts';
import { candidateQuery } from '@/lib/plan/query';
import type { FlowState } from '@/lib/plan/flow';
import { REACH_CHOICES } from '@/lib/plan/flow';
import { APPROX, plural, reachText } from '@/lib/plan/format';
import { PLAN_BUILDER_UI } from '@/lib/config/product';
import { useCount } from '@/lib/plan/useCandidates';
import { AskUs } from './AskUs';

/** The count sentence: "9 places within 3 h ≈" or, when thin, "4 places within 3 h so far" (FLOW stage 1, F-Q1). */
export function CountWords({ total, min }: { total: number; min: number }) {
  const thin = total < PLAN_BUILDER_UI.thinCount;
  return <>{`${plural(total, 'place')} within ${reachText(min)} ${thin ? 'so far' : APPROX}`}</>;
}

/** "Longest drive from home, each way" (FLOW TF7): the reach choices and the live count they give. */
export function ReachControl({ flow, party, onChange }: { flow: FlowState; party: Party; onChange: (min: number) => void }) {
  const count = useCount(candidateQuery(flow, party, { strip: true, pageSize: 1 }));
  return (
    <div className="plan-field">
      <p className="plan-label" id="plan-reach-l">
        Longest drive from home, each way
      </p>
      <Segmented
        className="plan-seg"
        label="Longest drive from home, each way"
        value={String(flow.driveLimitMin)}
        onChange={(v) => onChange(Number(v))}
        segments={REACH_CHOICES.map((m) => ({ value: String(m), label: reachText(m) }))}
      />
      <p className="plan-count" aria-live="polite">
        {count.status === 'ok' && count.total !== null ? <CountWords total={count.total} min={flow.driveLimitMin} /> : count.status === 'error' || count.status === 'unavailable' ? 'We could not count the places.' : 'Counting places…'}
        {count.status === 'ok' && (count.total ?? 0) < PLAN_BUILDER_UI.thinCount ? (
          <>
            {' '}
            <AskUs />
          </>
        ) : null}
      </p>
    </div>
  );
}
