'use client';

// The calendar file of the person's own trip, made in one place (review STEP2-PRV PR-011). The cover's Add to calendar and Mine's Add to calendar
// both end here: the export model is read once, and the file is built by own.ts from the timelines the trip page shows for the person's
// document (their removals, additions, moves and notes), with the LOCATION and GEO of each stop. Mine holds no timeline, so it hands off as
// Print does (patterns 3.8, spec 5.2): it leaves the copy's id in sessionStorage and opens `/t/<id>/`, and the shell answers once the page has
// published its timelines. Read once and removed at once, so a reload or a shared link never downloads anything. Small on purpose: this file is
// in the /t/ start code; the builders load on demand.
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { readSession, removeSession, writeSession } from '@/lib/storage/safe';
import { getOwn, subscribeOwn } from './ownState';
import { getTimeline, subscribeTimeline } from './timelineState';
import type { TripExport } from './types';

/** The one-shot calendar hand-off (sessionStorage): Mine writes the copy's id, the copy's page reads it once and removes it. */
export const CALENDAR_KEY = 'travel.mine.calendar';

/** Mine's Add to calendar: false when storage is blocked (the copy then simply opens, and its cover's Add to calendar is one tap away). */
export const requestCalendar = (id: string): boolean => writeSession(CALENDAR_KEY, id);

/** True once, on the page of the copy Mine asked for; the request is removed either way it matches. */
export function takeCalendarRequest(id: string): boolean {
  if (readSession(CALENDAR_KEY) !== id) return false;
  removeSession(CALENDAR_KEY);
  return true;
}

export interface CalendarArgs {
  /** the key the page publishes its timelines and own trip under: the public slug of a copy, or BUILT_KEY */
  key: string;
  /** the public trip's slug of a copy (its export model is read under it); null for a built trip */
  slug: string | null;
  start: string;
  /** a built trip's export model, made on the device (never fetched under its id) */
  device?: TripExport;
}

/** The calendar file of the trip on the page, and what the toast says. Throws NoCalendarError for an overview. */
export async function downloadTripCalendar(a: CalendarArgs): Promise<{ name: string; summary: string }> {
  const c = await import('./client');
  const d = a.device ?? (await c.loadExport('trip', a.slug!));
  const mine = getOwn(a.key);
  const sess = getTimeline(a.key);
  if (mine && sess) return (await import('./own')).downloadOwnIcs(d, sess, mine);
  // the page has not published its days (a trip with no plan model): the published plan's days, the only file there is
  return c.downloadIcs(d as Parameters<typeof c.downloadIcs>[0], a.start);
}

/** The toast after a calendar attempt. */
export function calendarMessage(r: { name: string; summary: string } | { error: unknown }): string {
  if ('name' in r) return `Downloaded ${r.name} · ${r.summary}`;
  const e = r.error as Error | null;
  return e?.name === 'NoCalendarError' || e?.constructor?.name === 'NoCalendarError' ? 'This trip has no day plan to put in a calendar.' : 'Could not build that file. Try again.';
}

/**
 * The shell's side of Mine's hand-off: armed once on the copy's page when Mine asked for its calendar, it runs the same builder as the cover's
 * button as soon as the page has published the person's own trip and timelines that are theirs (not the server's first answer, which shows
 * the published versions until the scheduler has run). No timer: a page that never publishes them never downloads.
 */
export function useCalendarHandOff(a: { id: string; key: string | null; slug: string | null; start: string | null }, say: (message: string) => void): void {
  const armed = useRef<boolean | null>(null);
  const ready = useSyncExternalStore(
    (l) => {
      const u1 = subscribeOwn(l);
      const u2 = subscribeTimeline(l);
      return () => {
        u1();
        u2();
      };
    },
    // the person's days: the own trip and the timelines published, and the scheduler done with the copy's versions and additions
    () => !!a.key && !!getOwn(a.key) && getTimeline(a.key)?.pending === false,
    () => false,
  );
  useEffect(() => {
    if (armed.current === null) armed.current = takeCalendarRequest(a.id);
    if (!armed.current || !ready || !a.key || !a.slug || !a.start) return;
    armed.current = false;
    void downloadTripCalendar({ key: a.key, slug: a.slug, start: a.start }).then(
      (r) => say(calendarMessage(r)),
      (error: unknown) => say(calendarMessage({ error })),
    );
  }, [a.id, a.key, a.slug, a.start, ready, say]);
}
