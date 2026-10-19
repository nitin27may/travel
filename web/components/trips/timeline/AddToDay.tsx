'use client';

import { useId, useMemo, useState } from 'react';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import type { AddCandidate } from './model';

interface Props {
  day: number;
  /** Candidates offered on this day, quick adds first. */
  candidates: AddCandidate[];
  /** Keys already added to this day. */
  taken: string[];
  onAdd: (key: string) => void;
}

const GROUP_LABEL: Record<AddCandidate['group'], string> = { quick: 'Quick', variant: 'From the other versions of this day', trip: 'Elsewhere on this trip, near here', nearby: 'Within 30 km, with a place page' };

/**
 * "Add to this day" (spec 3.7): an inline panel, not a modal. Candidates only: the day's other versions, the trip's stops at this
 * base and places within 30 km that have a page. No free text, so a shared link always resolves.
 */
export function AddToDay({ day, candidates, taken, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const id = useId();
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return candidates.filter((c) => !taken.includes(c.key) && (!needle || c.name.toLowerCase().includes(needle) || c.label.toLowerCase().includes(needle)));
  }, [candidates, taken, q]);
  const quick = shown.filter((c) => c.group === 'quick');
  const groups = (['variant', 'trip', 'nearby'] as const).map((g) => [g, shown.filter((c) => c.group === g)] as const).filter(([, l]) => l.length);
  return (
    <div className="tl-add" data-print="hide">
      {!open ? (
        <button type="button" className="tl-add-open" aria-expanded={false} aria-controls={id} onClick={() => setOpen(true)}>
          <Icon name="plus" size={15} /> Add a stop, meal or break to Day {day}
        </button>
      ) : (
        <div id={id} className="tl-add-panel" role="group" aria-label={`Add to Day ${day}`}>
          <div className="tl-add-bar">
            <input type="search" className="input tl-add-q" placeholder="Search these places" aria-label="Search these places" value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="button" className="tl-add-close" onClick={() => setOpen(false)} aria-label="Close add to this day">
              <Icon name="close" size={16} />
            </button>
          </div>
          {quick.length ? (
            <div className="tl-add-quick">
              {quick.map((c) => (
                <button key={c.key} type="button" className="chip chip-neutral tl-add-chip" onClick={() => onAdd(c.key)}>
                  <Icon name="plus" size={12} /> {c.name}
                </button>
              ))}
            </div>
          ) : null}
          {groups.map(([g, list]) => (
            <section key={g} className="tl-add-group">
              <h4 className="tl-add-h">{GROUP_LABEL[g]}</h4>
              <ul className="tl-add-list">
                {list.map((c) => (
                  <li key={c.key}>
                    <button type="button" className="tl-add-item" onClick={() => onAdd(c.key)}>
                      <span className="tl-add-name">{c.name}</span>
                      <Chip kind="kind" icon={false}>{c.label}</Chip>
                      <Icon name="plus" size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!shown.length ? <p className="tl-add-empty">Nothing else is offered for this day{q ? ` that matches "${q}"` : ''}.</p> : null}
        </div>
      )}
    </div>
  );
}
