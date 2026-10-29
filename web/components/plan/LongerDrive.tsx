'use client';

import type { Party } from '@travel/core/trips/party.ts';
import { Button } from '@/components/ui/Button';
import { REACH_CHOICES, type FlowState } from '@/lib/plan/flow';
import { plural, reachText } from '@/lib/plan/format';
import { candidateQuery } from '@/lib/plan/query';
import { useCount } from '@/lib/plan/useCandidates';
import { AskUs } from './AskUs';

/**
 * The one fix for a thin or empty reach (RB-009): a button that widens the drive to the next choice that holds more places, with the count
 * it would give. Never a dead end: when no longer drive helps, it says so and offers "Ask us" when the form is on. Draws nothing while the
 * counts load, and nothing when the reach already holds enough (`below`).
 */
export function LongerDrive({ flow, party, onChange, below }: { flow: FlowState; party: Party; onChange: (min: number) => void; below: number }) {
  const longer = REACH_CHOICES.filter((m) => m > flow.driveLimitMin);
  const first = useCount(longer[0] ? candidateQuery(flow, party, { strip: true, pageSize: 1, driveLimitMin: longer[0] }) : null);
  const second = useCount(longer[1] ? candidateQuery(flow, party, { strip: true, pageSize: 1, driveLimitMin: longer[1] }) : null);
  const here = useCount(candidateQuery(flow, party, { strip: true, pageSize: 1 }));
  if (here.status !== 'ok' || (here.total ?? 0) >= below) return null;
  const waiting = (longer[0] && first.status === 'loading') || (longer[1] && second.status === 'loading');
  if (waiting) return null;
  const have = here.total ?? 0;
  const options: { min: number; n: number }[] = [];
  for (const [min, n] of [[longer[0], first.total], [longer[1], second.total]] as [number | undefined, number | null][]) if (min !== undefined && n !== null && n > have) options.push({ min, n });
  const best = options[0];
  return (
    <div className="plan-longer" data-testid="longer-drive">
      {best ? (
        <Button variant="secondary" onClick={() => onChange(best.min)}>
          Drive up to {reachText(best.min)} ({plural(best.n, 'place')})
        </Button>
      ) : (
        <p className="plan-help">Nothing more within {reachText(longer.at(-1) ?? flow.driveLimitMin)} of this start. Try another starting point.</p>
      )}
      <AskUs />
    </div>
  );
}
