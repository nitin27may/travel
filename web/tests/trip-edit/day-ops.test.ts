import { describe, expect, it } from 'vitest';
import { applyOps, type PlanOp } from '@travel/core/plan/ops.ts';
import { copyToPlanDraft } from '@travel/core/plan/doc.ts';
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import type { TimelineEntry } from '@travel/core/schedule/types.ts';
import { daySlots, dayWordOf, nOfRef, refOfDay } from '@/lib/trip-edit/dayMap';
import { changeRows } from '@/lib/trip-edit/changes';
import { entryMarks } from '@/lib/trip-edit/marks';
import { moveToDayOps, noteOps, removeOps } from '@/lib/trip-edit/stopOps';
import { levelLines } from '@/lib/trip-edit/dayWarnings';
import { addDayBlock, addDayOps, addedDayNumber, bookingQuestion, dayBookings, dayChanged, dayCount, dayNoteOf, dayNoteOps, dropDayOps, droppedWords, dropStops, insertAfterOf, resetDayOps, versionOps } from '@/components/trips/edit/day/dayOps';
import { bookingsLine, lengthLine, lengthOps, stayingDay } from '@/components/trips/edit/settings/lengthPlan';
import { copy } from './helpers';

// STEP2-E4: day numbers against the document's refs, the day actions' operations, and the length change of the Dates section.
const base = (): PlanDraft => (copyToPlanDraft(copy({ overrides: {} })) as { success: true; data: PlanDraft }).data;
let n = 0;
const id = (): string => `o-d${++n}`;
const apply = (d: PlanDraft, ops: PlanOp[]): PlanDraft => {
  const r = applyOps(d, ops);
  expect(r.skipped).toEqual([]);
  return r.doc;
};
const days = (d: PlanDraft) => d.template!.days;
const entry = (over: Partial<TimelineEntry> = {}): TimelineEntry =>
  ({ id: 'seceda', day: 3, lane: 'all', kind: 'visit', sub: 'sight', title: 'Seceda ridge', start: '10:00', durationMin: 60, end: '11:00', tz: 'Europe/Rome', at: { name: 'Seceda', placeSlug: 'seceda', point: null }, from: null, to: null, time: { confidence: 'suggested', source: 'plan', pinned: false, note: null }, duration: { source: 'plan', basis: '' }, optional: false, addedBy: 'author', sourceItemId: 'seceda', honesty: [], ...over }) as TimelineEntry;

describe('day numbers and refs', () => {
  it('are the same while the copy has no day edits', () => {
    expect(refOfDay([], 4)).toBe(4);
    expect(nOfRef([], 4)).toBe(4);
    expect(nOfRef([], 'o-x')).toBeNull();
  });

  it('shift past an added day and back past a dropped one', () => {
    const d = apply(base(), [
      { kind: 'insertDay', id: 'o-ins', after: 2 },
      { kind: 'dropDay', id: 'o-drp', day: 5 },
    ]);
    // 1, 2, added, 3, 4, (5 dropped), 6 ...
    expect(daySlots(days(d), 7).map((s) => s.ref)).toEqual([1, 2, 'o-ins', 3, 4, 6, 7]);
    expect(refOfDay(days(d), 3)).toBe('o-ins');
    expect(refOfDay(days(d), 4)).toBe(3);
    expect(refOfDay(days(d), 6)).toBe(6);
    expect(nOfRef(days(d), 3)).toBe(4);
    expect(nOfRef(days(d), 5)).toBeNull();
    expect(nOfRef(days(d), 'o-ins')).toBe(3);
    expect(dayWordOf(days(d), 5)).toBe('Day 5 of our plan');
    expect(dayWordOf(days(d), 'o-gone')).toBe('a day you added');
  });

  it('puts days added before Day 1 first, and days added at the same place in operation order', () => {
    const d = apply(base(), [
      { kind: 'insertDay', id: 'o-a', after: 0 },
      { kind: 'insertDay', id: 'o-b', after: 1 },
      { kind: 'insertDay', id: 'o-c', after: 1 },
    ]);
    expect(daySlots(days(d), 5).map((s) => s.ref)).toEqual(['o-a', 1, 'o-b', 'o-c', 2]);
  });
});

