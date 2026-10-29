'use client';

import type { DayTimeline } from '@travel/core/schedule/types.ts';
import type { PlanDraft, PlanOp } from '@/lib/trip-edit/model';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { convertOps, refusal } from './materialise';
import { ConvertNotice } from './ConvertNotice';
import type { EngineSection } from './store';
import './convert.css';

/** What Continue is for: a section to open on the converted trip, or Rebuild to run on it. */
export type Ask = EngineSection | 'rebuild';

export interface CopyPlanProps {
  doc: PlanDraft;
  timelines: readonly DayTimeline[] | undefined;
  /** the name the page shows for the trip; the converted trip keeps it as its own */
  title: string;
  ourTitle: string | null;
  asked: Ask | null;
  setAsked: (a: Ask | null) => void;
  /** applies the conversion as one undo step (the edit session's commit) */
  run: (ops: PlanOp[], label: string) => boolean;
  /** the conversion is done: the built sections open on what was asked */
  onConverted: (a: Ask) => void;
}

const WHY = {
  long: 'This trip has more days than a built plan holds (22), so it cannot become your own plan yet. You can still change its places, days and notes here.',
  empty: 'This trip has no places to build from yet. Add a place to a day first.',
} as const;

/** "Canadian Rockies, 15 nights" reads "Canadian Rockies" in a sentence. */
const plain = (t: string | null): string | null => (t ? t.replace(/,\s*\d+ nights?$/, '') : null);

/**
 * The plan sections of a copy's Settings (edit-mode-spec 8, 13.2; ruling R10): Where, Days and driving, Bases, Getting there and Rebuild
 * are the engine's, so a copy meets the convert notice first. Pressing one asks; Continue runs `convert` (one undo step, every stop kept
 * on its day as "From our trip") and the built sections of the converted trip open on what was asked. Nothing is converted until Continue.
 */
export function CopyPlanSection({ doc, timelines, title, ourTitle, asked, setAsked, run, onConverted }: CopyPlanProps) {
  const near = doc.where.mode === 'near';
  const rows: { id: EngineSection; label: string }[] = [
    { id: 'where', label: 'Where' },
    { id: 'days', label: 'Days and driving' },
    { id: 'bases', label: 'Bases' },
    { id: 'start', label: near ? 'Where you start' : 'Getting there' },
  ];
  const no = timelines && timelines.length ? refusal(doc, timelines) : 'empty';
  const go = () => {
    if (!asked || !timelines || no) return;
    const c = convertOps(doc, timelines, title, new Date().toISOString());
    if (run(c.ops, 'Made this your own trip')) onConverted(asked);
  };
  return (
    <section className="cpl" aria-labelledby="cpl-h" data-testid="copy-plan">
      <h3 id="cpl-h" className="field-label">The plan</h3>
      {asked ? <ConvertNotice ours={plain(ourTitle)} blocked={no ? WHY[no] : null} onContinue={go} onCancel={() => setAsked(null)} /> : null}
      <ul className="cpl-list">
        {rows.map((r) => (
          <li key={r.id}>
            <button type="button" className="cpl-row" data-asked={asked === r.id || undefined} onClick={() => setAsked(r.id)}>
              <span>{r.label}</span>
              <Icon name="chevronRight" size={16} />
            </button>
          </li>
        ))}
      </ul>
      <div className="cpl-foot">
        <Button variant="secondary" onClick={() => setAsked('rebuild')}>Rebuild</Button>
      </div>
    </section>
  );
}
