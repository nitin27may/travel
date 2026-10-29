'use client';

import type { Dispatch } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { FlowAction, FlowState } from '@/lib/plan/flow';
import { useStarts } from '@/lib/plan/useReference';

type Origin = FlowState['origin'];
const valueOf = (o: Origin): string => (o?.kind === 'hub' ? `hub:${o.id}` : o?.kind === 'airport' ? `iata:${o.iata}` : '');

/**
 * Where you start (a trip from home) or Getting there (a trip by air), for a built trip's Settings: the same public list of hubs and
 * airports the builder's first stage offers (its reference hook, one call through DataClient), editing the same state. The builder's whole
 * Start stage is not mounted here: it also edits the device party and the dates, which this sheet's Who is going and Dates sections own
 * for the trip (the trip's party never changes the device party, EM-B).
 */
export function StartSection({ flow, dispatch, now, mode }: { flow: FlowState; dispatch: Dispatch<FlowAction>; now: () => string; mode: 'near' | 'trip' }) {
  const [starts, retry] = useStarts();
  const hubs = starts.status === 'ok' ? starts.data.hubs : [];
  const airports = starts.status === 'ok' ? starts.data.airports : [];
  const id = mode === 'near' ? 'bset-start-l' : 'bset-gw-l';
  if (starts.status === 'loading') return <p className="plan-help">Loading starting points…</p>;
  if (starts.status === 'error' || starts.status === 'unavailable')
    return (
      <Banner kind="urgent" action={<Button size="sm" onClick={retry}>Try again</Button>}>
        We could not load the starting points.
      </Banner>
    );
  if (mode === 'near') {
    const pick = (v: string) => {
      const h = hubs.find((x) => `hub:${x.id}` === v);
      if (h) dispatch({ t: 'patch', patch: { start: { kind: 'hub', id: h.id }, startName: h.name }, now: now() });
    };
    return (
      <div className="plan-field">
        <p className="plan-label" id={id}>Starting from</p>
        <Select aria-labelledby={id} value={valueOf(flow.start)} onChange={(e) => pick(e.target.value)}>
          {flow.start ? null : <option value="">Choose a starting point</option>}
          {hubs.map((h) => (
            <option key={h.id} value={`hub:${h.id}`}>
              {h.name}
              {h.cc ? `, ${h.cc}` : ''}
            </option>
          ))}
        </Select>
        <p className="plan-help">Your start stays on this device. It is never put in a link.</p>
      </div>
    );
  }
  const pick = (v: string) => {
    if (!v) return dispatch({ t: 'patch', patch: { origin: null, originName: null }, now: now() });
    const a = airports.find((x) => `iata:${x.iata}` === v);
    if (a) return dispatch({ t: 'patch', patch: { origin: { kind: 'airport', iata: a.iata }, originName: a.name }, now: now() });
    const h = hubs.find((x) => `hub:${x.id}` === v);
    if (h) dispatch({ t: 'patch', patch: { origin: { kind: 'hub', id: h.id }, originName: h.name }, now: now() });
  };
  return (
    <div className="plan-field">
      <p className="plan-label" id={id}>Flying from</p>
      {airports.length || hubs.length ? (
        <Select aria-labelledby={id} value={valueOf(flow.origin)} onChange={(e) => pick(e.target.value)}>
          <option value="">Not chosen yet</option>
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
      ) : (
        <p className="plan-help">Departure airports are not published yet.</p>
      )}
      <p className="plan-help">The first and last day start and end at the airport you land at. We plan a hire car from it.</p>
    </div>
  );
}

/** The name of a start or an airport for the section's one-line summary, once the list has loaded (else the stored name, else a word). */
export function originWords(flow: FlowState, mode: 'near' | 'trip'): string {
  if (mode === 'near') return flow.startName ?? (flow.start ? 'Your start' : 'Not chosen');
  return flow.originName ?? (flow.origin ? (flow.origin.kind === 'airport' ? flow.origin.iata : 'Chosen') : 'Not chosen yet');
}
