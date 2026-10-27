'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { DayTimeline } from '@travel/core/schedule/types.ts';
import { CHILD_MAX_AGE, DEFAULT_CHILD_AGE, PARTY_MAX_ADULTS, PARTY_MAX_CHILDREN, PARTY_MIN_ADULTS, adultsText, childrenText, planAge, youngestOf, type Party } from '@travel/core/trips/party.ts';
import { Icon } from '@/components/ui/Icon';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { Stepper } from '@/components/ui/Stepper';
import { Switch } from '@/components/ui/Switch';
import { usePrefs } from '@/lib/format/prefs';
import { formatDistance } from '@/lib/format/units';
import '@/styles/party-editor.css';
import { keep, whoOf } from './partyLogic';
import type { TimelineModel } from './model';
import type { TimelineApi } from './useTimeline';

const PACE_NOTE = {
  relaxed: 'Relaxed: a later start, shorter outings, a break in the afternoon.',
  standard: 'Standard: one main outing a day, back at base before dinner.',
  full: 'Full: the longest option every day, an early start, dinner late.',
} as const;

const AGES = Array.from({ length: CHILD_MAX_AGE + 1 }, (_, i) => i);
const ageName = (n: number): string => (n === 0 ? 'Under 1' : String(n));

/** "Whole family on 13 days, Easy day on 2": what the profile chose, counted. */
function versionCounts(model: TimelineModel, timelines: DayTimeline[]): string[] {
  const label = new Map<string, string>();
  for (const d of model.days) for (const v of d.variants) if (!label.has(v.key)) label.set(v.key, v.label);
  const n = new Map<string, number>();
  for (const t of timelines) n.set(t.variant.key, (n.get(t.variant.key) ?? 0) + 1);
  return [...n].filter(() => model.hasVariants && n.size > 1).map(([k, c]) => `${label.get(k) ?? k} on ${c} ${c === 1 ? 'day' : 'days'}`);
}

/** What the plan is now, in a sentence (the live line under the controls, spec 5.3). */
export function profileLine(model: TimelineModel, api: TimelineApi, party: Party): string {
  const p = api.state.profile;
  const counts = versionCounts(model, api.timelines);
  const youngest = youngestOf(party);
  const unset = party.children.filter((a) => a === null).length;
  const who =
    youngest === null
      ? adultsText(party.adults)
      : `${adultsText(party.adults)} and ${childrenText(party.children).replace(/ \(.*\)$/, '')} (youngest ${youngest})`;
  const head = api.changed ? `Showing the plan for ${who}, ${p.pace} pace.` : 'Showing the plan as written.';
  const days = api.changedDays.size ? ` ${api.changedDays.size} ${api.changedDays.size === 1 ? 'day' : 'days'} changed.` : '';
  const unsetNote = unset ? ` Age not set for ${unset === 1 ? 'a child' : `${unset} children`}, planning for ${DEFAULT_CHILD_AGE}.` : '';
  return `${head}${unsetNote} ${counts.length ? `${counts.join(' · ')}.` : ''}${days} Written for ${model.writtenFor}.`.replace(/\s{2,}/g, ' ');
}

interface Props {
  model: TimelineModel;
  api: TimelineApi;
  party: Party;
  /** The party was chosen and kept on the device; the bar follows. */
  onChosen: (p: Party, kept: boolean) => void;
  /** False when this browser refused to keep the party: it works for this visit only. */
  kept: boolean;
}

/**
 * The party editor (spec 5.3): adults 1 to 12, children 0 to 8, one age select per child, pace, and More (longest walk, split days).
 * No "Adults only / Family" switch and no Youngest stepper: no children means adults, and the youngest is the lowest age entered.
 * Every control is a closed list or a bounded stepper, so no invalid party can be typed.
 */
