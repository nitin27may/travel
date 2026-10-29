// The name a builder trip goes by when the person has not named it (RB-015, RB-020): "Banff and Jasper, 7 nights". One function, so stage 0,
// Mine, the cover, the browser tab and the sticky row all say the same thing. Pure; no schema code (the start chunk and Mine reach it).
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';

type TitleInput = Pick<PlanDraft, 'title' | 'where' | 'nights' | 'picks' | 'lastBuild'>;

/** A country's English name from its code, or the code (the browser knows the names; the document holds only the code). */
export function countryName(cc: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(cc) ?? cc;
  } catch {
    return cc;
  }
}

const joinNames = (names: readonly string[]): string => {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and more`;
};

export const nightsWords = (nights: number | null): string => (nights === null ? '' : nights === 0 ? 'a day trip' : nights === 1 ? '1 night' : `${nights} nights`);

/**
 * The derived name: the towns the build sleeps in, else the first picks, else the country; then the length. A document with its own title
 * is not derived (the caller uses the title). A trip with nothing to name says "Your trip" with its length.
 */
export function derivedTitle(d: Omit<TitleInput, 'title'>): string {
  const bases = [...new Set((d.lastBuild?.bases ?? []).map((b) => b.name).filter(Boolean))];
  const picked = [...new Set(d.picks.map((p) => p.name).filter(Boolean))];
  const names = bases.length ? bases : picked;
  const lead = names.length ? joinNames(names) : d.where.mode === 'trip' ? countryName(d.where.cc) : 'Your trip';
  const len = nightsWords(d.nights);
  return len ? `${lead}, ${len}` : lead;
}

/** The title shown for a builder document: its own, else the derived one. */
export const draftTitle = (d: TitleInput): string => d.title ?? derivedTitle(d);
