'use client';

import { useState } from 'react';
import { DEFAULT_CHILD_AGE, PARTY_MAX_ADULTS, PARTY_MAX_CHILDREN, PARTY_MIN_ADULTS, CHILD_MAX_AGE, type Party } from '@travel/core/trips/party.ts';
import { partyShortText } from '@travel/core/trips/partyWords.ts';
import { Button } from '@/components/ui/Button';
import { SideSheet } from '@/components/ui/SideSheet';
import { Stepper } from '@/components/ui/Stepper';
import type { PartyState } from '@/lib/plan/useParty';

/** "Who is going" (FLOW stage 1): the device party in words, and Edit. The party is household data: it stays on this device and goes to the server in a build only. */
export function PartyRow({ party: state }: { party: PartyState }) {
  const [open, setOpen] = useState(false);
  const { party } = state;
  const put = (next: Party) => void state.set(next);
  return (
    <div className="plan-field">
      <p className="plan-label" id="plan-who">
        Who is going
      </p>
      <div className="plan-party" role="group" aria-labelledby="plan-who">
        <span className="plan-party-words">{partyShortText(party)}</span>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)} aria-label={`Edit who is going, now ${partyShortText(party)}`}>
          Edit
        </Button>
      </div>
      <p className="plan-help">{state.fromAccount ? 'From your account. It stays on this device and is used only to fit the places to your family.' : 'Kept on this device only. It fits the places to your family.'}</p>
      <SideSheet open={open} onOpenChange={setOpen} title="Who is going" footer={<Button variant="primary" onClick={() => setOpen(false)}>Done</Button>}>
        <div className="plan-party-edit">
          <Stepper label="Adults" value={party.adults} min={PARTY_MIN_ADULTS} max={PARTY_MAX_ADULTS} decLabel="Fewer adults" incLabel="More adults" onChange={(n) => put({ ...party, adults: n })} />
          {party.children.map((age, i) => (
            <div className="plan-child" key={i}>
              <Stepper
                label={`Child ${i + 1}`}
                value={age ?? DEFAULT_CHILD_AGE}
                min={0}
                max={CHILD_MAX_AGE}
                decLabel={`Younger, child ${i + 1}`}
                incLabel={`Older, child ${i + 1}`}
                format={(n) => (n === 0 ? 'Under 1' : `Age ${n}`)}
                onChange={(n) => put({ ...party, children: party.children.map((c, j) => (j === i ? n : c)) })}
              />
              <Button variant="ghost" size="sm" onClick={() => put({ ...party, children: party.children.filter((_, j) => j !== i) })} aria-label={`Remove child ${i + 1}`}>
                Remove
              </Button>
            </div>
          ))}
          <Button variant="secondary" onClick={() => put({ ...party, children: [...party.children, DEFAULT_CHILD_AGE] })} disabled={party.children.length >= PARTY_MAX_CHILDREN}>
            Add a child
          </Button>
          <p className="plan-help">Ages steer which places fit and how long the days are. Nothing here is sent except to build your plan.</p>
        </div>
      </SideSheet>
    </div>
  );
}
