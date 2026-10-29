'use client';

import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { askedStages, canAdvance, isLastStage, modeOf, primaryLabel, stepCount, stepNumber, STAGE_NAMES, STAGE_SHORT, type FlowState, type Stage } from '@/lib/plan/flow';
import { kindDef } from '@/lib/plan/kinds';
import { MONTH_NAMES, reachText } from '@/lib/plan/format';

/** The sub-line of the phone step header (TB-N2R L-R2): "July · On this phone". */
export const subLine = (s: Pick<FlowState, 'month'>, where = 'phone'): string => `${s.month ? MONTH_NAMES[s.month - 1] : 'No date'} · On this ${where}`;

/** Step header (components 9.1, phone): Back, the stage name over the sub-line, the count, the theme toggle and Close, then the progress segments. */
export function StepHeader({ flow, onBack, onClose }: { flow: FlowState; onBack: () => void; onClose: () => void }) {
  const total = stepCount(flow.kind);
  const asked = askedStages(flow.kind).filter((x) => x >= 1);
  const n = flow.stage === 0 ? 0 : stepNumber(flow.kind, flow.stage);
  return (
    <div className="step-header">
      <div className="step-header-row">
        <Button variant="ghost" icon aria-label={flow.stage === 0 ? 'Close the trip builder' : 'Back'} onClick={flow.stage === 0 ? onClose : onBack}>
          <Icon name="chevronLeft" size={20} />
        </Button>
        <div className="step-title">
          <p className="step-name">{flow.stage === 0 ? 'Plan a trip' : STAGE_NAMES[flow.stage]}</p>
          <p className="step-sub">{subLine(flow)}</p>
        </div>
        {flow.stage > 0 ? (
          <p className="step-count">
            <span className="sr-only">Step </span>
            {n} of {total}
          </p>
        ) : null}
        <ThemeToggle />
        <Button variant="ghost" icon aria-label="Close the trip builder, your plan is kept" onClick={onClose}>
          <Icon name="close" size={18} />
        </Button>
      </div>
      <div className="step-progress" aria-hidden="true">
        {asked.map((st) => (
          <span key={st} data-state={st < flow.stage ? 'done' : st === flow.stage ? 'now' : 'ahead'} />
        ))}
      </div>
    </div>
  );
}

const valueOf = (s: FlowState, st: Stage): string | null => {
  switch (st) {
    case 0:
      return s.kind ? kindDef(s.kind).label : null;
    case 1:
      return modeOf(s) === 'near' ? s.startName : s.originName;
    case 2:
      return modeOf(s) === 'trip' ? (s.ccName ?? s.cc) : `Within ${reachText(s.driveLimitMin)}`;
    case 3:
      return s.picks.length ? `${s.picks.length} picked` : null;
    default:
      return null;
  }
};

/** Step rail (components 9.1, 640 px and up): stages 0 to 4, done ones as links with their value, the one primary at the right end. */
export function StepRail({ flow, onGoto, primary }: { flow: FlowState; onGoto: (s: Stage) => void; primary: ReactNode }) {
  const asked = askedStages(flow.kind);
  return (
    <div className="step-rail">
      {flow.kind ? (
        <div className="step-rail-name">
          <p className="step-name">{kindDef(flow.kind).label}</p>
          <p className="step-sub">{subLine(flow, 'device')}</p>
        </div>
      ) : null}
      <nav aria-label="Steps" className="step-rail-nav">
        <ol>
          {([0, 1, 2, 3, 4] as Stage[]).map((st) => {
            // a stage the kind does not ask shows as done with its value and is not a link (its value changes on a later stage)
            const skipped = flow.kind !== null && !asked.includes(st);
            const current = st === flow.stage;
            const done = skipped || st < flow.stage;
            // a step already visited that holds no answer says so (RB-029), so an empty start is not a blank
            const value = done ? (valueOf(flow, st) ?? (skipped || st === 0 ? null : 'Not chosen')) : null;
            const body = (
              <>
                <span className="rail-disc" aria-hidden="true">
                  {done ? <Icon name="check" size={12} strokeWidth={2.6} /> : st}
                </span>
                <span className="rail-name">{STAGE_SHORT[st]}</span>
                <span className="rail-value">{value}</span>
              </>
            );
            return (
              <li key={st} data-state={current ? 'now' : done ? 'done' : 'ahead'}>
                {done && !skipped && !current ? (
                  <button type="button" className="rail-step" onClick={() => onGoto(st)}>
                    {body}
                  </button>
                ) : (
                  <span className="rail-step" aria-current={current ? 'step' : undefined}>
                    {body}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="step-rail-end">{primary}</div>
    </div>
  );
}

/** The primary: names its stage, or builds (FLOW L1). Off with a reason, not hidden (the reason is read by screen readers). */
export function Primary({ flow, startsAvailable, building, onNext, size = 'md', reasonId }: { flow: FlowState; startsAvailable?: boolean; building: boolean; onNext: () => void; size?: 'md' | 'lg'; reasonId: string }) {
  const adv = canAdvance(flow, { startsAvailable });
  const last = isLastStage(flow);
  return (
    <Button
      variant="primary"
      size={size}
      loading={building}
      aria-disabled={!adv.ok || building || undefined}
      aria-describedby={!adv.ok && adv.reason ? reasonId : undefined}
      onClick={() => {
        if (adv.ok && !building) onNext();
      }}
    >
      {building ? 'Building…' : primaryLabel(flow)}
      {!last && !building ? <Icon name="arrow" size={16} /> : null}
    </Button>
  );
}