export function PartyEditor({ model, api, party, onChosen, kept }: Props) {
  const p = api.state.profile;
  const [prefs] = usePrefs();
  const [more, setMore] = useState(false);
  const id = useId();
  const ages = useRef<HTMLDivElement>(null);
  const focusChild = useRef<number | null>(null);

  // kept on this device first (the device module), then planned for now
  const commit = (next: Party) => {
    const r = keep(next, model.slug);
    if (!r.party) return;
    onChosen(r.party, r.kept);
    api.setProfile(whoOf(r.party, p));
  };
  const setChildren = (n: number) => {
    const children = party.children.slice(0, n);
    while (children.length < n) children.push(null);
    // adding a child appends its select and moves focus to it; removing one leaves focus on "Fewer children"
    if (n > party.children.length) focusChild.current = n - 1;
    commit({ ...party, children });
  };
  const setAge = (i: number, v: string) => commit({ ...party, children: party.children.map((a, j) => (j === i ? (v === '' ? null : Number(v)) : a)) });
  useEffect(() => {
    const i = focusChild.current;
    if (i === null) return;
    focusChild.current = null;
    ages.current?.querySelector<HTMLSelectElement>(`select[data-child="${i}"]`)?.focus();
  }, [party.children.length]);

  return (
    <div className="pe">
      <p className="pe-sub">One choice for the whole trip. Any day can still be changed on its own.</p>
      <div className="pe-grid">
        <Stepper className="pe-step" label="Adults" value={party.adults} min={PARTY_MIN_ADULTS} max={PARTY_MAX_ADULTS} decLabel="Fewer adults" incLabel="More adults" onChange={(n) => commit({ ...party, adults: n })} />
        <Stepper className="pe-step" label="Children" value={party.children.length} min={0} max={PARTY_MAX_CHILDREN} decLabel="Fewer children" incLabel="More children" onChange={setChildren} />
        {party.children.length ? (
          <div className="pe-ages" ref={ages} role="group" aria-labelledby={`${id}-ages`}>
            <span className="pe-label" id={`${id}-ages`}>Ages (needed for each child)</span>
            <div className="pe-age-list">
              {party.children.map((a, i) => (
                <div className="pe-age" key={i}>
                  <label className="pe-age-l" htmlFor={`${id}-age-${i}`}>Child {i + 1} age</label>
                  <Select id={`${id}-age-${i}`} data-child={i} value={a === null ? '' : String(a)} onChange={(e) => setAge(i, e.target.value)}>
                    {a === null ? <option value="">Choose age</option> : null}
                    {AGES.map((n) => (
                      <option key={n} value={n}>{ageName(n)}</option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
            <p className="pe-hint">0 to 17; &ldquo;Under 1&rdquo; for 0.{party.children.some((a) => a === null) ? ` Until an age is chosen the plan uses ${planAge(null)}.` : ''}</p>
          </div>
        ) : null}
        <div className="pe-field pe-pace">
          <span className="pe-label">Pace</span>
          <Segmented
            label="Pace"
            value={p.pace}
            onChange={(v) => api.setProfile({ pace: v })}
            segments={[
              { value: 'relaxed', label: 'Relaxed' },
              { value: 'standard', label: 'Standard' },
              { value: 'full', label: 'Full' },
            ]}
          />
          <p className="pe-hint">{PACE_NOTE[p.pace]}</p>
        </div>
      </div>
      <p className="pe-line" data-testid="profile-line" aria-live="polite">
        {profileLine(model, api, party)}
      </p>
      <button type="button" className="tl-more" aria-expanded={more} aria-controls={`${id}-more`} onClick={() => setMore((v) => !v)}>
        <Icon name="chevronDown" size={14} /> <span>More</span>
        <span className="pe-more-w">longest walk{model.hasSplit ? ', split days' : ''}</span>
      </button>
      {more ? (
        <div id={`${id}-more`} className="pe-more">
          <div className="pe-field">
            <span className="pe-label">Longest walk</span>
            <Segmented
              label="Longest walk"
              size="s"
              value={p.walkKm === null ? 'any' : String(p.walkKm)}
              onChange={(v) => api.setProfile({ walkKm: v === 'any' ? null : Number(v) })}
              segments={[
                { value: 'any', label: 'Any' },
                { value: '5', label: formatDistance(5, prefs.distance).replace('.0 ', ' ') },
                { value: '8', label: formatDistance(8, prefs.distance).replace('.0 ', ' ') },
                { value: '12', label: formatDistance(12, prefs.distance).replace('.0 ', ' ') },
              ]}
            />
          </div>
          {model.hasSplit ? (
            <div className="pe-field">
              <Switch checked={p.split} onCheckedChange={(v) => api.setProfile({ split: v })} note={p.adults < 2 ? 'Needs two adults' : undefined} disabled={p.adults < 2}>
                Show the split days as two lanes
              </Switch>
            </div>
          ) : null}
        </div>
      ) : null}
      <p className="pe-device">
        {kept ? 'Kept on this device only. Ages never go into a link you share; a shared link carries the youngest age.' : 'This browser is not keeping data, so your party works for this visit only. Ages never go into a link you share.'}
      </p>
    </div>
  );
}
