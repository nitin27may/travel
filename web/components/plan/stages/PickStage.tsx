'use client';

import { Fragment, useMemo, useState } from 'react';
import type { PlanCandidateRow } from '@travel/core/schema/api/plan.ts';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { FilterPill } from '@/components/ui/FilterPill';
import { Icon } from '@/components/ui/Icon';
import { SideSheet } from '@/components/ui/SideSheet';
import { PLAN_BUILDER_UI } from '@/lib/config/product';
import { youngestOf } from '@/lib/plan/draft';
import { modeOf, type FlowState } from '@/lib/plan/flow';
import { MONTH_NAMES, plural, reachText, APPROX } from '@/lib/plan/format';
import { candidateQuery } from '@/lib/plan/query';
import { useCandidates } from '@/lib/plan/useCandidates';
import { useRegions } from '@/lib/plan/useReference';
import { useStay } from '@/lib/plan/useStay';
import { AskUs } from '../AskUs';
import { CandidateRow } from '../CandidateRow';
import { LongerDrive } from '../LongerDrive';
import { ReachControl } from '../ReachControl';
import { Tray } from '../Tray';
import type { StageProps } from './types';

const KIND_OPTIONS = [
  { value: 'trail', label: 'Trails' },
  { value: 'lake', label: 'Lakes' },
  { value: 'viewpoint', label: 'Viewpoints' },
  { value: 'waterfall', label: 'Waterfalls' },
  { value: 'sight', label: 'Sights' },
  { value: 'activity', label: 'Activities' },
  { value: 'lift', label: 'Lifts' },
  { value: 'area', label: 'Parks and areas' },
];
const MONTH_OPTIONS = MONTH_NAMES.map((m, i) => ({ value: String(i + 1), label: m }));
const MORE_OPTIONS = [{ value: 'stroller', label: 'Stroller friendly' }];

const toPick = (r: PlanCandidateRow) => ({ ref: r.ref, slug: r.slug, name: r.name, must: false });
const pickAction = (r: PlanCandidateRow, now: string) => ({ t: 'pick' as const, pick: toPick(r), visitMin: r.visitMin, now, area: r.region_name || null, town: r.kind === 'town', driveMin: r.driveMin });

