'use client';

import { useId, useMemo, useState } from 'react';
import type { PlanRegion, PlanRegionGroup, PlanRegions } from '@travel/core/schema/api/plan.ts';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Icon } from '@/components/ui/Icon';
import { Select } from '@/components/ui/Select';
import { PLAN_BUILDER_UI } from '@/lib/config/product';
import { modeOf } from '@/lib/plan/flow';
import { plural } from '@/lib/plan/format';
import { useCountries, useRegions, useStarts, type Loaded } from '@/lib/plan/useReference';
import { AskUs } from '../AskUs';
import { ReachControl } from '../ReachControl';
import type { StageProps } from './types';

function RegionRow({ r, on, onToggle }: { r: PlanRegion; on: boolean; onToggle: (on: boolean) => void }) {
  const thin = r.count > 0 && r.count < PLAN_BUILDER_UI.thinCount;
  return (
    <li className="region-row">
      <Checkbox checked={on} disabled={r.count === 0} onChange={(e) => onToggle(e.target.checked)}>
        <span className="region-name">{r.name}</span>
        {thin ? <span className="region-meta">Thin: {plural(r.count, 'place')}</span> : r.count === 0 ? <span className="region-meta">Not researched yet</span> : null}
      </Checkbox>
      <span className="region-count num">{r.count}</span>
    </li>
  );
}

