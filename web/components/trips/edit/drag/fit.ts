// The driving change the pill says ("+42 min driving ≈"): the Move to day list's own figure for each day (`dayChoices`), worked out once at
// the lift with the same scheduler call, so the pill and the sheet never disagree. A failure answers an empty map: the pill then has no delta.
import type { Profile } from '@travel/core/schedule/types.ts';
import { candidateToItem, type TimelineModel } from '@/components/trips/timeline/model';
import { dayChoices, type DayChoice } from '@/lib/trip-edit/moveFit';
import type { PlanDraft } from '@/lib/trip-edit/model';
import { deltaOfDraft } from '@/lib/trip-edit/source';
import { stopTarget, type StopEntry } from '@/lib/trip-edit/stopOps';

export async function loadChoices(a: { doc: PlanDraft; model: TimelineModel; profile: Profile; start: string | null; entry: StopEntry }): Promise<Map<number, DayChoice>> {
  try {
    const engine = await import('@travel/core/schedule/template.ts');
    const rows = dayChoices({
      engine,
      days: a.model.days,
      delta: deltaOfDraft(a.doc),
      overrides: a.doc.template?.overrides ?? {},
      profile: a.profile,
      addItem: (x) => {
        const c = a.model.addables[x.slug];
        return c ? candidateToItem(c) : null;
      },
      start: a.start,
      stop: stopTarget(a.doc, a.entry),
    });
    return new Map(rows.map((r) => [r.n, r]));
  } catch {
    return new Map();
  }
}
