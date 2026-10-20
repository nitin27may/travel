// The research level in words, in one place: the place page, the card footer and the list all call it, so the word and the count always
// come from the same scope (review 4.29: "Partly checked · 25 of 25" contradicted itself). No imports: server pages and client rows share it.
import type { CompletenessLevel } from './types';

/** The public words for a research level. "Draft" is the workshop's word and never reaches a visitor (3.42). */
export const LEVEL_WORDS = { basics: 'Basics only', early: 'Early research', usable: 'Partly checked', complete: 'Checked' } as const;

/**
 * The research level in words, with a count that agrees with the word.
 *  - complete reads "Checked", and only when every counted check is done (a count that is not full never reads Checked);
 *  - usable (the required checks are done, optional or untracked ones are open) reads "Partly checked · n of m", where m is the checks counted
 *    plus the `open` ones still to look at, so a "Partly" never carries a full count ("25 of 29", not "25 of 25");
 *  - draft with at least a third of its checks done reads "Early research · n of m", under a third just "Basics only";
 *  - a place with no point stored never reads above Early research, and says "no map point yet" after the count.
 * Documented in place-page-sections.md ("Research level words").
 */
export function levelLabel(level: CompletenessLevel, passed: number, total: number, noPoint = false, open = 0): string {
  const why = noPoint ? ', no map point yet' : '';
  let effective: CompletenessLevel = noPoint ? 'draft' : level;
  // the word follows the count: a full count with nothing open is Checked; a "Checked" with checks missing is only Partly
  if (effective === 'complete' && passed < total) effective = 'usable';
  if (effective === 'usable' && passed >= total && open <= 0) effective = 'complete';
  if (effective === 'complete') return LEVEL_WORDS.complete;
  if (effective === 'usable') return `${LEVEL_WORDS.usable} · ${passed} of ${total + Math.max(open, 0)}${why}`;
  return total > 0 && passed * 3 < total ? LEVEL_WORDS.basics : `${LEVEL_WORDS.early} · ${passed} of ${total}${why}`;
}
