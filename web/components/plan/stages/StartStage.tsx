'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlanOrigin } from '@travel/core/schema/plan-draft.ts';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Icon } from '@/components/ui/Icon';
import { SideSheet } from '@/components/ui/SideSheet';
import { modeOf } from '@/lib/plan/flow';
import { MONTH_NAMES, plural } from '@/lib/plan/format';
import { kindDef, isShortKind } from '@/lib/plan/kinds';
import { readLastFrom, writeLastFrom } from '@/lib/plan/lastFrom';
import { candidateQuery } from '@/lib/plan/query';
import { useCount } from '@/lib/plan/useCandidates';
import type { PartyState } from '@/lib/plan/useParty';
import { useStarts } from '@/lib/plan/useReference';
import { monthOfDate, nextWeekend, whenKind, whenWords } from '@/lib/plan/when';
import { PartyRow } from '../PartyRow';
import { AirportPicker } from '../AirportPicker';
import { CountWords, ReachControl } from '../ReachControl';
import { LongerDrive } from '../LongerDrive';
import { PLAN_BUILDER_UI } from '@/lib/config/product';
import type { StageProps } from './types';

const SEARCH_FROM = 12;
const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const hubValue = (o: PlanOrigin | null): string => (o?.kind === 'hub' ? `hub:${o.id}` : o?.kind === 'airport' ? `iata:${o.iata}` : '');

