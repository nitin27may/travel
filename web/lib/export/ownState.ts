'use client';

// The person's own trip, as the export, the print and the Stops tab need it (STEP2-E6): a module store like timelineState.ts, because those
// readers sit outside the shell's component tree. Tiny on purpose (types and a store, nothing heavy): the Stops tab chunk and the export menu
// both import it. The shell publishes it from the document after the page is up; nothing here is stored or sent anywhere.
import type { TimelineEntry } from '@travel/core/schedule/types.ts';
import type { AddCandidate } from '@/components/trips/timeline/model';

/** What the export needs to know about a place the person added: the plan model does not carry it. */
export type OwnAddable = Pick<AddCandidate, 'name' | 'kind' | 'sub' | 'label' | 'placeSlug' | 'point' | 'durationMin'>;

/** The place kind (and so the Stops category) of an added place: the inverse of the add list's `kindOf` (components/trips/timeline/model.ts). */
export function placeKindOf(a: Pick<OwnAddable, 'kind' | 'sub'>): string {
  if (a.kind === 'trail') return 'trail';
  if (a.kind === 'meal') return 'eatery';
  if (a.sub === 'lift-ride') return 'lift';
  if (a.sub === 'sight' || !a.sub) return 'sight';
  return a.sub;
}

/** A name as a key: the Stops tab joins an area row (no place page) to a day's stop by it. */
export const nameKey = (s: string): string => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

export interface OwnTrip {
  /** The public trip the copy follows (the export model is read under this slug). */
  slug: string;
  /** The person's own title for the trip. */
  title: string;
  /** "Your copy of Canadian Rockies · Fri 25 Jun 2027 · 2 adults, 1 child": the print's header line. */
  header: string;
  /** The start date of a dated trip, else null (the calendar then asks for dates first). */
  start: string | null;
  /** The place was taken off the trip by the person (removed, sent to Maybe, or on a dropped day): the Stops tab does not list it unless a day still holds it. */
  gone: (placeSlug: string) => boolean;
  /** The same for an area-level row with no place page (Marble Canyon): by its name, through `nameKey`. */
  goneName?: (nameKey: string) => boolean;
  /** The note the person wrote on a stop or a row (empty when none). */
  noteOf: (e: TimelineEntry) => string;
  /** The note on Day n (empty when none). */
  dayNote: (n: number) => string;
  addable: (placeSlug: string) => OwnAddable | undefined;
}

let current: OwnTrip | null = null;
const listeners = new Set<() => void>();

export const publishOwn = (o: OwnTrip | null): void => {
  current = o;
  listeners.forEach((l) => l());
};
/** The own trip published for `slug` (the public trip's slug), or null on every other page. */
export const getOwn = (slug: string): OwnTrip | null => (current && current.slug === slug ? current : null);
export const peekOwn = (): OwnTrip | null => current;
export const subscribeOwn = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
