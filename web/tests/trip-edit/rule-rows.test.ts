import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyOps } from '@travel/core/plan/ops.ts';
import { copyToPlanDraft } from '@travel/core/plan/doc.ts';
import { scheduleTrip } from '@travel/core/schedule/schedule.ts';
import { scheduleTemplate } from '@travel/core/schedule/template.ts';
import type { ScheduleDayInput, TimelineEntry } from '@travel/core/schedule/types.ts';
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { changeRows } from '@/lib/trip-edit/changes';
import { changeCount } from '@/lib/trip-edit/marks';
import { ruleItemOfEntry, ruleName, ruleNote, ruleWords, rowName } from '@/lib/trip-edit/ruleRows';
import { deltaOfDraft } from '@/lib/trip-edit/source';
import { noteKeyOf, noteOps, removeOps, removedWords } from '@/lib/trip-edit/stopOps';
import { copy } from './helpers';

// STEP2-E1B: every row of a day can be removed. A row the rules made is removed by its rule key, comes back with Undo or Put it back,
// is named in the changes list, and warns in one line when the day still relies on it.
const ROCKIES = JSON.parse(readFileSync(fileURLToPath(new URL('../../../core/test/schedule/fixtures/rockies-trip.json', import.meta.url)), 'utf8')) as ScheduleDayInput[];
const FAMILY = { party: 'family', youngest: 6, pace: 'standard', adults: 2, walkKm: null, split: false } as const;
const PUB = scheduleTrip(ROCKIES, FAMILY);
const D1 = PUB[0]!.entries;
const row = (id: string): TimelineEntry => D1.find((e) => e.id === id)!;

const base = (): PlanDraft => (copyToPlanDraft(copy({ overrides: {} })) as { success: true; data: PlanDraft }).data;
let n = 0;
const id = (): string => `o-r${++n}`;

describe('which rows the rules made', () => {
  it('the hire car, check-in, meals, rests and the end are; stops, legs and the sun are not', () => {
    expect(ruleItemOfEntry(row('1-all-visit-car-hire-start'))).toBe('rule:all-car-hire');
    expect(ruleItemOfEntry(row('1-all-checkin-stay-bear-spray-groceries'))).toBe('rule:all-checkin');
    expect(ruleItemOfEntry(row('1-all-meal-lunch'))).toBe('rule:all-meal-lunch');
    expect(ruleItemOfEntry(row('1-all-end-at-base-close'))).toBe('rule:all-end');
    expect(ruleItemOfEntry(row('fenland-loop'))).toBeNull();
    expect(ruleItemOfEntry(row('1-all-leg-drive-fenland-loop'))).toBeNull();
    expect(ruleItemOfEntry(D1.find((e) => e.kind === 'sun')!)).toBeNull();
    // the slice the older stop actions passed (no kind) is never taken for a rule row
    expect(ruleItemOfEntry({ id: '1-all-meal-lunch', day: 1, addedBy: 'scheduler' })).toBeNull();
  });
});

