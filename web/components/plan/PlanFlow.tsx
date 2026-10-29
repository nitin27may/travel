'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useReducer, useRef, useState } from 'react';
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { PLAN_BUILDER_UI } from '@/lib/config/product';
import { buildInputOf, draftOf, nextIdentity, outputsOf, stateOfDraft } from '@/lib/plan/draft';
import { parseEntry, hasEntry } from '@/lib/plan/entry';
import { canAdvance, flowReducer, isLastStage, modeOf, newFlow, STAGE_NAMES, stepCount, stepNumber, type FlowAction, type Stage } from '@/lib/plan/flow';
import { plural } from '@/lib/plan/format';
import { handOffBuilt, HandOffError } from '@/lib/plan/handoff';
import { kindDef } from '@/lib/plan/kinds';
import { persistFlow } from '@/lib/plan/persist';
import { readDrafts, readFlow } from '@/lib/plan/store';
import { useParty } from '@/lib/plan/useParty';
import { Primary, StepHeader, StepRail } from './Chrome';
import { trayWords } from './Tray';
import { KindStage } from './stages/KindStage';
import type { StageProps } from './stages/types';

// Stages 1 to 4 load when first reached, so the first paint carries the kind tiles only (the /plan/ start-JS budget).
const StartStage = dynamic(() => import('./stages/StartStage').then((m) => m.StartStage), { ssr: false });
const WhereStage = dynamic(() => import('./stages/WhereStage').then((m) => m.WhereStage), { ssr: false });
const PickStage = dynamic(() => import('./stages/PickStage').then((m) => m.PickStage), { ssr: false });
const DaysStage = dynamic(() => import('./stages/DaysStage').then((m) => m.DaysStage), { ssr: false });

const EMPTY = newFlow('', '');
const nowIso = (): string => new Date().toISOString();

type Building = { status: 'idle' } | { status: 'building'; slow: boolean } | { status: 'failed'; message: string; code: string };

/** The words of a build that did not finish (FLOW stage 5 states): the plan stays on the device either way. */
function buildFailure(e: unknown): { message: string; code: string } {
  const code = (e as { code?: string }).code ?? 'internal';
  if (e instanceof HandOffError) {
    const why: Record<string, string> = {
      cap: `${PLAN_BUILDER_UI.deviceDrafts} plans on this device. Remove one from Your plans, then build again.`,
      full: 'This browser has no room left to keep the plan. Free some space, then build again.',
      blocked: 'This browser does not let the site keep plans. Allow site data, then build again.',
      newer: 'These plans were saved by a newer version of the site. Reload the page, then build again.',
      toolarge: 'This plan is too big to keep on the device. Take a few places out, then build again.',
      unbuilt: 'We could not build your days.',
    };
    return { message: why[e.reason] ?? 'We could not keep the plan on this device.', code: `hand_off_${e.reason}` };
  }
  if (code === 'rate_limited') {
    const wait = (e as { retryAfterS?: number | null }).retryAfterS;
    return { message: `Too many builds just now. Try again ${wait ? `in ${plural(Math.max(1, Math.ceil(wait / 60)), 'minute')}` : 'a little later'}. Your plan is kept.`, code };
  }
  if (code === 'plan_paused') return { message: 'Planning is paused. Your plan is safe on this device.', code };
  if (code === 'not_available') return { message: 'We cannot plan from that starting point yet. Pick another one, or plan a trip by air.', code };
  if (code === 'too_large') return { message: 'That is more than one build can take. Take a few places out.', code };
  return { message: 'We could not build your days. Your plan is kept.', code };
}

