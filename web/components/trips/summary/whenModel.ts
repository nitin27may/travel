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
  /** A quieter second line (the crowd level's source). */
  sub?: string | null;
}

/** Four equal cards (I8). Crowds come from the researched window's crowd level (lib/public/windows.ts); a trip with no windows file says "Not checked yet", never a guess. */
export function cards(weather: Season['weather'], crowds: { value: string; sub: string | null } | null = null): Card[] {
  const v = (s: string) => (s.trim() ? s.trim() : null);
  return [
    { key: 'temperature', label: 'Temperature', value: v(weather.tempC) },
    { key: 'rain', label: 'Rain and snow', value: v(weather.rain) },
    { key: 'daylight', label: 'Daylight', value: v(weather.daylight) },
    { key: 'crowds', label: 'Crowds', value: crowds?.value ?? null, sub: crowds?.sub ?? null },
  ];
}

/**
 * Words that make a season note a closure or a hazard (I9: the warn glyph is for these only; everything else is advice with the info glyph; UXB-4
 * review C2). A hazard shows at rest on a phone (P2), so the list leans toward catching one: closures and season ends, fords and river crossings,
 * rockfall and landslides, wildfire and smoke, lightning, flash floods, avalanche, unsafe or dangerous conditions. "Close to" and "closer" are
 * distance, not a closure. A data flag on each note (authored kind) replaces this list when it exists (BACKLOG); every real note is pinned in
 * tests/trips/when-to-go.test.tsx, so a new note cannot silently fold.
 */
const HAZARD = /\b(clos(?:e|es|ed|ing|ures?)|cut off|ends early|season ends|river crossings?|fords?|rockfall|landslides?|wildfire|smoke|lightning|rip currents?|hypothermia|heat stroke|flash flood|unsafe|dangerous|danger|hazards?|avalanche)\b/i;
export type NoteKind = 'warn' | 'info';
export const noteKind = (text: string): NoteKind => (HAZARD.test(text.replace(/\bclos(?:e|er) to\b/gi, '')) ? 'warn' : 'info');

export interface Note {
  text: string;
  kind: NoteKind;
  /** Folded behind "Show N more" on a phone. */
  fold: boolean;
}

/** Longer lists fold their advice on a phone; three notes or fewer always show whole (a fold that hides one line costs a tap to save one line). */
export const FOLD_ABOVE = 3;

/**
 * The notes in their order, each with its glyph kind and whether a phone folds it. Over FOLD_ABOVE notes, a closure or hazard stays at rest and
 * advice folds; a long list with no hazard keeps its first note at rest, so the heading is never drawn over an empty list.
 */
export function notesOf(notes: readonly string[]): Note[] {
  const list = notes.filter((n) => n.trim()).map((text) => ({ text, kind: noteKind(text) }));
  if (list.length <= FOLD_ABOVE) return list.map((n) => ({ ...n, fold: false }));
  const firstAdvice = list.findIndex((n) => n.kind === 'info');
  const keep = list.some((n) => n.kind === 'warn') ? -1 : firstAdvice;
  return list.map((n, i) => ({ ...n, fold: n.kind === 'info' && i !== keep }));
}

/** Months a researched "good" window starts in, for the strip (a "workable" window draws nothing; "best" is the season's own months). */
export function goodMonths(rows: readonly { verdict: string; startMonth: number | null }[]): Partial<Record<number, MonthState>> {
  const out: Partial<Record<number, MonthState>> = {};
  for (const r of rows) if (r.verdict === 'good' && r.startMonth) out[r.startMonth] = 'good';
  return out;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
export const VERDICT_WORD = { best: 'Best', good: 'Good', workable: 'Workable' } as const;

/** The crowds card: the level of the researched window the plan is written for, with its source ("Government of Alberta, 2019 pattern"). Null without windows. */
export function crowdsCard(rows: readonly { crowd: { level: string; source: string | null; year: number | null } | null; verdict: string; isDefault: boolean }[]): { value: string; sub: string | null } | null {
  const w = rows.find((r) => r.isDefault && r.crowd) ?? rows.find((r) => r.verdict === 'best' && r.crowd);
  if (!w?.crowd) return null;
  const sub = [w.crowd.source, w.crowd.year ? `${w.crowd.year} pattern` : null].filter(Boolean).join(', ');
  return { value: cap(w.crowd.level), sub: sub || null };
}

/** The windows other than the one the plan is written for, for "Other weeks that work", in the file's order. */
export function otherWeeks<T extends { verdict: string; isDefault: boolean }>(rows: readonly T[]): T[] {
  const own = rows.find((r) => r.isDefault) ?? rows.find((r) => r.verdict === 'best');
  return rows.filter((r) => r !== own);
}