/** Stage 1 (FLOW 4): from where, who, when. Each answer is pre-filled where it can be and Next works without the optional ones. */
export function StartStage({ flow, dispatch, party, partyState, now }: StageProps & { partyState: PartyState }) {
  const [starts, retry] = useStarts();
  const mode = modeOf(flow);
  const kind = flow.kind ? kindDef(flow.kind) : null;
  const [reachOpen, setReachOpen] = useState(false);
  const today = useMemo(() => new Date(), []);
  const when = whenKind(flow, today);
  const count = useCount(mode === 'near' ? candidateQuery(flow, party, { strip: true, pageSize: 1 }) : null);

  // Next waits on the reach holding a place (RB-009); stale counts are cleared while the next one loads
  const total = count.status === 'ok' ? count.total : count.status === 'loading' || count.status === 'idle' ? undefined : null;
  useEffect(() => {
    if (mode !== 'near' || flow.reachTotal === total || (total === undefined && flow.reachTotal === undefined)) return;
    dispatch({ t: 'patch', patch: { reachTotal: total ?? null }, now: now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the count
  }, [mode, total]);

  const allHubs = starts.status === 'ok' ? starts.data.hubs : [];
  const allAirports = starts.status === 'ok' ? starts.data.airports : [];
  // town search (TB-W2): the lists are public and small, so the filter runs here over what the page already holds (P9: no new read)
  const [find, setFind] = useState('');
  const want = norm(find.trim());
  const keepHub = hubValue(mode === 'near' ? flow.start : flow.origin);
  const hubs = want ? allHubs.filter((h) => norm(`${h.name} ${h.cc ?? ''}`).includes(want) || `hub:${h.id}` === keepHub) : allHubs;
  const airports = want ? allAirports.filter((a) => norm(`${a.name} ${a.iata} ${a.cc ?? ''}`).includes(want) || `iata:${a.iata}` === keepHub) : allAirports;
  const searchable = (mode === 'near' ? allHubs.length : allHubs.length + allAirports.length) > SEARCH_FROM;
  const matches = mode === 'near' ? hubs.length : hubs.length + airports.length;

  const pickHub = (value: string) => {
    if (!value) {
      dispatch({ t: 'patch', patch: { start: null, startName: null }, now: now() });
      return;
    }
    const h = hubs.find((x) => `hub:${x.id}` === value);
    if (h) dispatch({ t: 'patch', patch: { start: { kind: 'hub', id: h.id }, startName: h.name }, now: now() });
  };
  const pickAirport = (origin: PlanOrigin, name: string) => {
    dispatch({ t: 'patch', patch: { origin, originName: name }, now: now() });
    writeLastFrom(origin, name);
  };
  // FLOW TF4: pre-filled with the last place you flew from on this device, once, when the list has it (RB-019). Clearing it stays cleared.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || mode !== 'trip' || starts.status !== 'ok' || flow.origin !== null) return;
    prefilled.current = true;
    const last = readLastFrom();
    if (!last) return;
    const known = last.origin.kind === 'airport' ? starts.data.airports.some((a) => a.iata === (last.origin as { iata: string }).iata) : last.origin.kind === 'hub' ? starts.data.hubs.some((h) => h.id === (last.origin as { id: string }).id) : false;
    if (known) dispatch({ t: 'patch', patch: { origin: last.origin, originName: last.name }, now: now() });
  }, [mode, starts, flow.origin, dispatch, now]);
  const setWhen = (k: 'weekend' | 'month' | 'dates' | 'unsure') => {
    if (k === 'weekend') {
      const d = nextWeekend(new Date());
      dispatch({ t: 'patch', patch: { date: d, month: monthOfDate(d) }, now: now() });
    } else if (k === 'unsure') dispatch({ t: 'patch', patch: { date: null, month: null }, now: now() });
    else if (k === 'month') dispatch({ t: 'patch', patch: { date: null, month: flow.month ?? new Date().getMonth() + 1 }, now: now() });
    else dispatch({ t: 'patch', patch: { date: flow.date ?? nextWeekend(new Date()), month: monthOfDate(flow.date ?? nextWeekend(new Date())) }, now: now() });
  };

  return (
    <div className="plan-start">
      <div className="plan-col">
        <div className="plan-field">
          <p className="plan-label" id="plan-from-l">
            {mode === 'near' ? 'Starting from' : 'Flying from'}
          </p>
          {starts.status === 'loading' ? (
            <p className="plan-help">Loading starting points…</p>
          ) : starts.status === 'error' ? (
            <Banner kind="urgent" action={<Button size="sm" onClick={retry}>Try again</Button>}>
              We could not load the starting points.
            </Banner>
          ) : mode === 'near' ? (
            allHubs.length ? (
              <>
              {searchable ? <SearchInput value={find} onChange={setFind} label="Find a starting point" placeholder="Find a town or city" status={want ? plural(matches, 'match', 'matches') : ''} /> : null}
              <Select aria-labelledby="plan-from-l" value={hubValue(flow.start)} onChange={(e) => pickHub(e.target.value)}>
                <option value="">Choose a starting point</option>
                {hubs.map((h) => (
                  <option key={h.id} value={`hub:${h.id}`}>
                    {h.name}
                    {h.cc ? `, ${h.cc}` : ''}
                  </option>
                ))}
              </Select>
              {want && !matches ? <p className="plan-help">No starting point matches “{find.trim()}”. We list the big cities we plan from.</p> : null}
              </>
            ) : (
              <div className="plan-unavailable" role="status">
                <p className="plan-unavailable-title">We cannot plan from a starting point yet</p>
                <p className="plan-help">A trip by car needs a starting point, and none is published. A trip by air does not.</p>
                <Button size="sm" onClick={() => dispatch({ t: 'kind', kind: 'week_air', youngest: null, now: now() })}>
                  Plan a trip by air instead
                </Button>
              </div>
            )
          ) : allAirports.length || allHubs.length ? (
            <>
              <AirportPicker
                starts={starts.status === 'ok' ? starts.data : { hubs: [], airports: [] }}
                value={flow.origin}
                name={flow.originName}
                last={readLastFrom()}
                emptyWord={flow.kind === 'holiday' ? 'Decide later' : 'Not chosen yet'}
                labelledBy="plan-from-l"
                onPick={pickAirport}
                onClear={() => dispatch({ t: 'patch', patch: { origin: null, originName: null }, now: now() })}
              />
              <p className="plan-help">We use this for your flights. The airport you land at comes from where you go. We plan a hire car from the airport.</p>
            </>
          ) : (
            <p className="plan-help">Departure airports are not published yet, so you can skip this. We plan a hire car from the airport you land at.</p>
          )}
          {mode === 'near' ? <p className="plan-help">Your start stays on this device. It is never put in a link.</p> : null}
        </div>

        <PartyRow party={partyState} />

        <div className="plan-field">
          <p className="plan-label" id="plan-when-l">
            When?
          </p>
          <div className="plan-chips" role="group" aria-labelledby="plan-when-l">
            {kind && isShortKind(kind.id) ? (
              <button type="button" className="plan-chip" aria-pressed={when === 'weekend'} onClick={() => setWhen('weekend')}>
                Next weekend
              </button>
            ) : null}
            <label className="plan-chip plan-chip-select" data-pressed={when === 'month' || undefined} aria-pressed={undefined}>
              {when === 'month' && flow.month ? MONTH_NAMES[flow.month - 1] : 'A month'}
              <Icon name="chevronDown" size={14} />
              <select aria-label="Month" value={when === 'month' && flow.month ? String(flow.month) : ''} onChange={(e) => e.target.value && dispatch({ t: 'patch', patch: { month: Number(e.target.value), date: null }, now: now() })}>
                {when === 'month' && flow.month ? null : <option value="">A month</option>}
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="plan-chip" aria-pressed={when === 'dates'} onClick={() => setWhen('dates')}>
              {when === 'dates' ? whenWords(flow, today) : 'Dates…'}
            </button>
            <button type="button" className="plan-chip" aria-pressed={when === 'unsure'} onClick={() => setWhen('unsure')}>
              Not sure yet
            </button>
          </div>
          {when === 'dates' || when === 'weekend' ? (
            <label className="plan-date">
              <span className="plan-help">Day 1</span>
              <input type="date" className="plan-date-input" value={flow.date ?? ''} onChange={(e) => dispatch({ t: 'patch', patch: { date: e.target.value || null, month: e.target.value ? monthOfDate(e.target.value) : flow.month }, now: now() })} />
            </label>
          ) : null}
          <p className="plan-help">The month decides which places are open, how long the light lasts and what to book ahead.</p>
        </div>

        {mode === 'near' && allHubs.length && flow.start ? (
          <div className="plan-field">
            <button type="button" className="plan-count-btn" onClick={() => setReachOpen(true)} aria-haspopup="dialog">
              {count.status === 'ok' && count.total !== null ? (
                <>
                  <CountWords total={count.total} min={flow.driveLimitMin} />
                  {flow.month ? ` · ${MONTH_NAMES[flow.month - 1]!.slice(0, 3)}` : ''}
                </>
              ) : count.status === 'error' ? (
                'We could not count the places'
              ) : (
                'Counting places…'
              )}
            </button>
            <LongerDrive flow={flow} party={party} below={PLAN_BUILDER_UI.thinCount} onChange={(min) => dispatch({ t: 'patch', patch: { driveLimitMin: min }, now: now() })} />
            <SideSheet open={reachOpen} onOpenChange={setReachOpen} title="How far to drive" footer={<Button variant="primary" onClick={() => setReachOpen(false)}>Done</Button>}>
              <ReachControl flow={flow} party={party} onChange={(min) => dispatch({ t: 'patch', patch: { driveLimitMin: min }, now: now() })} />
            </SideSheet>
          </div>
        ) : null}
      </div>

      <aside className="plan-aside" aria-label="Your trip so far">
        <h2 className="plan-h3">Your trip so far</h2>
        <dl className="plan-dl">
          <div>
            <dt>Kind</dt>
            <dd>{kind?.label}</dd>
          </div>
          <div>
            <dt>Nights</dt>
            <dd>{flow.nights === 0 ? 'None, out and back' : flow.nights}</dd>
          </div>
          <div>
            <dt>{mode === 'near' ? 'Reach' : 'Getting there'}</dt>
            <dd>{mode === 'near' ? `Up to ${flow.driveLimitMin / 60} h each way` : 'We plan a hire car from the airport'}</dd>
          </div>
          <div>
            <dt>When</dt>
            <dd>{whenWords(flow, today)}</dd>
          </div>
        </dl>
        <p className="plan-help">Everything here can be changed later, on the trip&apos;s page.</p>
      </aside>
    </div>
  );
}
