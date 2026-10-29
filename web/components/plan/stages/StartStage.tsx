'use client';

import { useMemo, useState } from 'react';
import type { PlanOrigin } from '@travel/core/schema/plan-draft.ts';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { SideSheet } from '@/components/ui/SideSheet';
import { modeOf } from '@/lib/plan/flow';
import { MONTH_NAMES } from '@/lib/plan/format';
import { kindDef, isShortKind } from '@/lib/plan/kinds';
import { candidateQuery } from '@/lib/plan/query';
import { useCount } from '@/lib/plan/useCandidates';
import type { PartyState } from '@/lib/plan/useParty';
import { useStarts } from '@/lib/plan/useReference';
import { monthOfDate, nextWeekend, whenKind, whenWords } from '@/lib/plan/when';
import { PartyRow } from '../PartyRow';
import { AskUs } from '../AskUs';
import { CountWords, ReachControl } from '../ReachControl';
import { PLAN_BUILDER_UI } from '@/lib/config/product';
import type { StageProps } from './types';

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

  const hubs = starts.status === 'ok' ? starts.data.hubs : [];
  const airports = starts.status === 'ok' ? starts.data.airports : [];

  const pickHub = (value: string) => {
    if (!value) {
      dispatch({ t: 'patch', patch: { start: null, startName: null }, now: now() });
      return;
    }
    const h = hubs.find((x) => `hub:${x.id}` === value);
    if (h) dispatch({ t: 'patch', patch: { start: { kind: 'hub', id: h.id }, startName: h.name }, now: now() });
  };
  const pickAirport = (value: string) => {
    if (!value) {
      dispatch({ t: 'patch', patch: { origin: null, originName: null }, now: now() });
      return;
    }
    const a = airports.find((x) => `iata:${x.iata}` === value);
    if (a) dispatch({ t: 'patch', patch: { origin: { kind: 'airport', iata: a.iata }, originName: a.name }, now: now() });
    else {
      const h = hubs.find((x) => `hub:${x.id}` === value);
      if (h) dispatch({ t: 'patch', patch: { origin: { kind: 'hub', id: h.id }, originName: h.name }, now: now() });
    }
  };
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
            hubs.length ? (
              <Select aria-labelledby="plan-from-l" value={hubValue(flow.start)} onChange={(e) => pickHub(e.target.value)}>
                <option value="">Choose a starting point</option>
                {hubs.map((h) => (
                  <option key={h.id} value={`hub:${h.id}`}>
                    {h.name}
                    {h.cc ? `, ${h.cc}` : ''}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="plan-unavailable" role="status">
                <p className="plan-unavailable-title">We cannot plan from a starting point yet</p>
                <p className="plan-help">A trip by car needs a starting point, and none is published. A trip by air does not.</p>
                <Button size="sm" onClick={() => dispatch({ t: 'kind', kind: 'week_air', youngest: null, now: now() })}>
                  Plan a trip by air instead
                </Button>
              </div>
            )
          ) : airports.length || hubs.length ? (
            <>
              <Select aria-labelledby="plan-from-l" value={hubValue(flow.origin)} onChange={(e) => pickAirport(e.target.value)}>
                <option value="">{flow.kind === 'holiday' ? 'Decide later' : 'Not chosen yet'}</option>
                {airports.map((a) => (
                  <option key={a.iata} value={`iata:${a.iata}`}>
                    {a.name} ({a.iata})
                  </option>
                ))}
                {hubs.map((h) => (
                  <option key={h.id} value={`hub:${h.id}`}>
                    {h.name}
                  </option>
                ))}
              </Select>
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
            <button type="button" className="plan-chip" aria-pressed={when === 'month'} onClick={() => setWhen('month')}>
              {when === 'month' && flow.month ? `${MONTH_NAMES[flow.month - 1]} ▾` : 'A month ▾'}
            </button>
            <button type="button" className="plan-chip" aria-pressed={when === 'dates'} onClick={() => setWhen('dates')}>
              {when === 'dates' ? whenWords(flow, today) : 'Dates…'}
            </button>
            <button type="button" className="plan-chip" aria-pressed={when === 'unsure'} onClick={() => setWhen('unsure')}>
              Not sure yet
            </button>
          </div>
          {when === 'month' ? (
            <Select aria-label="Month" value={String(flow.month ?? '')} onChange={(e) => dispatch({ t: 'patch', patch: { month: Number(e.target.value), date: null }, now: now() })}>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          ) : null}
          {when === 'dates' || when === 'weekend' ? (
            <label className="plan-date">
              <span className="plan-help">Day 1</span>
              <input type="date" className="plan-date-input" value={flow.date ?? ''} onChange={(e) => dispatch({ t: 'patch', patch: { date: e.target.value || null, month: e.target.value ? monthOfDate(e.target.value) : flow.month }, now: now() })} />
            </label>
          ) : null}
          <p className="plan-help">The month decides which places are open, how long the light lasts and what to book ahead.</p>
        </div>

        {mode === 'near' && hubs.length && flow.start ? (
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
            {count.status === 'ok' && (count.total ?? 0) < PLAN_BUILDER_UI.thinCount ? <AskUs /> : null}
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
