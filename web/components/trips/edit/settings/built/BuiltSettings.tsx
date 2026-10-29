'use client';

import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type { Party } from '@travel/core/trips/party.ts';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { DaysStage } from '@/components/plan/stages/DaysStage';
import { WhereStage } from '@/components/plan/stages/WhereStage';
import { flowReducer, type FlowAction, type Pace } from '@/lib/plan/flow';
import { stateOfDraft } from '@/lib/plan/draft';
import { keptCounts, keptWords } from '@/lib/trip-edit/built';
import type { PlanDraft, PlanOp } from '@/lib/trip-edit/model';
import { newOpId } from '@/lib/trip-edit/stopOps';
import { applyLine, rebuildLine, stagedChanges } from './apply';
import { BasesSection, basesWords } from './BasesSection';
import { partyFor, runRebuild } from './rebuild';
import { originWords, StartSection } from './StartSection';
import '@/components/plan/plan.css';
import './built-settings.css';

export interface BuiltSettingsProps {
  doc: PlanDraft;
  /** the Who is going section's pace, staged here too (it needs Rebuild); null: unchanged */
  pace: Pace | null;
  onPace: (p: Pace | null) => void;
  /** applies operations as one undo step (the edit session's commit, or the document's save in read mode) */
  run: (ops: PlanOp[], label: string) => boolean;
  /** a copy was just converted for this (STEP2-B3): the section it asked for opens, or Rebuild runs once. Null: nothing asked. */
  start?: 'where' | 'days' | 'bases' | 'start' | 'rebuild' | null;
  /** the request was taken up; the parent clears it so a later remount does not repeat it */
  onStarted?: () => void;
}

