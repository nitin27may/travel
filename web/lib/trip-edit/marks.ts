// The words that say how a trip differs from ours (edit-mode-spec 4.1, 10; the vocabulary of step2 README 5). Pure.
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';

/** How many changes the person made to our plan: a chosen version, an added or removed place, a moved stop, a day change, a note. Zero for a built trip. */
export function changeCount(d: PlanDraft): number {
  const t = d.template;
  if (!t) return 0;
  return Object.keys(t.overrides).length + t.added.length + t.removed.length + t.moved.length + t.days.length + Object.keys(t.notes).length;
}

/** "3 changes from our plan"; '' for none. */
export function changesLine(n: number): string {
  return n > 0 ? `${n} ${n === 1 ? 'change' : 'changes'} from our plan` : '';
}

/** The mark an added place carries on its entry (both modes). */
export const ADDED_MARK = 'Added by you';

/** The place slugs the person added, by day: the entries that carry "Added by you". */
export function addedByYou(d: PlanDraft): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const a of d.template?.added ?? []) {
    if (typeof a.day !== 'number' || !a.ref.startsWith('place/')) continue;
    const list = out.get(a.day) ?? [];
    list.push(a.ref.slice('place/'.length));
    out.set(a.day, list);
  }
  return out;
}

/** The kicker over the title: "Your copy · from our Canadian Rockies trip" (a copy) or "Your trip" (a built plan). */
export function kickerWords(d: PlanDraft, ourTitle: string | null): string {
  if (d.template) return ourTitle ? `Your copy · from our ${ourTitle} trip` : 'Your copy';
  return 'Your trip';
}

/** The end date of a dated trip, or null: `start` plus the nights. */
export function endOf(d: PlanDraft): string | null {
  if (!d.start || d.nights === null) return null;
  const t = Date.parse(`${d.start}T00:00:00Z`) + d.nights * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}
