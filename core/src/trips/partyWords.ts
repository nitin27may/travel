// The party in words (trip-and-places-ux-fixes.md 5.2): one set of functions for the bar, the sticky rail, Mine's rows and the copy sheet.
// Pure and tiny on purpose: it imports no runtime code, so a lazy chunk that only says the party (the rail, the offer) does not pull in
// party.ts (the landing rule, cleaning), which Turbopack does not tree-shake. party.ts re-exports everything here.
import type { Pace } from "../schedule/types.ts";

/** The shape the words need; `Party` in party.ts is this. */
export interface PartyLike {
  adults: number;
  children: readonly (number | null)[];
}

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** "1 adult", "2 adults". */
export const adultsText = (n: number): string => count(n, "adult", "adults");

/** How an age reads: a baby is "under 1", never "0" (review UXB-2 M1); an age not set reads "age not set". */
export const ageText = (a: number | null): string => (a === null ? "age not set" : a === 0 ? "under 1" : String(a));

/** "1 child (7)", "2 children (7, under 1)", "1 child (age not set)"; "" with no children. Ages in the order entered. */
export function childrenText(children: readonly (number | null)[]): string {
  if (!children.length) return "";
  return `${count(children.length, "child", "children")} (${children.map(ageText).join(", ")})`;
}

/** The party in words, one function for the bar, Mine's rows and the copy sheet: "2 adults · 2 children (7, 10)". */
export function partyText(p: PartyLike, sep = " · "): string {
  return [adultsText(p.adults), childrenText(p.children)].filter(Boolean).join(sep);
}

/** The short form, without ages, for the sticky day rail and the offer button: "2 adults, 1 child". */
export function partyShortText(p: PartyLike): string {
  return [adultsText(p.adults), p.children.length ? count(p.children.length, "child", "children") : ""].filter(Boolean).join(", ");
}

export const PACE_WORD: Readonly<Record<Pace, string>> = { relaxed: "Relaxed", standard: "Standard", full: "Full" };

/** The collapsed bar's line: "2 adults · 1 child (10) · Standard pace"; `short` drops "pace" (phones, the day rail). */
export function partyLine(p: PartyLike, pace: Pace, short = false): string {
  return `${partyText(p)} · ${PACE_WORD[pace]}${short ? "" : " pace"}`;
}
