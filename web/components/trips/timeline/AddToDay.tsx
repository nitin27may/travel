'use client';

import dynamic from 'next/dynamic';
import { useId, useState } from 'react';
import type { Profile, ScheduleDayInput, ScheduleItem } from '@travel/core/schedule/types.ts';
import { Icon } from '@/components/ui/Icon';
import type { AddCandidate } from './model';
import type { Engine } from './useTimeline';

// The panel (cost maths, candidate list) loads on first open; only the closed button is in the start bundle.
const AddToDayPanel = dynamic(() => import('./AddToDayPanel').then((m) => m.AddToDayPanel), {
  ssr: false,
  loading: () => <p className="tl-add-empty" role="status">Loading places</p>,
});

interface Props {
  day: number;
  /** Candidates offered on this day: places only. */
  candidates: AddCandidate[];
  /** Keys already added to this day. */
  taken: string[];
  onAdd: (key: string) => void;
  /** What the cost of each place is worked out from: the scheduler, the day, the profile and what the day already holds. */
  engine: Engine | null;
  loadEngine: () => void;
  input: ScheduleDayInput;
  profile: Profile;
  variant: string | null;
  added: ScheduleItem[];
}

/**
 * "Add to this day" (spec 3.7): an inline panel, not a modal. Places only, never meals or breaks (the scheduler places those): the day's other versions, the trip's stops at this
 * base and places within 30 km that have a page. No free text, so a shared link always resolves.
 */
export function AddToDay(props: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="tl-add" data-print="hide">
      {!open ? (
        <button type="button" className="tl-add-open" aria-expanded={false} aria-controls={id} onClick={() => setOpen(true)}>
          <Icon name="plus" size={15} /> Add a place to Day {props.day}
        </button>
      ) : (
        <AddToDayPanel {...props} id={id} onClose={() => setOpen(false)} onAdd={(k) => { props.onAdd(k); setOpen(false); }} />
      )}
    </div>
  );
}
