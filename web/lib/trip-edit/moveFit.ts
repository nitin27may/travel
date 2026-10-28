// The Move to day list (edit-mode-spec 5.1; components 8.7): each day with its base, the day's end, the driving change and Fits or Tight,
// read from the scheduler by trying the move on each day. Nothing is ever disabled because of a warning (Q-BE6); a Fix-level reason says
// why in words and the day stays choosable. Pure over the engine, the model's day inputs and the document.
import { warnLevel } from '@travel/core/plan/warnings.ts';
import type { DayTimeline, Profile, ScheduleDayInput, ScheduleItem } from '@travel/core/schedule/types.ts';
import { fmtHM } from '@travel/core/schedule/rules.ts';
import type { SourceDelta } from '@/components/trips/timeline/useTimeline';
import type { TemplateEngine } from '@/components/trips/timeline/useTimeline';

export interface DayChoice {
  n: number;
  /** "Day 4 · Thu 1 Jul" or "Day 4" */
  label: string;
  base: string | null;
  current: boolean;
  /** "ends 17:55" */
  ends: string | null;
  /** "+35 min driving" or "-10 min driving"; null when it does not change */
  driving: string | null;
  fit: 'fits' | 'tight' | 'fix';
  reason: string | null;
  /** the schedule id of the day's last stop, so a move lands at the end of the day */
  last: string | null;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Thu 1 Jul" for day `n` of a trip that starts on `start` (an ISO date), or null when undated. */
export function dayDate(start: string | null, n: number): string | null {
  if (!start) return null;
  const t = new Date(`${start}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n - 1);
  return `${DOW[t.getUTCDay()]} ${t.getUTCDate()} ${MON[t.getUTCMonth()]}`;
}

const key = (w: { code: string; message: string }): string => `${w.code}|${w.message}`;
const short = (s: string): string => {
  const one = s.split(/(?<=[.!?])\s/)[0] ?? s;
  return one.length > 64 ? `${one.slice(0, 61)}...` : one;
};

interface Args {
  engine: TemplateEngine;
  days: { n: number; base: string | null; input: ScheduleDayInput }[];
  delta: SourceDelta;
  overrides: Record<string, string>;
  profile: Profile;
  addItem: (a: SourceDelta['added'][number]) => ScheduleItem | null;
  start: string | null;
  /** the stop being moved: its published day and schedule id (it may already be moved), or an added place's operation id */
  stop: { id: string; day: number; from: number; added: string | null };
}

function schedule(a: Args, delta: SourceDelta): Map<number, DayTimeline> {
  const out = a.engine.scheduleTemplate(
    a.days.map((d) => d.input),
    {
      overrides: a.overrides,
      added: delta.added.flatMap((x) => {
        const item = a.addItem(x);
        return item ? [{ op: x.op, day: x.day, item, ...(x.after ? { after: x.after } : {}) }] : [];
      }),
      removed: delta.removed,
      moved: delta.moved,
      days: [],
    },
    a.profile,
  );
  return new Map(out.days.map((d) => [d.ref as number, d.timeline]));
}

/** The last stop of a day's timeline: an entry with a source id that is not a leg, the sun or a booking. */
const lastOf = (t: DayTimeline | undefined): string | null => [...(t?.entries ?? [])].reverse().find((e) => !!e.sourceItemId && !e.insideOf && e.kind !== 'leg' && e.kind !== 'sun' && e.kind !== 'booking')?.id ?? null;

export function dayChoices(a: Args): DayChoice[] {
  const base = schedule(a, a.delta);
  return a.days.map((d) => {
    const date = dayDate(a.start, d.n);
    const label = date ? `Day ${d.n} · ${date}` : `Day ${d.n}`;
    const was = base.get(d.n);
    if (d.n === a.stop.from) return { n: d.n, label, base: d.base, current: true, ends: null, driving: null, fit: 'fits' as const, reason: null, last: lastOf(was) };
    const move = a.stop.added
      ? { ...a.delta, added: a.delta.added.map((x) => (x.op === a.stop.added ? { ...x, day: d.n, after: undefined } : x)) }
      : { ...a.delta, moved: [...a.delta.moved.filter((m) => !(m.day === a.stop.day && m.item === a.stop.id)), { op: 'preview', day: a.stop.day, item: a.stop.id, toDay: d.n }] };
    const now = schedule(a, move).get(d.n);
    if (!now || !was) return { n: d.n, label, base: d.base, current: false, ends: null, driving: null, fit: 'fits' as const, reason: null, last: lastOf(was) };
    const before = new Set(was.warnings.map(key));
    const fresh = now.warnings.filter((w) => !before.has(key(w)));
    const fixes = fresh.filter((w) => warnLevel(w.code) === 'fix');
    // the scheduler's own S_ notes (a fixed slot missed, a day over its cap) are not in WARN_LEVEL: they read as Tight
    const checks = fresh.filter((w) => warnLevel(w.code) === 'check' || (warnLevel(w.code) === null && w.code.startsWith('S_')));
    const dd = now.totals.driveMin - was.totals.driveMin;
    return {
      n: d.n,
      label,
      base: d.base,
      current: false,
      ends: now.span.end || null,
      driving: dd === 0 ? null : `${dd > 0 ? '+' : '-'}${fmtHM(Math.abs(dd))} driving`,
      fit: fixes.length ? 'fix' : checks.length ? 'tight' : 'fits',
      reason: fixes.length ? short(fixes[0]!.message) : null,
      last: lastOf(was),
    };
  });
}
