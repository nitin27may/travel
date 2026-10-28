// The copy's days as the page draws them once the person has inserted or dropped days (STEP2-E4; core `scheduleTemplate` answers one
// `TemplateDay` per day shown). Loaded with the template scheduler, only when the document has a day edit, so the public page and an
// untouched copy never fetch it. Pure: the published model and the scheduler's answer in, the days, timelines and route to draw out.
//
// The page labels and links days by `TemplateDay.n` (Day 1, 2, 3 in order). A timeline's entries keep their generated ids, which carry the
// PUBLISHED day number (`5-all-meal-lunch`: the keys that remove a generated row read it), so only `day` is rewritten to `n`, never an id.
import type { DayTimeline, TemplateSchedule } from '@travel/core/schedule/types.ts';
import type { RouteModel } from '@/components/trips/model';
import type { TimelineDayModel, TimelineModel } from '@/components/trips/timeline/model';

/** One day of the copy: the published day's model with its new number, or a day the person added. */
export interface EffDay extends TimelineDayModel {
  /** the document's name for the day: the published number, or the operation id of the inserted day */
  ref: number | string;
  inserted: boolean;
}

export interface Effective {
  days: EffDay[];
  timelines: DayTimeline[];
  /** the displayed number of a published day or an inserted day's id, or null when it is dropped */
  nOf: (ref: number | string) => number | null;
  /** the route's days and base runs under the new numbers */
  route: (r: RouteModel) => RouteModel;
}

/** What an added day is called until the person writes a note on it. */
export const ADDED_DAY_TITLE = 'Your day';

export function effectiveDays(model: TimelineModel, out: TemplateSchedule): Effective {
  const days: EffDay[] = [];
  const timelines: DayTimeline[] = [];
  for (const x of out.days) {
    const own = typeof x.ref === 'number' ? model.days.find((d) => d.n === x.ref) : undefined;
    days.push(
      own
        ? { ...own, n: x.n, ref: x.ref, inserted: false, input: x.input }
        : {
            n: x.n, ref: x.ref, inserted: true, title: ADDED_DAY_TITLE, base: x.input.base?.name ?? null, thumb: null, glyph: 'calendar', summary: null, light: null,
            input: x.input, variants: [], know: [],
          },
    );
    timelines.push({ ...x.timeline, day: x.n, entries: x.timeline.entries.map((e) => ({ ...e, day: x.n })) });
  }
  const nOf = (ref: number | string): number | null => days.find((d) => d.ref === ref)?.n ?? null;
  return {
    days,
    timelines,
    nOf,
    route: (r) => ({
      ...r,
      days: days.map((d) => {
        const was = typeof d.ref === 'number' ? r.days.find((x) => x.n === d.ref) : undefined;
        return was ? { ...was, n: d.n } : { n: d.n, title: ADDED_DAY_TITLE, base: d.base, points: [], unplaced: 0 };
      }),
      bases: r.bases.map((b) => ({ ...b, days: days.filter((d) => (typeof d.ref === 'number' ? b.days.includes(d.ref) : d.base === b.name)).map((d) => d.n) })),
    }),
  };
}
