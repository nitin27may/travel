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
import { AskUs } from '../AskUs';
import { CandidateRow } from '../CandidateRow';
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
            <CandidateRow key={r.ref} row={r} picked={false} youngest={youngest} from={short} onToggle={(row) => dispatch({ t: 'pick', pick: toPick(row), visitMin: row.visitMin, now: now() })} full={flow.picks.length >= PLAN_BUILDER_UI.maxPicks} />
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
  const hasFilters = f.kinds.length > 0 || f.stroller || f.month !== null || (youngest !== null && !f.kids);
  const rows = state.status === 'ok' || state.status === 'loading' || state.status === 'error' ? state.rows : [];
  const towns = rows.filter((r) => r.kind === 'town');
  const places = rows.filter((r) => r.kind !== 'town');
  const latest = flow.picks.at(-1) ?? null;
  const latestRow = latest ? rows.find((r) => r.ref === latest.ref) : null;
  const full = flow.picks.length >= PLAN_BUILDER_UI.maxPicks;
  const toggle = (r: PlanCandidateRow) =>
    flow.picks.some((p) => p.ref === r.ref) ? dispatch({ t: 'unpick', ref: r.ref, now: now() }) : dispatch({ t: 'pick', pick: toPick(r), visitMin: r.visitMin, now: now() });
  const month = f.month ?? flow.month;
  const countLine =
    state.status === 'ok'
      ? [plural(state.total, 'place'), month ? MONTH_NAMES[month - 1] : null, youngest !== null && f.kids ? `fits age ${youngest}` : null].filter(Boolean).join(' · ')
      : state.status === 'loading'
        ? 'Finding places…'
        : '';

  const strip = latest ? <NearStrip key={latest.ref} flow={flow} dispatch={dispatch} party={party} now={now} anchor={{ slug: latest.slug, name: latest.name }} youngest={youngest} /> : null;
  const renderRows = (list: PlanCandidateRow[]) =>
    list.map((r) => (
      <Fragment key={r.ref}>
        <CandidateRow row={r} picked={flow.picks.some((p) => p.ref === r.ref)} onToggle={toggle} youngest={youngest} full={full} />
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
            <button type="button" className="link-btn" onClick={() => dispatch({ t: 'filters', patch: { kinds: [], stroller: false, month: null, kids: true }, now: now() })}>
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
              {hasFilters ? 'Clear a filter, or widen where you look.' : mode === 'near' ? `Nothing we have researched is within ${reachText(flow.driveLimitMin)} yet. Try a longer drive.` : 'We have not researched places in these areas yet.'}
            </p>
            <AskUs />
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
          <p className="plan-help">{plural(state.removed.not_for_party, 'place')} left out because they do not fit age {youngest}. Turn off “Fits age {youngest}” to see them.</p>
        ) : null}
        {state.status === 'ok' && state.removed.closed > 0 ? <p className="plan-help">{plural(state.removed.closed, 'place')} left out because they are closed in {month ? MONTH_NAMES[month - 1] : 'that month'}.</p> : null}
      </div>

      <aside className="plan-tray-col" aria-label="Your picks">
        <Tray flow={flow} dispatch={dispatch} now={now} />
      </aside>

      <SideSheet open={trayOpen} onOpenChange={onTray} title={`Your picks (${flow.picks.length})`} footer={<Button variant="primary" onClick={() => onTray(false)}>Done</Button>}>
        <Tray flow={flow} dispatch={dispatch} now={now} bare />
      </SideSheet>
      <SideSheet open={reachOpen} onOpenChange={setReachOpen} title="How far to drive" footer={<Button variant="primary" onClick={() => setReachOpen(false)}>Done</Button>}>
        <ReachControl flow={flow} party={party} onChange={(min) => dispatch({ t: 'patch', patch: { driveLimitMin: min }, now: now() })} />
      </SideSheet>
    </div>
  );
}

export type { FlowState };