const nowIso = (): string => new Date().toISOString();
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const PACE_WORD: Record<Pace, string> = { relaxed: 'Relaxed', standard: 'Standard', full: 'Full' };
const hm = (min: number): string => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}` : `${min} min`);

/** One section: its name and a one-line summary on a 44 px row; the builder's stage opens under it on the first press (P2, P1). */
function Section({ id, title, summary, asked, children }: { id: string; title: string; summary: string; asked?: boolean; children: () => ReactNode }) {
  const [open, setOpen] = useState(!!asked);
  const [used, setUsed] = useState(!!asked);
  return (
    <section className="bset-sec" aria-labelledby={`${id}-h`} data-open={open || undefined}>
      <h3 className="bset-h" id={`${id}-h`}>
        <button type="button" className="bset-toggle" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => { setOpen(!open); setUsed(true); }}>
          <span className="bset-title">{title}</span>
          <span className="bset-sum num">{summary}</span>
        </button>
      </h3>
      <div id={`${id}-body`} className="bset-body" hidden={!open}>
        {used ? children() : null}
      </div>
    </section>
  );
}

/**
 * The engine sections of a built trip's Settings (edit-mode-spec 8, 13.1; STEP2-B2; extension point X10): Where you start (a trip from
 * home), Where, Days and driving, Bases, Getting there (a trip by air), each a closed row with its summary that opens the builder's own
 * stage component on the builder's own state, made from the document. Changes are staged; the Apply line says what will change ("Apply:
 * 2 days longer, 1 base added") and what stays ("Rebuild 6 days · 3 kept and 2 added by you stay"); Apply runs them and the server
 * rebuild as one undo step. Loaded lazily with the sheet, and only for a built trip.
 */
export default function BuiltSettings({ doc, pace, onPace, run, start = null, onStarted }: BuiltSettingsProps) {
  const [flow, dispatch] = useReducer(flowReducer, doc, (d: PlanDraft) => ({ ...stateOfDraft(d), stage: 4 as const }));
  const [state, setState] = useState<{ status: 'idle' } | { status: 'building' } | { status: 'failed'; message: string }>({ status: 'idle' });
  const abort = useRef<AbortController | null>(null);
  const mode = doc.where.mode;
  const party = partyFor(doc);
  const stageParty: Party = { adults: party.adults, children: [...party.children] };
  const staged = useMemo(() => stagedChanges(doc, flow, pace, newOpId), [doc, flow, pace]);
  const days = flow.nights + 1;
  const kept = keptWords(keptCounts(doc));
  const line = applyLine(staged.parts);
  const can = doc.picks.length > 0 && !staged.blocked && state.status !== 'building';

  const go = async () => {
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setState({ status: 'building' });
    const r = await runRebuild(doc, staged.ops, run, ac.signal);
    if (ac.signal.aborted) return;
    if (r.ok) {
      onPace(null);
      setState({ status: 'idle' });
    } else setState({ status: 'failed', message: r.message });
  };
  // a conversion's own first action (edit-mode-spec 13.2: "then the engine action runs on the converted trip")
  const started = useRef(false);
  useEffect(() => {
    if (!start || started.current) return;
    started.current = true;
    onStarted?.();
    if (start === 'rebuild') queueMicrotask(() => void go()); // after the effect: go() sets state before its first await
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the mount the conversion made
  }, []);
  const discard = () => {
    dispatch({ t: 'load', state: { ...stateOfDraft(doc), stage: 4 } });
    onPace(null);
    setState({ status: 'idle' });
  };

  const whereWords = flow.cc && mode === 'trip' ? `${flow.ccName ?? flow.cc}${flow.regions.length ? ` · ${plural(flow.regions.length, 'area')}` : ''}` : mode === 'near' ? `up to ${hm(flow.driveLimitMin)} each way` : 'Not chosen';
  const daysWords = [plural(flow.nights, 'night'), PACE_WORD[pace ?? flow.pace], flow.driveDayMin === null ? 'driving by the pace' : `up to ${hm(flow.driveDayMin)} driving`].join(' · ');
  // one pace on the sheet: the Who is going row and Days and driving show and set the same staged value
  const shown = pace ? { ...flow, pace } : flow;
  const send = (a: FlowAction) => {
    if (a.t === 'patch' && a.patch.pace !== undefined) {
      const { pace: next, ...rest } = a.patch;
      onPace(next === doc.pace ? null : (next ?? null));
      if (Object.keys(rest).length) dispatch({ ...a, patch: rest });
      return;
    }
    dispatch(a);
  };
  const stageProps = { flow: shown, dispatch: send, party: stageParty, now: nowIso };

  return (
    <div className="bset" role="group" aria-labelledby="bset-plan-h" data-testid="built-settings">
      <h3 id="bset-plan-h" className="field-label">The plan</h3>
      {mode === 'near' ? (
        <Section id="bset-start" asked={start === 'start'} title="Where you start" summary={originWords(flow, 'near')}>
          {() => <StartSection flow={flow} dispatch={dispatch} now={nowIso} mode="near" />}
        </Section>
      ) : null}
      <Section id="bset-where" asked={start === 'where'} title="Where" summary={whereWords}>
        {() => <WhereStage {...stageProps} />}
      </Section>
      <Section id="bset-days" asked={start === 'days'} title="Days and driving" summary={daysWords}>
        {() => <DaysStage {...stageProps} />}
      </Section>
      <Section id="bset-bases" asked={start === 'bases'} title="Bases" summary={basesWords(doc, flow)}>
        {() => <BasesSection doc={doc} flow={flow} dispatch={send} now={nowIso} />}
      </Section>
      {mode === 'trip' ? (
        <Section id="bset-gw" asked={start === 'start'} title="Getting there" summary={originWords(flow, 'trip')}>
          {() => <StartSection flow={flow} dispatch={dispatch} now={nowIso} mode="trip" />}
        </Section>
      ) : null}

      <div className="bset-apply" data-testid="built-apply" role="status" aria-live="polite">
        {line ? <p className="bset-apply-line"><b>{line}</b></p> : null}
        <p className="bset-apply-line">{rebuildLine(days, kept)}</p>
        {staged.blocked ? <p className="own-set-why">{staged.blocked}</p> : null}
        {!doc.picks.length ? <p className="own-set-why">Add a place to a day first: a plan is built from its places.</p> : null}
        {state.status === 'failed' && state.message ? <Banner kind="urgent">{state.message}</Banner> : null}
        {state.status === 'building' ? <p className="own-set-note">Building your days. Working out drive times…</p> : null}
        <div className="own-set-apply">
          {line ? <Button onClick={discard} disabled={state.status === 'building'}>Discard</Button> : null}
          <Button variant="secondary" loading={state.status === 'building'} disabled={!can} onClick={() => void go()}>
            {line ? 'Apply and rebuild' : 'Rebuild'}
          </Button>
        </div>
      </div>
    </div>
  );
}
