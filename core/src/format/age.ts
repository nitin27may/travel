// The one place an age is turned into words (review 4.24, suitability-display "Age wording"). Cards, chips, lists, table cells, the filter bar,
// trip tags, day rows and place pages all call this, so one age never reads five ways. No imports: the parser, the list rows and the pages share it.

/**
 * What an age phrase says:
 * - `control`: the youngest child's age the visitor chose ("Youngest child 6", "Youngest child Baby").
 * - `fit`: what a place or plan suits from ("From about 6", "Any age"); a rule reads "Minimum age 8" so it is never taken for advice.
 * - `fits`, `advice_fail`, `rule_fail`: the verdict against a chosen age ("Fits age 6", "Not suited to age 3", "Not for under 8 · operator rule").
 */
export type AgeKind = 'control' | 'fit' | 'fits' | 'advice_fail' | 'rule_fail';

/**
 * What a `fit` rests on. A place says `rule` (operator or official, hides the place from a younger child) or `advice` (our judgement). A trip says
 * `plan` (the plan's own stated age), `computed` or `floor` (checked against the records). No basis: the bare phrase.
 */
export type AgeBasis = 'rule' | 'advice' | 'plan' | 'computed' | 'floor' | null;

/** The words after a trip's age: where the number comes from. A place's basis is drawn by the chip's look (lock or person), not by words. */
const SUFFIX: Partial<Record<NonNullable<AgeBasis>, string>> = { plan: ' · our plan', computed: ' · checked', floor: ' · checked' };

/** The control's own phrase, on its own so the query parser (size-budgeted) can use it without the rest. */
export const controlLabel = (value: number): string => `Youngest child ${value === 0 ? 'Baby' : value}`;

export function ageLabel(kind: AgeKind, value: number, basis: AgeBasis = null): string {
  switch (kind) {
    case 'control':
      return controlLabel(value);
    case 'fit': {
      const base = basis === 'rule' ? (value === 0 ? 'No minimum age' : `Minimum age ${value}`) : value === 0 ? 'Any age' : `From about ${value}`;
      return `${base}${basis ? (SUFFIX[basis] ?? '') : ''}`;
    }
    case 'fits':
      return `Fits age ${value}`;
    case 'advice_fail':
      return `Not suited to age ${value}`;
    case 'rule_fail':
      return `Not for under ${value} · operator rule`;
  }
}

/** The sentence under a trip's age chip: what the number rests on. */
export function ageBasisWhy(basis: AgeBasis): string {
  if (basis === 'plan' || basis === null) return "The plan's own stated age; the records do not rule out a younger child, nor settle it.";
  if (basis === 'floor') return 'Raised to the youngest age the records already allow on every day. Missing data can only make it higher.';
  if (basis === 'computed') return 'Every day has a version that fits this age, on records that carry the data.';
  return basis === 'rule' ? 'An operator or official rule.' : 'Our judgement.';
}
