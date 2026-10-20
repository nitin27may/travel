'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { isChanged, parseTimelineUrl, serialiseTimelineUrl, type TimelineUrlState } from '@travel/core/schedule/profileCodec.ts';
import type { DayTimeline, Profile, ScheduleItem } from '@travel/core/schedule/types.ts';
import type { TripUrl } from '../useTripUrl';
import { candidateToItem, type TimelineModel } from './model';

export type Engine = typeof import('@travel/core/schedule/schedule.ts');

export interface TimelineApi {
  state: TimelineUrlState;
  /** The scheduler once it is loaded; null while the page still shows the server's timelines. */
  engine: Engine | null;
  /** True while the URL asks for a profile and the scheduler is still loading: the timelines are not the visitor's yet. */
  pending: boolean;
  /** Starts loading the scheduler (a menu or the add panel needs it before any URL change asks for it). */
  loadEngine: () => void;
  /** One timeline per day, for the profile in the URL. The server's default timelines when the URL has no profile keys. */
  timelines: DayTimeline[];
  /** Days with a version picked by hand, or with a place added. */
  changedDays: Set<number>;
  /** Anything differs from the plan's own settings. */
  changed: boolean;
  /** Added places the dataset no longer has (a link from before an update). */
  droppedAdds: number;
  /** Add keys by day, resolved. */
  added: Record<number, { key: string; item: ScheduleItem }[]>;
  setProfile: (patch: Partial<Profile>) => void;
  setVariant: (day: number, key: string | null) => void;
  addPlace: (day: number, key: string) => void;
  removePlace: (day: number, key: string) => void;
  reset: () => void;
}

/**
 * The visitor's profile, per-day versions and additions, all in the URL (spec 3.8). The page renders the default profile on the
 * server; the scheduler runs in the browser only when the URL asks for something else. A change pushes a history entry, so Back
 * restores the previous profile.
 */
export function useTimeline(model: TimelineModel, url: TripUrl): TimelineApi {
  const defaults = useMemo<Profile>(() => ({ ...model.defaultProfile, adults: 2 }), [model.defaultProfile]);
  const state = useMemo(() => parseTimelineUrl(url.timeline, defaults), [url.timeline, defaults]);
  const { added, droppedAdds } = useMemo(() => {
    const byDay: TimelineApi['added'] = {};
    let dropped = 0;
    for (const a of state.added) {
      const cand = model.addables[a.slug];
      const day = model.days.find((d) => d.n === a.day);
      if (!cand || !day || !model.addByDay[a.day]?.includes(a.slug)) {
        dropped += 1;
        continue;
      }
      (byDay[a.day] ??= []).push({ key: a.slug, item: candidateToItem(cand) });
    }
    return { added: byDay, droppedAdds: dropped };
  }, [state.added, model]);

  // the scheduler (about 12 kB gzipped) loads only when the URL asks for something other than the plan's own settings
  const plain = url.timeline === '';
  const [engine, setEngine] = useState<Engine | null>(null);
  const [wanted, setWanted] = useState(false);
  useEffect(() => {
    if ((plain && !wanted) || engine) return;
    let live = true;
    import('@travel/core/schedule/schedule.ts').then((m) => live && setEngine(m));
    return () => {
      live = false;
    };
  }, [plain, wanted, engine]);
  const loadEngine = useCallback(() => setWanted(true), []);
  const timelines = useMemo(() => {
    if (plain || !engine) return model.defaultTimelines;
    return engine.scheduleTrip(
      model.days.map((d) => d.input),
      state.profile,
      state.overrides,
      Object.fromEntries(Object.entries(added).map(([n, list]) => [Number(n), list.map((x) => x.item)])),
    );
  }, [plain, engine, model, state.profile, state.overrides, added]);

  const write = useCallback(
    (next: TimelineUrlState) => url.go({ view: url.view, hash: url.hash || undefined, timeline: serialiseTimelineUrl(next, defaults) }, 'push'),
    [url, defaults],
  );

  const changedDays = useMemo(() => new Set([...Object.keys(state.overrides).map(Number), ...state.added.map((a) => a.day)]), [state]);

  return {
    state, engine, pending: !plain && !engine, loadEngine, timelines, changedDays, changed: isChanged(state, defaults), droppedAdds, added,
    setProfile: (patch) => {
      const profile = { ...state.profile, ...patch };
      // adults only has no youngest; a family has one (default 6 when it was never set)
      if (profile.party === 'adults') profile.youngest = null;
      else profile.youngest ??= defaults.youngest ?? 6;
      write({ ...state, profile });
    },
    setVariant: (day, key) => {
      const overrides = { ...state.overrides };
      if (key === null) delete overrides[day];
      else overrides[day] = key;
      write({ ...state, overrides });
    },
    addPlace: (day, key) => write({ ...state, added: [...state.added, { day, slug: key }] }),
    removePlace: (day, key) => {
      const i = state.added.findIndex((a) => a.day === day && a.slug === key);
      if (i >= 0) write({ ...state, added: state.added.filter((_, j) => j !== i) });
    },
    reset: () => url.go({ view: url.view, hash: url.hash || undefined, timeline: '' }, 'push'),
  };
}