describe('stop operations name the document\'s days', () => {
  it('removes a stop by its published day after a day was added before it', () => {
    const d = apply(base(), [{ kind: 'insertDay', id: 'o-ins', after: 1 }]);
    // published Day 3 now shows as Day 4
    const ops = removeOps(d, { id: 'seceda', day: 4, title: 'Seceda ridge', addedBy: 'author', at: { placeSlug: 'seceda' } }, id);
    expect(ops).toEqual([expect.objectContaining({ kind: 'removePlace', day: 3, item: 'seceda' })]);
    expect(applyOps(d, ops).skipped).toEqual([]);
  });

  it('moves a stop to Day n by the ref of that day, an added day included', () => {
    const d = apply(base(), [{ kind: 'insertDay', id: 'o-ins', after: 1 }]);
    const stop = { id: 'seceda', day: 4, title: 'Seceda ridge', addedBy: 'author', at: { placeSlug: 'seceda' } };
    expect(moveToDayOps(d, stop, 2, null, id)[0]).toMatchObject({ kind: 'moveItem', day: 3, toDay: 'o-ins' });
    expect(moveToDayOps(d, stop, 5, null, id)[0]).toMatchObject({ kind: 'moveItem', day: 3, toDay: 4 });
  });

  it('keys a stop note on the published stop and a day note on the day', () => {
    const d = apply(base(), [{ kind: 'insertDay', id: 'o-ins', after: 1 }]);
    const stop = { id: 'seceda', day: 4, title: 'Seceda ridge', addedBy: 'author', at: { placeSlug: 'seceda' } };
    expect(noteOps(d, stop, 'Bring snacks', id)[0]).toMatchObject({ key: '3:seceda' });
    expect(dayNoteOps(d, 4, 'Early start', id)[0]).toMatchObject({ key: '3' });
    expect(dayNoteOps(d, 2, 'Rest day', id)[0]).toMatchObject({ key: 'o-ins' });
  });

  it('marks a moved stop "Moved from Day n" with the numbers the page shows', () => {
    let d = base();
    d = apply(d, [{ kind: 'moveItem', id: 'o-mv', day: 3, item: 'seceda', toDay: 5 }]);
    d = apply(d, [{ kind: 'insertDay', id: 'o-ins', after: 1 }]);
    // Day 3 shows as Day 4, Day 5 as Day 6
    expect(entryMarks(d)({ id: 'seceda', day: 6, addedBy: 'author' })).toEqual(['Moved from Day 4']);
    expect(entryMarks(d)({ id: 'seceda', day: 5, addedBy: 'author' })).toEqual([]);
  });
});

describe('Add a day', () => {
  it('is an insertDay after the published day it follows, and an added day follows the day it was added after', () => {
    let d = base();
    expect(addDayOps(d, 2, id)).toEqual([{ kind: 'insertDay', id: expect.any(String), after: 2 }]);
    d = apply(d, [{ kind: 'insertDay', id: 'o-ins', after: 2 }]);
    // Day 3 is the added day: a day after it follows published Day 2 as well
    expect(insertAfterOf(d, 3)).toBe(2);
    expect(insertAfterOf(d, 4)).toBe(3);
    expect(insertAfterOf(d, 1)).toBe(1);
  });

  it('says the number the new day will show', () => {
    const d = apply(base(), [{ kind: 'insertDay', id: 'o-a', after: 2 }]);
    const op = addDayOps(d, 3, () => 'o-b')[0]!;
    expect(addedDayNumber(d, op)).toBe(4);
  });

  it('stops at the cap of day operations', () => {
    let d = base();
    expect(addDayBlock(d, 14)).toBeNull();
    for (let i = 0; i < 10; i++) d = apply(d, [{ kind: 'insertDay', id: `o-c${i}`, after: 1 }]);
    expect(addDayBlock(d, 14)).toMatch(/at most 10/);
    expect(dayCount(d, 14)).toBe(24);
  });

  it('is undone by its inverse', () => {
    const d = base();
    const r = applyOps(d, addDayOps(d, 2, id));
    expect(applyOps(r.doc, r.inverse).doc.template!.days).toEqual([]);
  });
});

