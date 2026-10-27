// "When to go" on the Summary (spec trip-and-places-ux-fixes.md 6.2, W4; components 4.7), as pure functions so the page and the tests read one
// definition. Nothing here invents a fact: a month is "best" only when the trip's season says it is researched, "the plan's months" when the
// season is only the window the plan was written for, and a state with no source ("also good", "avoid") is drawn only when the caller passes it
// (no windows file is read yet: OVR-1).
import type { Season } from '@/lib/public/types';

export type MonthState = 'best' | 'good' | 'plan' | 'avoid' | 'none';

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
/** Three letters: single letters repeat J, M and A (finding I7). */
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** The word drawn in a cell and the phrase a screen reader gets after the month name. */
export const STATE_WORD: Record<MonthState, string> = { best: 'best', good: 'good', plan: 'plan', avoid: 'avoid', none: '' };
export const STATE_PHRASE: Record<MonthState, string> = {
  best: 'best for this plan',
  good: 'also good, with trade-offs',
  plan: "one of the plan's months",
  avoid: 'best avoided',
  none: 'not checked for this plan',
};
/** The legend words, in the order they are drawn. */
export const STATE_LEGEND: Record<Exclude<MonthState, 'none'>, string> = {
  best: 'Best for this plan',
  good: 'Also good, with trade-offs',
  plan: "The plan's months",
  avoid: 'Avoid',
};

/** Twelve states, January first. The season's months are `best` when researched and `plan` when only the plan's own window; `extra` adds states a source gave (windows). */
export function monthStates(season: Pick<Season, 'months' | 'basis'>, extra: Partial<Record<number, MonthState>> = {}): MonthState[] {
  const own: MonthState = season.basis === 'plan' ? 'plan' : 'best';
  return Array.from({ length: 12 }, (_, i) => (season.months.includes(i + 1) ? own : (extra[i + 1] ?? 'none')));
}

/** "September", "July and August", "March, April and May". */
export function monthList(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The line a screen reader hears before the twelve items ("Best: September. Also good: June, August."), so nobody has to walk the list. */
export function stateSummary(states: readonly MonthState[]): string {
  const of = (s: MonthState) => MONTH_NAMES.filter((_, i) => states[i] === s);
  const parts: string[] = [];
  const add = (label: string, s: MonthState) => {
    const m = of(s);
    if (m.length) parts.push(`${label}: ${monthList(m)}.`);
  };
  add('Best', 'best');
  add('Also good', 'good');
  add("The plan's months", 'plan');
  add('Avoid', 'avoid');
  return parts.length ? parts.join(' ') : 'No month has been checked for this plan.';
}

/** The states drawn in this strip, for its legend (never a swatch for a state nothing uses; "not checked" only beside a checked month). */
export function legendStates(states: readonly MonthState[]): (Exclude<MonthState, 'none'>)[] {
  return (['best', 'good', 'plan', 'avoid'] as const).filter((s) => states.includes(s));
}

export interface Hero {
  kicker: string;
  window: string;
  sentence: string;
  /** Said under the sentence when the window is only the plan's own. */
  basisNote: string | null;
}

/**
 * The hero (6.2 1): the season label and its reason. "Best time for this plan" only for a researched season; a plan's own window says so,
 * never "best" (the cover stat reads "Planned for" in the same case).
 */
export function hero(season: Pick<Season, 'label' | 'why' | 'basis'>): Hero {
  const plan = season.basis === 'plan';
  return {
    kicker: plan ? 'The window this plan was written for' : 'Best time for this plan',
    window: season.label,
    sentence: season.why,
    basisNote: plan ? 'Other months and opening dates have not been checked yet.' : null,
  };
}

export interface Card {
  key: 'temperature' | 'rain' | 'daylight' | 'crowds';
  label: string;
  /** null: nothing is written down, so the card says "Not checked yet". */
  value: string | null;
}

/** Four equal cards (I8). Crowds come from a windows file's crowd level, which no adapter reads yet: "Not checked yet" rather than a guess. */
export function cards(weather: Season['weather'], crowds: string | null = null): Card[] {
  const v = (s: string) => (s.trim() ? s.trim() : null);
  return [
    { key: 'temperature', label: 'Temperature', value: v(weather.tempC) },
    { key: 'rain', label: 'Rain and snow', value: v(weather.rain) },
    { key: 'daylight', label: 'Daylight', value: v(weather.daylight) },
    { key: 'crowds', label: 'Crowds', value: crowds },
  ];
}

/** Words that make a season note a closure or a hazard (I9: the warn glyph is for these only; everything else is advice with the info glyph). */
const HAZARD = /\b(clos(?:e|es|ed|ing|ures?)|cut off|ends early|flash flood|unsafe|dangerous|danger|hazards?|avalanche)\b/i;
export type NoteKind = 'warn' | 'info';
export const noteKind = (text: string): NoteKind => (HAZARD.test(text) ? 'warn' : 'info');

export interface Note {
  text: string;
  kind: NoteKind;
}

/** The notes in their order, each with its glyph kind. */
export const notesOf = (notes: readonly string[]): Note[] => notes.filter((n) => n.trim()).map((text) => ({ text, kind: noteKind(text) }));