/** `/plan/`: stages 0 to 4 of the trip builder (FLOW 2), the one document behind them, and Build my days, which hands the trip to its page. */
export function PlanFlow() {
  const router = useRouter();
  const [flow, dispatch] = useReducer(flowReducer, EMPTY);
  const [ready, setReady] = useState(false);
  const partyState = useParty();
  const { party } = partyState;
  const [trayOpen, setTrayOpen] = useState(false);
  const [building, setBuilding] = useState<Building>({ status: 'idle' });
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const reasonId = useId();
  const stageSeen = useRef<Stage | null>(null);
  const abort = useRef<AbortController | null>(null);

  const now = nowIso;

  // ---- start: the saved screen state, or a link in (park and place pages), or a new draft -------------------------------------------
  useEffect(() => {
    const entry = parseEntry(window.location.search);
    const id = crypto.randomUUID();
    if (hasEntry(entry)) {
      const t = nowIso();
      let s = newFlow(id, t);
      if (entry.kind) {
        s = flowReducer(s, { t: 'kind', kind: entry.kind, youngest: null, now: t });
        if (entry.nights !== null) s = { ...s, nights: Math.min(Math.max(entry.nights, entry.kind === 'day' ? 0 : 1), 9) };
      }
      s = { ...s, stage: entry.kind ? 1 : 0 };
      dispatch({ t: 'load', state: s });
      // the query is read once: a reload resumes the draft, it does not start over from the link
      window.history.replaceState(window.history.state, '', window.location.pathname);
      if (entry.place) {
        const slug = entry.place;
        void import('@/lib/client/data').then(({ placesPage }) => placesPage({ ids: [slug] }, 1, 1)).then((r) => {
          const row = r?.items[0];
          if (row) dispatch({ t: 'pick', pick: { ref: row.ref, slug: row.slug, name: row.name, must: false }, visitMin: null, now: nowIso() });
        });
      }
    } else {
      const saved = readFlow();
      dispatch({ t: 'load', state: saved ?? newFlow(id, nowIso()) });
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the saved draft is in the browser, so the first paint is the server's shell and this is the switch to the real one
    setReady(true);
  }, []);

  // the latest state, for the flush when the page is left inside the autosave pause
  const latest = useRef(flow);
  useEffect(() => {
    latest.current = flow;
  }, [flow]);
  useEffect(() => {
    if (!ready) return;
    const flush = () => {
      if (latest.current.id) persistFlow(latest.current);
    };
    const hidden = () => document.visibilityState === 'hidden' && flush();
    addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [ready]);

  // ---- autosave (500 ms after the last change) ---------------------------------------------------------------------------------------
  useEffect(() => {
    if (!ready || !flow.id) return;
    const t = setTimeout(() => {
      const r = persistFlow(flow);
      setSaveNote(r && !r.ok ? (r.reason === 'cap' ? `${PLAN_BUILDER_UI.deviceDrafts} plans on this device. Remove one from Your plans to keep this one.` : 'This plan could not be kept on this device. It will be lost if you leave.') : null);
    }, PLAN_BUILDER_UI.autosaveMs);
    return () => clearTimeout(t);
  }, [flow, ready]);

  // ---- history: Back goes to the previous asking stage ---------------------------------------------------------------------------------
  useEffect(() => {
    if (!ready) return;
    if (stageSeen.current === null) window.history.replaceState({ ...(window.history.state as object | null), planStage: flow.stage }, '');
    else if (stageSeen.current !== flow.stage && (window.history.state as { planStage?: number } | null)?.planStage !== flow.stage) window.history.pushState({ planStage: flow.stage }, '');
    stageSeen.current = flow.stage;
  }, [flow.stage, ready]);
  useEffect(() => {
    const pop = (e: PopStateEvent) => {
      const st = (e.state as { planStage?: Stage } | null)?.planStage;
      if (st !== undefined) {
        stageSeen.current = st;
        dispatch({ t: 'goto', stage: st });
      }
    };
    addEventListener('popstate', pop);
    return () => removeEventListener('popstate', pop);
  }, []);

  // ---- a new stage: focus its heading and say where we are ---------------------------------------------------------------------------
  useEffect(() => {
    if (!ready) return;
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the live region is told once per stage, after the stage has rendered
    setAnnounce(flow.stage === 0 ? 'Plan a trip' : `Step ${stepNumber(flow.kind, flow.stage)} of ${stepCount(flow.kind)}: ${STAGE_NAMES[flow.stage]}`);
  }, [flow.stage, ready, flow.kind]);

  const act: typeof dispatch = useCallback((a: FlowAction) => dispatch(a), []);

  const resume = (d: PlanDraft) => dispatch({ t: 'load', state: stateOfDraft(d) });
  const close = () => {
    // the plan is kept (autosave ran); go back to where the person came from, or home
    const ref = document.referrer;
    try {
      const u = ref ? new URL(ref) : null;
      if (u && u.origin === window.location.origin && u.pathname !== window.location.pathname) {
        router.push(u.pathname + u.search);
        return;
      }
    } catch {
      /* fall through to home */
    }
    router.push('/');
  };

  // ---- Build my days -----------------------------------------------------------------------------------------------------------------------
  const build = useCallback(async () => {
    const input = buildInputOf(flow, party);
    if (!input) return;
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setBuilding({ status: 'building', slow: false });
    const slow = setTimeout(() => setBuilding((b) => (b.status === 'building' ? { status: 'building', slow: true } : b)), PLAN_BUILDER_UI.slowBuildMs);
    try {
      const data = await import('@/lib/client/data');
      const answer = await data.planBuild(input, ac.signal);
      if (answer === null) throw Object.assign(new Error('no builder'), { code: 'internal' });
      const list = readDrafts();
      const identity = list.drafts.find((d) => d.id === flow.id)?.identity ?? nextIdentity(list.drafts.map((d) => d.identity));
      const doc = draftOf({ ...flow, updatedAt: nowIso() }, identity, { ...outputsOf(answer) });
      if (!doc) throw new Error('incomplete');
      // the schema (Zod) loads here, once, to be sure the details page can open what we store
      const { parsePlanDraft } = await import('@travel/core/schema/plan-draft.ts');
      const checked = parsePlanDraft(doc);
      if (!checked.success) throw new Error('invalid draft');
      const url = handOffBuilt(checked.data);
      router.replace(url);
    } catch (e) {
      if (ac.signal.aborted) return;
      setBuilding({ status: 'failed', ...buildFailure(e) });
    } finally {
      clearTimeout(slow);
    }
  }, [flow, party, router]);

  const startsAvailable = true;
  const adv = canAdvance(flow, { startsAvailable });
  const next = () => {
    if (isLastStage(flow)) void build();
    else dispatch({ t: 'next' });
  };

  const primary = (size: 'md' | 'lg') => <Primary flow={flow} building={building.status === 'building'} onNext={next} size={size} reasonId={reasonId} startsAvailable={startsAvailable} />;
  const stageProps: StageProps = { flow, dispatch: act, party, now };
  const words = trayWords(flow);

  const title = flow.stage === 0 ? 'Plan a trip' : STAGE_NAMES[flow.stage];
  const subtitle = flow.kind ? `${kindDef(flow.kind).label}${modeOf(flow) === 'near' ? ' · from home' : ''}` : '';
  // the heading is for assistive tech and the desktop page; the phone's step header shows the stage name too
  const showBar = ready && flow.stage > 0;

  return (
    <div className="plan-flow" data-stage={flow.stage} data-mode={flow.kind ? modeOf(flow) : undefined}>
      <div className="plan-chrome">
        <StepHeader flow={flow} onBack={() => dispatch({ t: 'back' })} onClose={close} />
        <StepRail flow={flow} onGoto={(s) => dispatch({ t: 'goto', stage: s })} primary={flow.stage === 0 && !flow.kind ? null : primary('md')} />
      </div>

      <div className="plan-body">
        <header className="plan-head">
          <h1 ref={heading} tabIndex={-1} className="plan-h1">
            {title}
          </h1>
          {subtitle && flow.stage > 0 ? <p className="plan-sub">{subtitle}</p> : null}
        </header>

        {saveNote ? <Banner kind="caution">{saveNote}</Banner> : null}
        {building.status === 'failed' ? (
          <Banner kind="urgent" action={<Button size="sm" onClick={() => void build()}>Try again</Button>}>
            {building.message}
          </Banner>
        ) : null}
        {building.status === 'building' ? (
          <div className="plan-card" role="status">
            <p className="plan-card-line">Building your days. Working out drive times…</p>
            {building.slow ? <p className="plan-help">Still working. A first build can take a few seconds.</p> : null}
          </div>
        ) : null}

        {!ready ? (
          <div className="plan-skeleton" aria-hidden="true" />
        ) : flow.stage === 0 ? (
          <KindStage {...stageProps} onResume={resume} />
        ) : flow.stage === 1 ? (
          <StartStage {...stageProps} partyState={partyState} />
        ) : flow.stage === 2 ? (
          <WhereStage {...stageProps} />
        ) : flow.stage === 3 ? (
          <PickStage {...stageProps} onTray={setTrayOpen} trayOpen={trayOpen} />
        ) : (
          <DaysStage {...stageProps} />
        )}
      </div>

      {showBar ? (
        <div className="action-bar">
          {flow.stage === 3 ? (
            <button type="button" className="action-sum" onClick={() => setTrayOpen(true)} aria-haspopup="dialog">
              <span className="action-sum-1">{words.line1}</span>
              <span className="action-sum-2">{words.line2}</span>
            </button>
          ) : (
            <span className="action-sum action-sum-plain" />
          )}
          {primary('lg')}
        </div>
      ) : null}
      {showBar && !adv.ok && adv.reason ? (
        <p id={reasonId} className="plan-reason">
          {adv.reason}
        </p>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