describe('Drop Day n', () => {
  const stops = [entry({ id: 'seceda' }), entry({ id: 'add-pyramid-lake', title: 'Pyramid Lake', addedBy: 'visitor', at: { name: 'Pyramid Lake', placeSlug: 'pyramid-lake', point: null } })];

  it('moves the stops to another day by the ref of that day, in one step that Undo takes back', () => {
    const d = base();
    const ops = dropDayOps(d, 7, { kind: 'move', to: 6 }, stops, id);
    expect(ops).toEqual([{ kind: 'dropDay', id: expect.any(String), day: 7, to: 6 }]);
    const r = applyOps(d, ops);
    expect(r.skipped).toEqual([]);
    expect(r.doc.template!.days).toEqual([expect.objectContaining({ kind: 'drop', day: 7, to: 6 })]);
    expect(r.doc.nights).toBe((d.nights ?? 0) - 1);
    expect(applyOps(r.doc, r.inverse).doc.template!.days).toEqual([]);
  });

  it('puts the stops with a place page into Maybe and drops the day, as one step', () => {
    const d = base();
    const ops = dropDayOps(d, 7, { kind: 'maybe' }, stops, id);
    expect(ops.map((o) => o.kind)).toEqual(['addMaybe', 'addMaybe', 'dropDay']);
    const r = applyOps(d, ops);
    expect(r.doc.template!.maybe.map((m) => m.ref)).toEqual(['place/seceda', 'place/pyramid-lake']);
    const back = applyOps(r.doc, r.inverse).doc;
    expect(back.template!.maybe).toEqual([]);
    expect(back.template!.days).toEqual([]);
  });

  it('removes the stops with the day', () => {
    const d = base();
    expect(dropDayOps(d, 7, { kind: 'remove' }, stops, id)).toEqual([{ kind: 'dropDay', id: expect.any(String), day: 7 }]);
  });

  it('names an added day by its operation id, and a target day by the number it shows now', () => {
    const d = apply(base(), [{ kind: 'insertDay', id: 'o-ins', after: 2 }]);
    expect(dropDayOps(d, 3, { kind: 'move', to: 2 }, stops, id)[0]).toMatchObject({ day: 'o-ins', to: 2 });
    expect(dropDayOps(d, 4, { kind: 'move', to: 3 }, stops, id)[0]).toMatchObject({ day: 3, to: 'o-ins' });
    const gone = applyOps(d, dropDayOps(d, 3, { kind: 'remove' }, [], id)).doc;
    expect(gone.template!.days).toEqual([]);
  });

  it('keeps only the stops of the plan and the person, not the rows the rules made', () => {
    const rows = [...stops, entry({ id: '3-all-meal-lunch', kind: 'meal', addedBy: 'scheduler', sourceItemId: null }), entry({ id: 'x', kind: 'leg', sourceItemId: null })];
    expect(dropStops(rows).map((e) => e.id)).toEqual(['seceda', 'add-pyramid-lake']);
  });

  it('tells a day with a booking from one without', () => {
    const tl = { entries: [entry({ id: 'canoe', title: 'Maligne canoe' }), entry({ id: '3-all-booking', kind: 'booking', title: 'Check in for Maligne canoe', bookingOf: 'canoe', addedBy: 'scheduler', sourceItemId: null })] };
    expect(dayBookings(tl, [], 3)).toEqual(['Maligne canoe']);
    expect(dayBookings({ entries: [entry()] }, [], 3)).toEqual([]);
    expect(dayBookings({ entries: [entry()] }, [{ name: 'Tre Cime toll', day: 3 }, { name: 'Elsewhere', day: 4 }], 3)).toEqual(['Tre Cime toll']);
    expect(bookingQuestion(7, ['canoe'])).toBe('Drop Day 7 and its canoe booking?');
    expect(bookingQuestion(7, ['a', 'b'])).toBe('Drop Day 7 and its 2 bookings?');
  });

  it('words the toast after the numbering that follows the drop', () => {
    expect(droppedWords(7, { kind: 'move', to: 6 }, 2)).toBe('Dropped Day 7 · its 2 stops moved to Day 6');
    expect(droppedWords(3, { kind: 'move', to: 5 }, 1)).toBe('Dropped Day 3 · its stop moved to Day 4');
    expect(droppedWords(7, { kind: 'maybe' }, 2)).toBe('Dropped Day 7 · its 2 stops are in Maybe');
    expect(droppedWords(7, { kind: 'remove' }, 0)).toBe('Dropped Day 7');
  });
});

describe('Reset Day n, notes and versions', () => {
  it('resets one published day and nothing for an added one', () => {
    let d = base();
    d = apply(d, [{ kind: 'removePlace', id: 'o-r', day: 3, item: 'seceda' }]);
    expect(dayChanged(d, 3)).toBe(true);
    expect(dayChanged(d, 4)).toBe(false);
    const ops = resetDayOps(d, 3, id)!;
    expect(applyOps(d, ops).doc.template!.removed).toEqual([]);
    d = apply(d, [{ kind: 'insertDay', id: 'o-ins', after: 1 }]);
    expect(resetDayOps(d, 2, id)).toBeNull();
    // Day 3 shows as Day 4 now, and still resets as published Day 3
    expect(resetDayOps(d, 4, id)![0]).toMatchObject({ day: 3 });
  });

  it('keeps and removes a day note', () => {
    let d = base();
    d = apply(d, dayNoteOps(d, 2, '  Slow morning  ', id));
    expect(dayNoteOf(d, 2)).toBe('Slow morning');
    d = apply(d, dayNoteOps(d, 2, '', id));
    expect(dayNoteOf(d, 2)).toBe('');
  });

  it('sets a version of a published day', () => {
    const d = base();
    expect(versionOps(d, 5, 'C', id)![0]).toMatchObject({ kind: 'setVariant', day: 5, variant: 'C' });
    expect(applyOps(d, versionOps(d, 5, 'C', id)!).doc.template!.overrides).toEqual({ '5': 'C' });
  });
});