describe('removing a row the rules made', () => {
  it('is one removePlace of its rule key on its day; the inverse puts it back and the document is as it was', () => {
    const d = base();
    const ops = removeOps(d, row('1-all-visit-car-hire-start'), id);
    expect(ops).toEqual([{ kind: 'removePlace', id: expect.any(String), day: 1, item: 'rule:all-car-hire' }]);
    const r = applyOps(d, ops);
    expect(r.skipped).toEqual([]);
    expect(r.doc.template?.removed).toEqual([{ op: ops[0]!.id, day: 1, item: 'rule:all-car-hire' }]);
    expect(changeCount(r.doc)).toBe(1);
    const back = applyOps(r.doc, r.inverse);
    expect(JSON.stringify(back.doc)).toBe(JSON.stringify(d));
  });
  it('the scheduler reads it from the document: the row leaves Day 1 and the drive to Banff moves up an hour', () => {
    const r = applyOps(base(), removeOps(base(), row('1-all-visit-car-hire-start'), id));
    const delta = deltaOfDraft(r.doc);
    const s = scheduleTemplate(ROCKIES, { overrides: {}, added: [], removed: delta.removed, moved: [], days: [] }, FAMILY);
    const d1 = s.days[0]!.timeline.entries;
    expect(d1.some((e) => e.sub === 'car-hire')).toBe(false);
    expect(d1.find((e) => e.id === '1-all-leg-drive-bear-spray-groceries')?.start).toBe('10:00');
  });
  it('names the toast by the row, and the end of the day by its drive', () => {
    expect(removedWords(row('1-all-meal-lunch'))).toBe('Removed Picnic lunch from Day 1');
    expect(removedWords(row('1-all-end-at-base-close'))).toBe('Removed the drive back to Banff from Day 1');
    expect(rowName(row('1-all-visit-car-hire-start'))).toBe('Collect the hire car');
  });
  it('takes a note keyed by its day and rule key', () => {
    const d = base();
    expect(noteKeyOf(d, row('1-all-meal-lunch'))).toBe('1:rule:all-meal-lunch');
    const r = applyOps(d, noteOps(d, row('1-all-meal-lunch'), 'Buy sandwiches in Calgary', id));
    expect(r.skipped).toEqual([]);
    expect(r.doc.template?.notes).toEqual({ '1:rule:all-meal-lunch': 'Buy sandwiches in Calgary' });
  });
});

describe('the changes list', () => {
  it('reads "Removed Collect the hire car from Day 1" with Put it back, which deletes the entry', () => {
    const r = applyOps(base(), removeOps(base(), row('1-all-visit-car-hire-start'), id));
    const names = { item: () => null, place: () => null, rule: (day: number, item: string) => ruleName(PUB, day, item) };
    const rows = changeRows(r.doc, names, id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ text: 'Removed Collect the hire car from Day 1', verb: 'Put it back', done: 'Restored Collect the hire car on Day 1' });
    expect(rows[0]!.ops).toEqual([{ kind: 'deleteEntry', id: expect.any(String), target: r.doc.template!.removed[0]!.op }]);
    expect(applyOps(r.doc, rows[0]!.ops).doc.template?.removed).toEqual([]);
  });
  it('falls back to plain words when no timeline shows the row, and names a note on one', () => {
    let d = applyOps(base(), [{ kind: 'removePlace', id: 'o-x1', day: 4, item: 'rule:all-rest-at-base-dinner' }]).doc;
    d = applyOps(d, [{ kind: 'setNote', id: 'o-x2', key: '1:rule:all-meal-lunch' as never, text: 'Sandwiches' }]).doc;
    const rows = changeRows(d, { item: () => null, place: () => null }, id);
    expect(rows.map((r) => r.text)).toEqual(['Removed Rest at the base from Day 4', 'Note on Lunch: Sandwiches']);
    expect(ruleWords('all-car-hire')).toBe('Collect the hire car');
    expect(ruleWords('A-break-coffee-seceda')).toBe('Coffee and a snack');
  });
  it('Reset to our plan clears it', () => {
    const r = applyOps(base(), removeOps(base(), row('1-all-meal-dinner'), id));
    expect(applyOps(r.doc, [{ kind: 'reset', id: 'o-z', day: null }]).doc.template?.removed).toEqual([]);
  });
});

describe('the one-line note when the day still relies on the row', () => {
  it('the hire car: the drive to Banff stays', () => {
    expect(ruleNote(row('1-all-visit-car-hire-start'), D1)).toBe('The drive to Banff stays; nothing meets the car.');
  });
  it('check-in: you still sleep there', () => {
    expect(ruleNote(row('1-all-checkin-stay-bear-spray-groceries'), D1)).toBe('You still sleep in Banff; nothing checks you in.');
  });
  it('the end of the day: the drive back goes, the day ends after the last stop', () => {
    expect(ruleNote(row('1-all-end-at-base-close'), D1)).toBe('The drive back to Banff goes; the day ends after Elk rut viewing.');
  });
  it('any other row: none', () => {
    expect(ruleNote(row('1-all-meal-lunch'), D1)).toBeNull();
    expect(ruleNote(row('fenland-loop'), D1)).toBeNull();
  });
});