function GroupRows({ g, chosen, onSet, open, onOpen }: { g: PlanRegionGroup; chosen: readonly string[]; onSet: (ids: string[], on: boolean) => void; open: boolean; onOpen: (open: boolean) => void }) {
  const ids = g.regions.map((r) => r.id);
  const picked = ids.filter((i) => chosen.includes(i));
  const subId = useId();
  const thin = g.offered && g.count > 0 && g.count < PLAN_BUILDER_UI.thinCount;
  return (
    <li className="region-group">
      <div className="region-row region-row-group">
        <Checkbox checked={picked.length === ids.length && ids.length > 0} indeterminate={picked.length > 0 && picked.length < ids.length} disabled={!g.offered} onChange={(e) => onSet(ids, e.target.checked)}>
          <span className="region-name">{g.name}</span>
          {!g.offered ? <span className="region-meta">Not researched enough yet. Ask us to research it.</span> : thin ? <span className="region-meta">Thin: {plural(g.count, 'place')}</span> : picked.length ? <span className="region-meta">{picked.length} of {ids.length} chosen</span> : null}
        </Checkbox>
        <span className="region-count num">{g.count}</span>
        {g.offered ? (
          <button type="button" className="region-toggle" aria-expanded={open} aria-controls={subId} aria-label={`${g.name}: ${open ? 'hide' : 'show'} ${plural(g.regions.length, 'area')}`} onClick={() => onOpen(!open)}>
            <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} />
          </button>
        ) : null}
      </div>
      {g.offered ? (
        <ul id={subId} className="region-sub" role="list" hidden={!open}>
          {g.regions.map((r) => (
            <RegionRow key={r.id} r={r} on={chosen.includes(r.id)} onToggle={(on) => onSet([r.id], on)} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Groups are folded to their header (P2); the ones holding a choice, and the offered group with the most places, start open (FLOW stage 2). */
function RegionChooser({ data, chosen, onSet }: { data: PlanRegions; chosen: readonly string[]; onSet: (ids: string[], on: boolean) => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const biggest = data.groups.filter((g) => g.offered).sort((a, b) => b.count - a.count)[0]?.id;
    return Object.fromEntries(data.groups.map((g) => [g.id, g.id === biggest || g.regions.some((r) => chosen.includes(r.id))]));
  });
  return (
    <ul className="region-list" role="list">
      {data.groups.map((g) => (
        <GroupRows key={g.id} g={g} chosen={chosen} onSet={onSet} open={open[g.id] ?? false} onOpen={(o) => setOpen((x) => ({ ...x, [g.id]: o }))} />
      ))}
      {data.ungrouped.map((r) => (
        <RegionRow key={r.id} r={r} on={chosen.includes(r.id)} onToggle={(on) => onSet([r.id], on)} />
      ))}
    </ul>
  );
}

const placesIn = (data: PlanRegions, chosen: readonly string[]): number => {
  const all = [...data.groups.flatMap((g) => g.regions), ...data.ungrouped];
  return all.filter((r) => chosen.includes(r.id)).reduce((n, r) => n + r.count, 0);
};

/** Stage 2 (FLOW 4): trip mode asks a country and its areas; near mode asks the reach, with the areas inside it as optional narrowing. */
export function WhereStage({ flow, dispatch, party, now }: StageProps) {
  const mode = modeOf(flow);
  const [countries, retryCountries] = useCountries();
  const [starts] = useStarts();
  // near mode: the areas of the country the start is in
  const startCc = useMemo(() => {
    if (mode !== 'near' || flow.start?.kind !== 'hub' || starts.status !== 'ok') return null;
    const id = flow.start.id;
    return starts.data.hubs.find((h) => h.id === id)?.cc ?? null;
  }, [mode, flow.start, starts]);
  const cc = mode === 'trip' ? flow.cc : startCc;
  const [regions, retryRegions] = useRegions(cc);

  const onSet = (ids: string[], on: boolean) => {
    const next = on ? [...flow.regions, ...ids] : flow.regions.filter((r) => !ids.includes(r));
    dispatch({ t: 'regions', ids: next, now: now() });
  };

  const chosenPlaces = regions.status === 'ok' ? placesIn(regions.data, flow.regions) : 0;
  const body = (r: Loaded<PlanRegions>) =>
    r.status === 'loading' ? (
      <p className="plan-help">Loading areas…</p>
    ) : r.status === 'error' ? (
      <Banner kind="urgent" action={<Button size="sm" onClick={retryRegions}>Try again</Button>}>
        We could not load the areas.
      </Banner>
    ) : r.status === 'unavailable' ? (
      <Banner kind="notice">Areas are not available on this site yet.</Banner>
    ) : (
      <RegionChooser data={r.data} chosen={flow.regions} onSet={onSet} />
    );

  if (mode === 'near') {
    return (
      <div className="plan-two plan-two-even">
        <div className="plan-col">
          <ReachControl flow={flow} party={party} onChange={(min) => dispatch({ t: 'patch', patch: { driveLimitMin: min }, now: now() })} />
          {cc ? (
            <div className="plan-field">
              <p className="plan-label">Narrow to (optional)</p>
              {body(regions)}
            </div>
          ) : null}
        </div>
        <aside className="plan-aside" aria-label="Where">
          <h2 className="plan-h3">Inside your reach</h2>
          <p className="plan-help">We list places we have researched within the drive you choose. Choosing areas only narrows that. Leave them all unticked to see everything in reach.</p>
          <p className="plan-count">{flow.regions.length ? `${plural(flow.regions.length, 'area')} chosen` : 'Everything in reach'}</p>
          <AskUs label="Ask us to research another area" />
        </aside>
      </div>
    );
  }

  return (
    <div className="plan-two plan-two-even">
      <div className="plan-col">
        <div className="plan-field">
          <label className="plan-label" htmlFor="plan-country">
            Country
          </label>
          {countries.status === 'ok' ? (
            <Select id="plan-country" value={flow.cc ?? ''} onChange={(e) => {
              const c = countries.data.find((x) => x.cc === e.target.value);
              if (c) dispatch({ t: 'country', cc: c.cc, name: c.name, now: now() });
            }}>
              <option value="" disabled>
                Choose a country
              </option>
              {countries.data.map((c) => (
                <option key={c.cc} value={c.cc}>
                  {c.name} ({c.places})
                </option>
              ))}
            </Select>
          ) : countries.status === 'error' ? (
            <Banner kind="urgent" action={<Button size="sm" onClick={retryCountries}>Try again</Button>}>
              We could not load the countries.
            </Banner>
          ) : (
            <p className="plan-help">Loading countries…</p>
          )}
          <p className="plan-help">Only countries we have researched are listed. The number is how many places.</p>
        </div>
        {flow.cc ? (
          <div className="plan-field">
            <p className="plan-label">{flow.ccName ?? flow.cc}: pick one or more areas</p>
            {body(regions)}
          </div>
        ) : null}
      </div>
      <aside className="plan-aside" aria-label="Where">
        <h2 className="plan-h3">{flow.ccName ?? 'Your areas'}</h2>
        {regions.status === 'ok' ? (
          <>
            <p className="plan-count" aria-live="polite">
              {flow.regions.length ? `${plural(flow.regions.length, 'area')} · ${plural(chosenPlaces, 'place')}` : 'Nothing chosen yet'}
            </p>
            <p className="plan-help">{plural(regions.data.total, 'researched place')} in {regions.data.name}. Areas with few places are marked thin. We never add a place we have not researched.</p>
          </>
        ) : (
          <p className="plan-help">Choose a country to see its areas.</p>
        )}
        <AskUs label="Ask us to research another area" />
      </aside>
    </div>
  );
}
