'use client';

import type { Profile } from '@travel/core/schedule/types.ts';
import { partyText } from '@travel/core/trips/partyWords.ts';
import { planAge } from '@travel/core/trips/party.ts';
import { Segmented } from '@/components/ui/Segmented';
import { Travellers } from '@/components/actions/Travellers';
import type { PlanDraft, PlanOp } from '@/lib/trip-edit/model';
import { partyOps, profileOfDraft } from '@/lib/trip-edit/source';
import { newOpId } from '@/lib/trip-edit/stopOps';

const PACES = [
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'standard', label: 'Standard' },
  { value: 'full', label: 'Full' },
] as const;

interface Props {
  doc: PlanDraft;
  defaults: Profile;
  run: (ops: PlanOp[], label: string) => boolean;
}

/**
 * Who is going (the copy sheet's own Travellers block, so the two never differ) and Pace. A copy re-flows from our plan for the new party at
 * once and the days follow it unless the person chose a version (edit-mode-spec 9.3); the trip's party never changes `travel.party` (EM-B).
 */
/** A built trip's pace changes the days, so it waits for Rebuild (STEP2-B2); the words say why, they do not hide the row. */
const PACE_WAITS = 'Pace changes the days, so it waits for Rebuild. Not available yet.';

export function PartySection({ doc, defaults, run }: Props) {
  const built = !doc.template;
  const profile = profileOfDraft(doc, defaults);
  const party = doc.travellers ?? { adults: profile.adults, children: profile.youngest === null ? [] : [profile.youngest] };
  const set = (next: { adults: number; children: number[] }, pace: Profile['pace'], label: string) => run(partyOps(doc, defaults, next, pace, newOpId), label);
  return (
    <>
      <section className="own-set-party trav" role="group" aria-labelledby="own-who-h">
        <h3 id="own-who-h" className="field-label">Who is going</h3>
        <Travellers
          party={party}
          onChange={(p) => {
            const next = { adults: p.adults, children: p.children.map(planAge) };
            set(next, profile.pace, `Planned for ${partyText(next)}`);
          }}
        />
      </section>
      <div className="own-set-row" id="own-pace">
        <span className="field-label" id="own-pace-l">Pace</span>
        <Segmented
          label="Pace"
          segments={PACES.map((s) => ({ ...s, ...(built ? { disabled: true, title: PACE_WAITS } : {}) }))}
          value={profile.pace}
          onChange={(pace) => set(party, pace, `Pace is now ${PACES.find((x) => x.value === pace)!.label}`)}
        />
        {built ? <p className="own-set-note" id="own-pace-why">{PACE_WAITS}</p> : null}
      </div>
    </>
  );
}
