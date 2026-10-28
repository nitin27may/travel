// How a place fits a day (edit-mode-spec 7.3): "fits after Maligne Canyon · +15 min ≈ · ends 17:55", "Day full", or a Fix-level reason. Read
// from the template scheduler by trying the addition on the day, as the Move to day list does for a move (lib/trip-edit/moveFit.ts), so the
// words are the day the person gets after Add. Pure over the engine.
import { warnLevel } from '@/lib/trip-edit/model';
import { fmtHM } from '@travel/core/schedule/rules.ts';
import type { DayTimeline, Profile, ScheduleDayInput, ScheduleItem, TimelineEntry } from '@travel/core/schedule/types.ts';
import { candidateToItem, type AddCandidate } from '@/components/trips/timeline/model';
import { LATEST_END } from '@/components/trips/timeline/consequence';
import type { SourceDelta, TemplateEngine } from '@/components/trips/timeline/useTimeline';
import type { TimelineModel } from '@/components/trips/timeline/model';
import { effectiveDays, type Effective } from '../day/effective';
import type { OnTrip } from './rows';

export interface Fit {
  state: 'fits' | 'tight' | 'full' | 'fix';
  /** the second line of the row */
  words: string;
  /** "17:55", or null for a plan in parts of the day */
  ends: string | null;
  /** minutes of driving the addition brings; 0 when none */
  driveMin: number;
}

export interface FitEnv {
  engine: TemplateEngine;
  days: { n: number; input: ScheduleDayInput }[];
  delta: SourceDelta;
  overrides: Record<string, string>;
  profile: Profile;
  /** every place the delta's additions name, by slug */
  candidates: Readonly<Record<string, AddCandidate>>;
  /** the published model: with inserted or dropped days the picker reads the days as the page shows them (STEP2-INT) */
  model?: TimelineModel;
}

const PREVIEW = 'preview';
const toMin = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const key = (w: { code: string; message: string }): string => `${w.code}|${w.message}`;
const short = (s: string): string => {
  const one = s.split(/(?<=[.!?])\s/)[0] ?? s;
  return one.length > 64 ? `${one.slice(0, 61)}...` : one;
};

/** The entries that are stops of a place: not a leg, the sun, a booking row or a row inside another. */
export const isStopEntry = (e: TimelineEntry): boolean => !!e.sourceItemId && !e.insideOf && !e.block && e.kind !== 'sun' && e.kind !== 'leg' && e.kind !== 'booking';

export interface Fitter {
  /** the copy's days as they stand now, by the day number the page shows */
  base: ReadonlyMap<number, DayTimeline>;
  /** the days as the page draws them once a day was inserted or dropped; null for a copy with its published days */
  eff: Effective | null;
  /** the document's name for a shown day: a published number, or an inserted day's operation id */
  refOf: (n: number) => number | string;
  /** where each place stands now, by slug and by schedule id */
  onTrip: Map<string, OnTrip>;
  /** the schedule id of a day's last stop, so a move lands at the end of the day */
  lastStop: (day: number) => string | null;
  /** the day with the place added, as words */
  fit: (c: AddCandidate, day: number) => Fit;
}

export function makeFitter(env: FitEnv): Fitter {
  const schedule = (delta: SourceDelta, items: Map<string, ScheduleItem>) =>
    env.engine.scheduleTemplate(
      env.days.map((d) => d.input),
      {
        overrides: env.overrides,
        added: delta.added.flatMap((a) => {
          const item = items.get(a.slug);
          return item ? [{ op: a.op, day: a.day, item, ...(a.after ? { after: a.after } : {}) }] : [];
        }),
        removed: delta.removed,
        moved: delta.moved,
        days: delta.days ?? [],
      },
      env.profile,
    );
  const run = (delta: SourceDelta, items: Map<string, ScheduleItem>): Map<number, DayTimeline> => new Map(schedule(delta, items).days.map((d) => [d.n, d.timeline]));
  const known = new Map(Object.entries(env.candidates).map(([k, c]) => [k, candidateToItem(c)]));
  const first = schedule(env.delta, known);
  // with a day inserted or dropped the numbers shift and the entries carry the published day: read them as the page does (E4's `effectiveDays`)
  const eff = env.model && env.delta.days?.length ? effectiveDays(env.model, first) : null;
  const base = new Map((eff ? eff.timelines : first.days.map((d) => d.timeline)).map((t, i) => [first.days[i]!.n, t] as const));
  const refs = new Map(first.days.map((d) => [d.n, d.ref] as const));
  const refOf = (n: number): number | string => refs.get(n) ?? n;

  const onTrip = new Map<string, OnTrip>();
  for (const [n, t] of [...base].sort((a, b) => a[0] - b[0])) {
    for (const e of t.entries) {
      if (!isStopEntry(e)) continue;
      const v = { day: n, entry: e };
      if (e.at?.placeSlug && !onTrip.has(e.at.placeSlug)) onTrip.set(e.at.placeSlug, v);
      if (e.sourceItemId && !onTrip.has(e.sourceItemId)) onTrip.set(e.sourceItemId, v);
    }
  }
  const lastStop = (day: number): string | null => [...(base.get(day)?.entries ?? [])].reverse().find((e) => isStopEntry(e))?.id ?? null;

  const fit = (c: AddCandidate, day: number): Fit => {
    const was = base.get(day);
    const withIt = new Map(known).set(c.key, candidateToItem(c));
    const now = run({ ...env.delta, added: [...env.delta.added, { op: PREVIEW, day: refOf(day), slug: c.key }] }, withIt).get(day);
    if (!now || !was) return { state: 'fits', words: 'fits the day', ends: null, driveMin: 0 };
    const before = new Set(was.warnings.map(key));
    const fresh = now.warnings.filter((w) => !before.has(key(w)));
    const fixes = fresh.filter((w) => warnLevel(w.code) === 'fix');
    const cap = fresh.some((w) => w.code === 'S_DAY_CAP');
    const late = !now.blocks && !!now.span.end && toMin(now.span.end) > toMin(LATEST_END);
    const checks = fresh.filter((w) => warnLevel(w.code) === 'check' || (warnLevel(w.code) === null && w.code.startsWith('S_')));
    const driveMin = Math.max(0, now.totals.driveMin - was.totals.driveMin);
    const ends = now.blocks ? null : now.span.end || null;
    if (cap || late) return { state: 'full', words: 'Day full', ends, driveMin };
    if (fixes.length) return { state: 'fix', words: short(fixes[0]!.message), ends, driveMin };
    const stops = now.entries.filter(isStopEntry);
    const at = stops.findIndex((e) => e.sourceItemId === `add-${c.key}`);
    const prev = [...stops.slice(0, Math.max(0, at))].reverse().find((e) => e.kind === 'visit' || e.kind === 'trail');
    const parts = [
      prev ? `fits after ${prev.title}` : 'fits at the start of the day',
      driveMin >= 5 ? `+${fmtHM(driveMin)} ≈` : null,
      ends ? `ends ${ends}` : null,
    ].filter(Boolean);
    return { state: checks.length ? 'tight' : 'fits', words: parts.join(' · '), ends, driveMin };
  };
  return { base, eff, refOf, onTrip, lastStop, fit };
}
