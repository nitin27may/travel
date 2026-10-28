'use client';

import { useEffect } from 'react';
import type { PlanOp } from '@/lib/trip-edit/model';
import type { Profile } from '@travel/core/schedule/types.ts';
import type { PlanDraft } from '@/lib/trip-edit/model';
import { partyLine } from '@travel/core/trips/party.ts';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { SaveResult, Where } from '@/lib/trip-edit/open';
import { setRailParty } from '@/components/trips/timeline/railWords';
import type { TimelineApi } from '@/components/trips/timeline/useTimeline';
import { TripSettings } from './TripSettings';
import '@/styles/party-bar.css';

interface Props {
  doc: PlanDraft;
  api: TimelineApi;
  /** The profile the plan was written for. */
  defaults: Profile;
  title: string;
  ourTitle: string | null;
  where: Where;
  save: (ops: readonly PlanOp[]) => SaveResult;
  edit: boolean;
  setEdit: (v: boolean) => void;
}

/**
 * "Plan it for": the trip's own party in words and an Edit that opens the settings sheet. The published plan's party bar keeps the party on
 * the device (`travel.party`) and in the address; a trip's party is its own and lives in its document, so this line replaces that bar here
 * and never touches the device party (step2 README 8, EM-B).
 */
export function PartyLine({ doc, api, defaults, title, ourTitle, where, save, edit, setEdit }: Props) {
  const p = api.state.profile;
  const party = doc.travellers ?? { adults: p.adults, children: p.youngest === null ? [] : [p.youngest] };
  const words = partyLine({ adults: party.adults, children: party.children }, p.pace, false);
  const short = partyLine({ adults: party.adults, children: party.children }, p.pace, true);
  // the sticky day bar says the same party in its own words
  const key = JSON.stringify([party, p.pace]);
  useEffect(() => {
    setRailParty({ adults: party.adults, children: [...party.children], pace: p.pace, shared: true, own: true });
    return () => setRailParty(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for party and pace
  }, [key]);
  return (
    <section className="pb" aria-labelledby="plan-for-h" id="plan-for" data-print="hide">
      <div className="pb-row">
        <h2 id="plan-for-h" className="pb-label">Planned for</h2>
        <p className="pb-val num" data-testid="party-line">
          <span className="pb-long">{words}</span>
          <span className="pb-short">{short}</span>
        </p>
        <div className="pb-actions">
          <Button size="sm" className="pb-edit" aria-haspopup="dialog" onClick={() => setEdit(true)}>
            <Icon name="pencil" size={14} /> Edit
          </Button>
        </div>
      </div>
      <TripSettings open={edit} onClose={() => setEdit(false)} doc={doc} defaults={defaults} title={title} ourTitle={ourTitle} where={where} save={save} />
    </section>
  );
}