describe('the changes list reads days as the page shows them', () => {
  const names = { item: (s: string) => (s === 'seceda' ? 'Seceda ridge' : null), place: () => null };
  it('says Day n by the current numbering, and "of our plan" for a dropped day', () => {
    let d = base();
    d = apply(d, [{ kind: 'removePlace', id: 'o-r', day: 3, item: 'seceda' }, { kind: 'insertDay', id: 'o-ins', after: 1 }, { kind: 'dropDay', id: 'o-drp', day: 6 }]);
    const text = changeRows(d, names, id).map((r) => r.text);
    expect(text).toContain('Removed Seceda ridge from Day 4');
    expect(text).toContain('Added Day 2');
    expect(text).toContain('Dropped Day 6 of our plan');
  });
});

describe('the length change of the Dates section', () => {
  const stops = (m: Record<number, number>) => (d: number) => Array.from({ length: m[d] ?? 0 }, (_, i) => entry({ id: `s${d}-${i}` }));
  it('adds days after a day, or at the end', () => {
    const d = base();
    const ops = lengthOps(d, { kind: 'add', count: 2, after: 4 }, 14, stops({}), id);
    expect(ops).toEqual([expect.objectContaining({ kind: 'insertDay', after: 4 }), expect.objectContaining({ kind: 'insertDay', after: 4 })]);
    expect(daySlots(apply(d, ops).template!.days, 8).map((s) => s.ref).slice(3, 8)).toEqual([4, expect.any(String), expect.any(String), 5, 6]);
    expect(lengthLine({ kind: 'add', count: 2, after: 4 }, 14, stops({}))).toBe('Add 2 days · after Day 4');
    expect(lengthLine({ kind: 'add', count: 1, after: 14 }, 14, stops({}))).toBe('Add 1 day · at the end');
  });

  it('drops the last day and moves its stops to the day before', () => {
    const d = base();
    const ops = lengthOps(d, { kind: 'drop', days: [14], how: 'move' }, 14, stops({ 14: 2 }), id);
    expect(ops).toEqual([expect.objectContaining({ kind: 'dropDay', day: 14, to: 13 })]);
    expect(lengthLine({ kind: 'drop', days: [14], how: 'move' }, 14, stops({ 14: 2 }))).toBe('Drop Day 14 · their 2 stops move to Day 13');
    expect(lengthLine({ kind: 'drop', days: [14], how: 'remove' }, 14, stops({ 14: 1 }))).toBe('Drop Day 14 · its stop is removed');
    expect(lengthLine({ kind: 'drop', days: [14], how: 'move' }, 14, stops({}))).toBe('Drop Day 14 · no stops on it');
  });

  it('sends the stops of several dropped days to the day that stays', () => {
    const d = base();
    const ops = lengthOps(d, { kind: 'drop', days: [13, 14], how: 'move' }, 14, stops({ 13: 1, 14: 1 }), id);
    expect(ops.map((o) => (o as { day: number; to: number }).to)).toEqual([12, 12]);
    expect(applyOps(d, ops).skipped).toEqual([]);
    expect(stayingDay(1, 14, new Set([1, 2]))).toBe(3);
    expect(stayingDay(1, 2, new Set([1, 2]))).toBeNull();
    expect(bookingsLine([6, 7], ['canoe'])).toBe('Drop Days 6 and 7 and its canoe booking?');
  });
});

describe('warnings at rest on a day', () => {
  it('gives one line per level, Fix first, with how many more', () => {
    const lines = levelLines([
      { code: 'W_HOURS', message: 'Closed on Mondays.' },
      { code: 'S_DAY_CAP', message: 'The day runs long.' },
      { code: 'W_PACE', message: 'A lot for the pace.' },
      { code: 'W_UNKNOWN_FUTURE', message: 'Nothing is shown for a code we do not know.' },
    ]);
    expect(lines.map((l) => l.level)).toEqual(['fix', 'check']);
    expect(lines[0]).toMatchObject({ word: 'To fix', text: 'Closed on Mondays.', more: 0 });
    expect(lines[1]).toMatchObject({ word: 'To check', more: 1 });
  });
});
