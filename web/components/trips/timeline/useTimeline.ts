'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isChanged, parseTimelineUrl, serialiseTimelineUrl, type TimelineUrlState } from '@travel/core/schedule/profileCodec.ts';
import type { DayTimeline, Profile, ScheduleItem } from '@travel/core/schedule/types.ts';
import type { TripUrl } from '../useTripUrl';
import { candidateToItem, type TimelineModel } from './model';

export type Engine = typeof import('@travel/core/schedule/schedule.ts');

/** What a write changes, so a source that keeps operations (the document) can name them; the URL source needs only the next state. */
export type TimelineChange =
  | { kind: 'profile'; patch: Partial<Profile> }
  | { kind: 'variant'; day: number; key: string | null }
  | { kind: 'add'; day: number; slug: string }
  | { kind: 'remove'; day: number; slug: string }
  | { kind: 'reset' };

/**
 * Where the profile, the per-day versions and the additions live (STEP2-T1). On `/trips/<slug>/` they are the address (the URL source below,
 * today's code moved); on `/t/<id>/` they are the person's document, saved on the device and in the account (lib/trip-edit/source.ts).
 * The page reads `state` and calls `write`; nothing else about the timeline depends on the source.
 */
export interface TimelineSource {
  state: TimelineUrlState;
  /** The profile the plan was written for (the model's, with 2 adults). */
  defaults: Profile;
  /** The plan's own settings: the scheduler is not needed and the server's timelines stand. */
  plain: boolean;
  /** Anything differs from the plan's own settings. */
  changed: boolean;
  write: (next: TimelineUrlState, change: TimelineChange) => void;
  /** The person's own trip (STEP2-T1): their party line in place of the party bar, and the identity cell at the start of the sticky day bar. */
  chrome?: {
    party: (ctx: { model: TimelineModel; api: TimelineApi; edit: boolean; setEdit: (v: boolean) => void }) => ReactNode;
    lead: ReactNode;
  };
}

/** The address as a source: `?p=family-6&pace=relaxed&d=5C&add=5.moraine-lake`. A change pushes a history entry, so Back restores the previous state. */
function useUrlSource(model: TimelineModel, url: TripUrl): TimelineSource {
  const defaults = useMemo<Profile>(() => ({ ...model.defaultProfile, adults: 2 }), [model.defaultProfile]);
  const state = useMemo(() => parseTimelineUrl(url.timeline, defaults), [url.timeline, defaults]);
  return {
    state,
    defaults,
    plain: url.timeline === '',
    changed: isChanged(state, defaults),
    write: (next, change) => url.go({ hash: url.hash || undefined, timeline: change.kind === 'reset' ? '' : serialiseTimelineUrl(next, defaults) }, 'push'),
  };
}

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
export function useTimeline(model: TimelineModel, url: TripUrl, source?: TimelineSource): TimelineApi {
  const fromUrl = useUrlSource(model, url);
  const src = source ?? fromUrl;
  const { state, defaults, plain } = src;
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

  const write = src.write;

  const changedDays = useMemo(() => new Set([...Object.keys(state.overrides).map(Number), ...state.added.map((a) => a.day)]), [state]);

  return {
    state, engine, pending: !plain && !engine, loadEngine, timelines, changedDays, changed: src.changed, droppedAdds, added,
    setProfile: (patch) => {
      const profile = { ...state.profile, ...patch };
      // adults only has no youngest; a family has one (default 10 when it was never set)
      if (profile.party === 'adults') profile.youngest = null;
      else profile.youngest ??= defaults.youngest ?? 10;
      write({ ...state, profile }, { kind: 'profile', patch });
    },
    setVariant: (day, key) => {
      const overrides = { ...state.overrides };
      if (key === null) delete overrides[day];
      else overrides[day] = key;
      write({ ...state, overrides }, { kind: 'variant', day, key });
    },
    addPlace: (day, key) => write({ ...state, added: [...state.added, { day, slug: key }] }, { kind: 'add', day, slug: key }),
    removePlace: (day, key) => {
      const i = state.added.findIndex((a) => a.day === day && a.slug === key);
      if (i >= 0) write({ ...state, added: state.added.filter((_, j) => j !== i) }, { kind: 'remove', day, slug: key });
    },
    reset: () => write({ profile: defaults, overrides: {}, added: [] }, { kind: 'reset' }),
  };
}