/** "Not for your party (3)" and "Closed in October (2)" (FLOW stage 3, scenario S9): the rows the list left out, behind a toggle, each with its reason. They cannot be picked. */
function RemovedList({ kind, count, label, flow, party, youngest }: { kind: 'not_for_party' | 'closed'; count: number; label: string; flow: FlowState; party: StageProps['party']; youngest: number | null }) {
  const [open, setOpen] = useState(false);
  const q = open ? candidateQuery(flow, party, { list: kind }) : null;
  const { state, retry } = useCandidates(q);
  const id = `plan-removed-${kind}`;
  return (
    <section className="plan-removed" data-testid={`removed-${kind}`}>
      <button type="button" className="plan-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <span>
          {label} <span className="num">({count})</span>
        </span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} />
      </button>
      <div id={id} hidden={!open}>
        {open && state.status === 'loading' ? <p className="plan-help">Finding them…</p> : null}
        {open && state.status === 'error' ? (
          <Banner kind="urgent" action={<Button size="sm" onClick={retry}>Try again</Button>}>
            We could not load them.
          </Banner>
        ) : null}
        {open && state.status === 'ok' ? (
          <ul className="cand-list" role="list">
            {state.rows.map((r) => (
              <CandidateRow key={r.ref} row={r} picked={false} onToggle={() => undefined} youngest={youngest} why={r.why ?? (kind === 'closed' ? 'Closed in this month' : 'Not for your party')} />
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

/** "3 places near Lago di Braies · Show" (FLOW TF6): one collapsed strip under the latest pick, six two-line rows when open. */
function NearStrip({ flow, party, dispatch, now, anchor, youngest }: StageProps & { anchor: { slug: string; name: string }; youngest: number | null }) {
  const [open, setOpen] = useState(false);
  const q = candidateQuery(flow, party, { near: anchor.slug, limit: PLAN_BUILDER_UI.nearStrip, strip: true });
  const { state } = useCandidates(q);
  const rows = state.status === 'ok' ? state.rows.filter((r) => r.slug !== anchor.slug && !flow.picks.some((p) => p.ref === r.ref)) : [];
  if (state.status !== 'ok' || !rows.length) return null;
  const short = anchor.name.length > 28 ? `${anchor.name.slice(0, 27)}…` : anchor.name;
  return (
    <li className="near-strip" aria-label={`Near ${anchor.name}`}>
      <div className="near-head">
        <p className="near-title" aria-live="polite">
          {plural(rows.length, 'place')} near {anchor.name}
        </p>
        <button type="button" className="link-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open ? (
        <ul className="near-rows" role="list">
          {rows.map((r) => (
            <CandidateRow key={r.ref} row={r} picked={false} youngest={youngest} from={short} onToggle={(row) => dispatch({ ...pickAction(row, now()), driveMin: undefined })} full={flow.picks.length >= PLAN_BUILDER_UI.maxPicks} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Stage 3 (FLOW 4): the discover list with its pills, the picks in the tray and one near strip. Parks are pinned as an area, never as a stop. */
export function PickStage({ flow, dispatch, party, now, onTray, trayOpen }: StageProps & { onTray: (open: boolean) => void; trayOpen: boolean }) {
  const mode = modeOf(flow);
  const [reachOpen, setReachOpen] = useState(false);
  const query = useMemo(() => candidateQuery(flow, party), [flow, party]);
  const { state, more, retry } = useCandidates(query);
  const youngest = youngestOf(party);
  const f = flow.filters;
  const [areaList] = useRegions(mode === 'trip' && flow.regions.length > 1 ? flow.cc : null);
  const areaOptions = useMemo(() => {
    if (areaList.status !== 'ok') return [];
    const all = [...areaList.data.groups.flatMap((g) => g.regions), ...areaList.data.ungrouped];
    return flow.regions.flatMap((id) => {
      const r = all.find((x) => x.id === id);
      return r ? [{ value: r.id, label: r.count < PLAN_BUILDER_UI.thinCount ? `${r.name} · Thin: ${r.count}` : `${r.name} · ${r.count}` }] : [];
    });
  }, [areaList, flow.regions]);
  const areas = f.areas ?? [];
  const hasFilters = f.kinds.length > 0 || f.stroller || f.month !== null || areas.length > 0 || (youngest !== null && !f.kids);
  const rows = state.status === 'ok' || state.status === 'loading' || state.status === 'error' ? state.rows : [];
  const towns = rows.filter((r) => r.kind === 'town');
  const places = rows.filter((r) => r.kind !== 'town');
  const latest = flow.picks.at(-1) ?? null;
  const latestRow = latest ? rows.find((r) => r.ref === latest.ref) : null;
  const full = flow.picks.length >= PLAN_BUILDER_UI.maxPicks;
  const toggle = (r: PlanCandidateRow) =>
    flow.picks.some((p) => p.ref === r.ref) ? dispatch({ t: 'unpick', ref: r.ref, now: now() }) : dispatch(pickAction(r, now()));
  const month = f.month ?? flow.month;
  const countLine =
    state.status === 'ok'
      ? [plural(state.total, 'place'), month ? MONTH_NAMES[month - 1] : null, youngest !== null && f.kids ? `fits age ${youngest}` : null].filter(Boolean).join(' · ')
      : state.status === 'loading'
        ? 'Finding places…'
        : '';

  const strip = latest ? <NearStrip key={latest.ref} flow={flow} dispatch={dispatch} party={party} now={now} anchor={{ slug: latest.slug, name: latest.name }} youngest={youngest} /> : null;
  const stayHere = useStay(flow, dispatch, now);
  // the drive on a row is from the start (near mode) or from the centre of the chosen areas (trip mode, where no start is asked): say which (RB-026)
  const driveFrom = mode === 'near' ? (flow.startName ?? 'home') : 'the centre of your areas';
  const renderRows = (list: PlanCandidateRow[]) =>
    list.map((r) => (
      <Fragment key={r.ref}>
        <CandidateRow
          row={r}
          picked={flow.picks.some((p) => p.ref === r.ref)}
          onToggle={toggle}
          youngest={youngest}
          full={full}
          from={driveFrom}
          stay={r.kind === 'town' && flow.nights >= 1 && flow.picks.some((p) => p.ref === r.ref) ? { on: stayHere.isOn(r.ref), busy: stayHere.busy === r.ref, failed: stayHere.failed === r.ref, onToggle: () => void stayHere.toggle(r) } : null}
        />
        {latestRow && latestRow.ref === r.ref ? strip : null}
      </Fragment>
    ));

  return (
    <div className="plan-pick">
      <div className="plan-pick-main">
        <div className="plan-pills" role="group" aria-label="Filters">
          {mode === 'near' ? (
            <button type="button" className="plan-pill-btn" onClick={() => setReachOpen(true)} aria-haspopup="dialog">
              Within {reachText(flow.driveLimitMin)} {APPROX}
              <Icon name="chevronDown" size={14} />
            </button>
          ) : null}
          {youngest !== null ? (
            <button type="button" className="plan-pill-btn" aria-pressed={f.kids} onClick={() => dispatch({ t: 'filters', patch: { kids: !f.kids }, now: now() })}>
              Fits age {youngest}
            </button>
          ) : null}
          {areaOptions.length > 1 ? <FilterPill label="Area" options={areaOptions} selected={areas} onChange={(v) => dispatch({ t: 'filters', patch: { areas: v }, now: now() })} mode="multi" searchAbove={20} /> : null}
          <FilterPill label="Looking for" options={KIND_OPTIONS} selected={f.kinds} onChange={(v) => dispatch({ t: 'filters', patch: { kinds: v }, now: now() })} mode="multi" searchAbove={20} />
          <FilterPill
            label="Month"
            options={MONTH_OPTIONS}
            selected={f.month ? [String(f.month)] : []}
            onChange={(v) => dispatch({ t: 'filters', patch: { month: v[0] ? Number(v[0]) : null }, now: now() })}
            mode="single"
            searchAbove={20}
          />
          <FilterPill label="Filters" options={MORE_OPTIONS} selected={f.stroller ? ['stroller'] : []} onChange={(v) => dispatch({ t: 'filters', patch: { stroller: v.includes('stroller') }, now: now() })} mode="multi" searchAbove={20} />
        </div>

        <div className="plan-countline">
          <p aria-live="polite" className="plan-count">
            {countLine}
          </p>
          {hasFilters ? (
            <button type="button" className="link-btn" onClick={() => dispatch({ t: 'filters', patch: { kinds: [], stroller: false, month: null, kids: true, areas: [] }, now: now() })}>
              Clear
            </button>
          ) : null}
        </div>

        {state.status === 'unavailable' ? <Banner kind="notice">The place list is not available on this site yet.</Banner> : null}
        {state.status === 'error' ? (
          <Banner kind="urgent" action={<Button size="sm" onClick={retry}>Try again</Button>}>
            We could not load the places.
          </Banner>
        ) : null}
        {state.status === 'ok' && state.total === 0 ? (
          <div className="plan-empty" role="status">
            <p className="plan-unavailable-title">No places match{hasFilters ? ' these filters' : ''}</p>
            <p className="plan-help">
              {hasFilters ? 'Clear a filter, or widen where you look.' : mode === 'near' ? `Nothing we have researched is within ${reachText(flow.driveLimitMin)} yet.` : 'We have not researched places in these areas yet.'}
            </p>
            {!hasFilters && mode === 'near' ? <LongerDrive flow={flow} party={party} below={1} onChange={(min) => dispatch({ t: 'patch', patch: { driveLimitMin: min }, now: now() })} /> : <AskUs />}
          </div>
        ) : null}

        {towns.length ? (
          <section aria-labelledby="plan-towns-h" className="plan-sec">
            <h2 id="plan-towns-h" className="plan-cap">
              Towns and cities
            </h2>
            <ul className="cand-list" role="list">
              {renderRows(towns)}
            </ul>
          </section>
        ) : null}
        {places.length ? (
          <section aria-labelledby="plan-places-h" className="plan-sec">
            <h2 id="plan-places-h" className="plan-cap">
              Places
            </h2>
            <ul className="cand-list" role="list">
              {renderRows(places)}
              {latest && !latestRow ? strip : null}
            </ul>
          </section>
        ) : null}

        {state.status === 'ok' && state.more ? (
          <div className="plan-morerow">
            <Button onClick={more} loading={state.loadingMore}>
              Show more places
            </Button>
          </div>
        ) : null}
        {state.status === 'ok' && state.removed.not_for_party > 0 && youngest !== null && f.kids ? (
          <RemovedList kind="not_for_party" count={state.removed.not_for_party} label="Not for your party" flow={flow} party={party} youngest={youngest} />
        ) : null}
        {state.status === 'ok' && state.removed.closed > 0 ? (
          <RemovedList kind="closed" count={state.removed.closed} label={`Closed in ${month ? MONTH_NAMES[month - 1] : 'that month'}`} flow={flow} party={party} youngest={youngest} />
        ) : null}
      </div>

      <aside className="plan-tray-col" aria-label="Your picks">
        <Tray flow={flow} dispatch={dispatch} now={now} stay={stayHere} />
      </aside>

      <SideSheet open={trayOpen} onOpenChange={onTray} title={`Your picks (${flow.picks.length})`} footer={<Button variant="primary" onClick={() => onTray(false)}>Done</Button>}>
        <Tray flow={flow} dispatch={dispatch} now={now} bare stay={stayHere} />
      </SideSheet>
      <SideSheet open={reachOpen} onOpenChange={setReachOpen} title="How far to drive" footer={<Button variant="primary" onClick={() => setReachOpen(false)}>Done</Button>}>
        <ReachControl flow={flow} party={party} onChange={(min) => dispatch({ t: 'patch', patch: { driveLimitMin: min }, now: now() })} />
      </SideSheet>
    </div>
  );
}

export type { FlowState };
