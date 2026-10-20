'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import type { Profile, ScheduleDayInput, ScheduleItem } from '@travel/core/schedule/types.ts';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { usePrefs } from '@/lib/format/prefs';
import { formatDistance } from '@/lib/format/units';
import { addCost, costLine, type AddCost } from './consequence';
import { candidateToItem, type AddCandidate } from './model';
import type { Engine } from './useTimeline';

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

const GROUP_LABEL: Record<AddCandidate['group'], string> = { variant: 'From the other versions of this day', trip: 'Elsewhere on this trip, near here', nearby: 'Within 30 km, with a place page' };

/**
 * "Add to this day" (spec 3.7): an inline panel, not a modal. Places only, never meals or breaks (the scheduler places those): the day's other versions, the trip's stops at this
 * base and places within 30 km that have a page. No free text, so a shared link always resolves.
 */
export function AddToDay({ day, candidates, taken, onAdd, engine, loadEngine, input, profile, variant, added }: Props) {
  const [prefs] = usePrefs();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const id = useId();
  // the cost of each place, worked out one at a time while the panel is open so the panel opens at once
  const [costs, setCosts] = useState<{ for: string; byKey: Record<string, AddCost> }>({ for: '', byKey: {} });
  const stamp = `${engine ? 1 : 0}|${JSON.stringify(profile)}|${variant}|${added.map((a) => a.id).join()}|${candidates.map((c) => c.key).join()}`;
  useEffect(() => {
    if (!open) return;
    loadEngine();
    if (!engine) return;
    let live = true;
    const todo = candidates.filter((c) => !taken.includes(c.key));
    const byKey: Record<string, AddCost> = {};
    const step = (i: number) => {
      if (!live) return;
      const c = todo[i];
      if (!c) return;
      byKey[c.key] = addCost(engine, input, profile, { variant, added }, candidateToItem(c));
      setCosts({ for: stamp, byKey: { ...byKey } });
      window.setTimeout(() => step(i + 1), 0);
    };
    step(0);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `stamp` stands for every other input
  }, [open, engine, stamp]);
  const costOf = (key: string): AddCost | null => (costs.for === stamp ? (costs.byKey[key] ?? null) : null);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return candidates.filter((c) => !taken.includes(c.key) && (!needle || c.name.toLowerCase().includes(needle) || c.label.toLowerCase().includes(needle)));
  }, [candidates, taken, q]);
  const groups = (['variant', 'trip', 'nearby'] as const).map((g) => [g, shown.filter((c) => c.group === g)] as const).filter(([, l]) => l.length);
  return (
    <div className="tl-add" data-print="hide">
      {!open ? (
        <button type="button" className="tl-add-open" aria-expanded={false} aria-controls={id} onClick={() => setOpen(true)}>
          <Icon name="plus" size={15} /> Add a place to Day {day}
        </button>
      ) : (
        <div id={id} className="tl-add-panel" role="group" aria-label={`Add to Day ${day}`}>
          <div className="tl-add-bar">
            <input type="search" className="input tl-add-q" placeholder="Search these places" aria-label="Search these places" value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="button" className="tl-add-close" onClick={() => setOpen(false)} aria-label="Close add to this day">
              <Icon name="close" size={16} />
            </button>
          </div>
          {groups.map(([g, list]) => (
            <section key={g} className="tl-add-group">
              <h4 className="tl-add-h">{GROUP_LABEL[g]}</h4>
              <ul className="tl-add-list">
                {list.map((c) => {
                  const cost = costOf(c.key);
                  const late = cost?.tooLate === true;
                  return (
                    <li key={c.key}>
                      <button type="button" className="tl-add-item" aria-disabled={late || undefined} data-late={late || undefined} onClick={() => { if (!late) onAdd(c.key); }}>
                        <span className="tl-add-name">{c.name}</span>
                        <Chip kind="kind" icon={false}>{c.label}</Chip>
                        {c.km !== null ? <span className="tl-add-km num">{formatDistance(c.km, prefs.distance)} away</span> : null}
                        <Icon name="plus" size={14} />
                        <span className="tl-add-cost num" data-state={cost ? (late ? 'late' : 'ok') : 'wait'} role={late ? 'note' : undefined}>
                          {cost ? costLine(cost) : 'Working out the driving'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {!shown.length ? <p className="tl-add-empty">Nothing else is offered for this day{q ? ` that matches "${q}"` : ''}.</p> : null}
        </div>
      )}
    </div>
  );
}
