'use client';

import { useState } from 'react';
import type { DayTimeline, Profile } from '@travel/core/schedule/types.ts';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Segmented } from '@/components/ui/Segmented';
import { Switch } from '@/components/ui/Switch';
import type { TimelineModel } from './model';
import type { TimelineApi } from './useTimeline';

const PACE_NOTE = {
  relaxed: 'Relaxed: a later start, shorter outings, a break in the afternoon.',
  standard: 'Standard: one main outing a day, back at base before dinner.',
  full: 'Full: the longest option every day, an early start, dinner late.',
} as const;

/** "Whole family on 13 days, Easy day on 2": what the profile chose, counted. */
function versionCounts(model: TimelineModel, timelines: DayTimeline[]): string[] {
  const label = new Map<string, string>();
  for (const d of model.days) for (const v of d.variants) if (!label.has(v.key)) label.set(v.key, v.label);
  const n = new Map<string, number>();
  for (const t of timelines) n.set(t.variant.key, (n.get(t.variant.key) ?? 0) + 1);
  return [...n].filter(() => model.hasVariants).map(([k, c]) => `${label.get(k) ?? k} on ${c} ${c === 1 ? 'day' : 'days'}`);
}

/** The line under the controls. At the plan's own settings it says so; after a change it names the choice. */
export function summaryLine(model: TimelineModel, api: TimelineApi): string {
  const p = api.state.profile;
  const counts = versionCounts(model, api.timelines);
  const own = !api.changed;
  const who = p.party === 'adults' ? 'adults' : `a family with a youngest of ${p.youngest}`;
  const head = own ? 'Showing the plan as written.' : `Showing the plan for ${who}, ${p.pace} pace.`;
  const days = api.changedDays.size ? ` ${api.changedDays.size} ${api.changedDays.size === 1 ? 'day' : 'days'} changed.` : '';
  return `${head} ${counts.length ? `${counts.join(' · ')}.` : ''}${days} Written for ${model.writtenFor}.`.replace(/\s{2,}/g, ' ');
}

/** "Plan it for": who is going, the youngest's age, the pace; More: adults, longest walk, split (spec 3.1, design 3.2). */
export function ProfileBar({ model, api }: { model: TimelineModel; api: TimelineApi }) {
  const p = api.state.profile;
  const [more, setMore] = useState(false);
  const [edit, setEdit] = useState(false);
  const age = p.youngest ?? model.defaultProfile.youngest ?? 6;
  const set = (patch: Partial<Profile>) => api.setProfile(patch);
  const line = summaryLine(model, api);
  return (
    <section className="tl-profile" aria-labelledby="plan-for-h" id="plan-for" data-print="hide">
      <div className="tl-profile-head">
        <h2 id="plan-for-h" className="tl-profile-h">Plan it for</h2>
        <p className="tl-profile-sub">One choice for the whole trip. Any day can still be changed on its own.</p>
        <Button size="sm" className="tl-profile-edit" aria-expanded={edit} aria-controls="plan-for-controls" onClick={() => setEdit((v) => !v)}>
          <Icon name="pencil" size={14} /> {edit ? 'Done' : 'Edit'}
        </Button>
      </div>
      <p className="tl-profile-line" data-testid="profile-line" aria-live="polite">
        {line}
        {api.changed ? (
          <>
            {' '}
            <button type="button" className="tl-reset" onClick={api.reset}>Reset</button>
          </>
        ) : null}
      </p>
      <div id="plan-for-controls" className="tl-profile-controls" data-open={edit || undefined}>
        <div className="tl-field">
          <span className="tl-label" id="who-l">Who is going</span>
          <Segmented
            label="Who is going"
            value={p.party}
            onChange={(v) => set({ party: v, youngest: v === 'family' ? age : null })}
            segments={[
              { value: 'adults', label: 'Adults only' },
              { value: 'family', label: 'Family' },
            ]}
          />
          <p className="tl-hint">{p.party === 'adults' ? "Adults' days: the longer hikes, early starts." : 'Family days: shorter walks, a rest after lunch.'}</p>
        </div>
        <div className="tl-field" data-disabled={p.party === 'adults' || undefined}>
          <span className="tl-label" id="age-l">Youngest</span>
          <div className="tl-stepper" role="group" aria-labelledby="age-l">
            <button type="button" className="tl-step" aria-label="Younger" disabled={p.party === 'adults' || age <= 0} onClick={() => set({ party: 'family', youngest: Math.max(0, age - 1) })}>
              <Icon name="minus" size={15} />
            </button>
            <span className="tl-step-v num" aria-live="polite">{p.party === 'adults' ? 'no children' : `age ${age}`}</span>
            <button type="button" className="tl-step" aria-label="Older" disabled={p.party === 'adults' || age >= 17} onClick={() => set({ party: 'family', youngest: Math.min(17, age + 1) })}>
              <Icon name="plus" size={15} />
            </button>
          </div>
        </div>
        <div className="tl-field">
          <span className="tl-label">Pace</span>
          <Segmented
            label="Pace"
            value={p.pace}
            onChange={(v) => set({ pace: v })}
            segments={[
              { value: 'relaxed', label: 'Relaxed' },
              { value: 'standard', label: 'Standard' },
              { value: 'full', label: 'Full' },
            ]}
          />
          <p className="tl-hint">{PACE_NOTE[p.pace]}</p>
        </div>
        <div className="tl-more-wrap">
          <button type="button" className="tl-more" aria-expanded={more} aria-controls="plan-for-more" onClick={() => setMore((v) => !v)}>
            <Icon name="chevronDown" size={14} /> <span>More</span>
          </button>
        </div>
        {more ? (
          <div id="plan-for-more" className="tl-profile-more">
            <div className="tl-field">
              <span className="tl-label">Adults</span>
              <Segmented
                label="Adults"
                size="s"
                value={p.adults >= 2 ? '2' : '1'}
                onChange={(v) => set({ adults: v === '1' ? 1 : 2 })}
                segments={[
                  { value: '1', label: '1' },
                  { value: '2', label: '2 or more' },
                ]}
              />
            </div>
            <div className="tl-field">
              <span className="tl-label">Longest walk</span>
              <Segmented
                label="Longest walk"
                size="s"
                value={p.walkKm === null ? 'any' : String(p.walkKm)}
                onChange={(v) => set({ walkKm: v === 'any' ? null : Number(v) })}
                segments={[
                  { value: 'any', label: 'Any' },
                  { value: '5', label: '5 km' },
                  { value: '8', label: '8 km' },
                  { value: '12', label: '12 km' },
                ]}
              />
            </div>
            {model.hasSplit ? (
              <div className="tl-field">
                <Switch checked={p.split} onCheckedChange={(v) => set({ split: v })} note={p.adults < 2 ? 'Needs two adults' : undefined} disabled={p.adults < 2}>
                  Show the split days as two lanes
                </Switch>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {api.droppedAdds > 0 ? (
        <p className="tl-profile-note" role="status">
          {api.droppedAdds} added {api.droppedAdds === 1 ? 'place is' : 'places are'} no longer available.
        </p>
      ) : null}
    </section>
  );
}
