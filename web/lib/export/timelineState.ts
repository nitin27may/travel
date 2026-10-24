'use client';

// The trip page's current timeline, for the copy sheet and the calendar file (trip-timeline spec 3.9). The trip page publishes it
// as the profile, the overrides and the additions change; the sheet reads it when it opens. A module store, because the sheet
// is rendered outside the timeline's component tree. Nothing here is stored: a reload starts from the URL again.
import type { DayTimeline, Profile } from '@travel/core/schedule/types.ts';
import type { RouteModel } from '@/components/trips/model';

export interface TimelineSession {
  slug: string;
  profile: Profile;
  defaults: Profile;
  overrides: Record<number, string>;
  added: { day: number; placeSlug: string }[];
  timelines: DayTimeline[];
  /** The same days with the page's display marks applied (a time-zone line shifts the clock, a flight-tied time reads "about"): what the page's rows say, for the print. */
  display?: DayTimeline[];
  /** Where each day's sun times are computed, for the real dates of a copy. */
  sunPoints: Record<number, { lat: number; lon: number } | null>;
  /** The map's own route model (bases and placed points), so a route file is made from the same chain as the map. */
  route?: RouteModel;
}

let current: TimelineSession | null = null;
let onYoungest: ((age: number | null) => void) | null = null;
const listeners = new Set<() => void>();

export const publishTimeline = (s: TimelineSession | null): void => {
  current = s;
  listeners.forEach((l) => l());
};
export const getTimeline = (slug: string): TimelineSession | null => (current && current.slug === slug ? current : null);
export const subscribeTimeline = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
/** The trip page registers how a change of the youngest child in the copy sheet reaches the page's profile. */
export const registerYoungest = (fn: ((age: number | null) => void) | null): void => {
  onYoungest = fn;
};
/** The copy sheet's youngest child changed (null: no children): the page's profile follows. */
export const setYoungest = (age: number | null): void => onYoungest?.(age);
