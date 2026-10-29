import { describe, expect, it } from 'vitest';
import type { DayTimeline, TimelineEntry } from '@travel/core/schedule/types.ts';
import { builtDays } from '@travel/core/plan/ops.ts';
import { parsePlanDraft, type PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { COPIES_KEY } from '@travel/core/schema/copies.ts';
import { PLANS_LOCAL_KEY } from '@/lib/plan/keys';
import { applyOps } from '@/lib/trip-edit/model';
import { openTrip, saveOps } from '@/lib/trip-edit/open';
import { CONVERTED_KEY } from '@/lib/trip-edit/convertDevice';
import { kickerWords } from '@/lib/trip-edit/marks';
import { fromTripName } from '@/lib/trip-edit/fromTrip';
import { convertedLabel } from '@/lib/mine/rows';
import { convertOps, refusal } from '@/components/trips/edit/convert/materialise';
import { isConverted } from '@/components/trips/edit/convert/reset';
import { copy, ID_A, memory } from './helpers';

// STEP2-B3: a copy becomes the person's own built trip in place. The pieces under the UI layer: what `convert` is given (our plan's stops as
// "From our trip"), the device moving the stored item between the copies and the plans list, Undo giving the copy back byte for byte, the
// label that names the trip it began as, and Reset to our plan after a conversion.

const AT = '2026-10-28T09:00:00.000Z';
let n = 0;
const id = (): string => `o-t${++n}`;

function entry(day: number, sid: string, slug: string | null, title: string, start: string, over: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    id: sid, day, lane: 'all', kind: 'visit', sub: 'sight', title, start, durationMin: 60, end: '10:00', tz: 'Europe/Rome',
    at: slug ? { name: title, placeSlug: slug, point: null } : null, from: null, to: null,
    time: { confidence: 'suggested', source: 'plan', pinned: false, note: null }, duration: { source: 'plan', basis: '' },
    optional: false, addedBy: 'author', sourceItemId: sid, honesty: [], ...over,
  } as TimelineEntry;
}
const leg = (day: number, sid: string, min: number, basis: 'routed' | 'estimate' = 'routed'): TimelineEntry =>
  entry(day, sid, null, 'Drive', '08:00', { kind: 'leg', durationMin: min, sourceItemId: null, leg: { mode: 'drive', km: 40, basis, breaks: 0 } });
function day(n: number, entries: TimelineEntry[]): DayTimeline {
  return {
    day: n, variant: { key: 'A', label: 'Plan', chosenBy: 'profile', reason: '' }, lanes: ['all'], entries,
    span: { start: '08:00', end: '18:00', minutes: 600 }, totals: { activeMin: 0, driveMin: 0, walkKm: 0, gainM: 0 }, warnings: [], fits: true, blocks: false, notes: [],
  };
}
const TL: DayTimeline[] = [
  day(1, [leg(1, 'l1', 45), entry(1, 'seceda-ridge', 'seceda', 'Seceda', '09:00'), entry(1, 'lunch', null, 'Lunch', '12:00', { kind: 'meal', sourceItemId: 'lunch' })]),
  day(2, [entry(2, 'lago', 'lago-di-braies', 'Lago di Braies', '09:30'), entry(2, 'add-pyramid-lake', 'pyramid-lake', 'Pyramid Lake', '14:00', { addedBy: 'visitor' })]),
];

function open(items = [copy()]) {
  const storage = memory(items);
  const r = openTrip(ID_A, { storage });
  if (r.kind !== 'ok') throw new Error('open');
  return { storage, doc: r.doc };
}

describe('what convert is given', () => {
  it('places our stops "From our trip" on their day, the person\'s own as placed, with the times of the day on screen', () => {
    const { doc } = open();
    const c = convertOps(doc, TL, 'Dolomites', AT, id);
    const op = c.ops[0] as Extract<(typeof c.ops)[number], { kind: 'convert' }>;
    expect(op.picks.map((p) => [p.ref, p.added ?? false])).toEqual([['place/seceda', false], ['place/lago-di-braies', false], ['place/pyramid-lake', true]]);
    expect(op.edits).toEqual([
      { day: 1, refs: ['place/seceda'], locked: [], fromTrip: ['place/seceda'] },
      { day: 2, refs: ['place/lago-di-braies', 'place/pyramid-lake'], locked: [], placed: ['place/pyramid-lake'], fromTrip: ['place/lago-di-braies'] },
    ]);
    expect(op.nights).toBe(1);
    expect(op.lastBuild?.days[0]?.items[0]).toMatchObject({ ref: 'place/seceda', startMin: 540, visitMin: 60, driveMin: 45, basis: 'routed' });
    expect(c).toMatchObject({ places: 3, left: 0, other: 1 });
    // the name goes with the trip: a built trip has no catalogue title
    expect(c.ops[1]).toMatchObject({ kind: 'setTitle', title: 'Dolomites' });
  });

  it('is refused for a trip longer than a built plan, and for a plan with no place in it', () => {
    const { doc } = open();
    expect(refusal(doc, TL)).toBeNull();
    expect(refusal(doc, Array.from({ length: 23 }, (_, i) => TL[i % 2]!))).toBe('long');
    expect(refusal(doc, [day(1, [entry(1, 'lunch', null, 'Lunch', '12:00')])])).toBe('empty');
  });

  it('carries the person\'s notes to the built keys', () => {
    const { doc } = open();
    const noted: PlanDraft = { ...doc, template: { ...doc.template!, notes: { trip: 'Bring boots', '2': 'Early start', '1:seceda-ridge': 'Cable car first' } } };
    const op = convertOps(noted, TL, 'Dolomites', AT, id).ops[0] as { notes?: Record<string, string> };
    expect(op.notes).toEqual({ trip: 'Bring boots', '2': 'Early start', 'place/seceda': 'Cable car first' });
  });
});

describe('the device holds the conversion', () => {
  const converted = () => {
    const o = open();
    const c = convertOps(o.doc, TL, 'Dolomites', AT, id);
    const r = saveOps(ID_A, c.ops, { storage: o.storage });
    return { ...o, c, r };
  };

  it('moves the copy to the plans list under the same id: a built document in this trip\'s place, no copy item left', () => {
    const { storage, r } = converted();
    expect(r).toEqual({ ok: true });
    const copies = JSON.parse(storage.getItem(COPIES_KEY)!) as { items: unknown[] };
    expect(copies.items).toEqual([]);
    const list = JSON.parse(storage.getItem(PLANS_LOCAL_KEY)!) as { items: PlanDraft[] };
    expect(list.items).toHaveLength(1);
    const again = openTrip(ID_A, { storage });
    expect(again.kind).toBe('ok');
    if (again.kind !== 'ok') return;
    expect(again.doc.template).toBeUndefined();
    expect(again.doc).toMatchObject({ seed: 'dolomites-2027', convertedAt: AT, title: 'Dolomites', start: '2027-07-03', travellers: { adults: 2, children: [6] } });
    expect(parsePlanDraft(again.doc).success).toBe(true);
    expect(isConverted(again.doc)).toBe(true);
    // the day plan reads as it did: Seceda on Day 1, and the stops of Day 2
    expect(builtDays(again.doc).map((b) => b.refs)).toEqual([['place/seceda'], ['place/lago-di-braies', 'place/pyramid-lake']]);
    expect(builtDays(again.doc)[1]).toMatchObject({ fromTrip: ['place/lago-di-braies'], placed: ['place/pyramid-lake'] });
  });

  it('Undo gives the copy back byte for byte, in the copies and not in the plans list', () => {
    const { storage, doc, c } = converted();
    const before = JSON.stringify(doc);
    const base = openTrip(ID_A, { storage });
    if (base.kind !== 'ok') throw new Error('open');
    const applied = applyOps(doc, c.ops);
    expect(applied.skipped).toEqual([]);
    expect(saveOps(ID_A, applied.inverse, { storage })).toEqual({ ok: true });
    const back = openTrip(ID_A, { storage });
    if (back.kind !== 'ok') throw new Error('open');
    expect(JSON.stringify(back.doc)).toBe(before);
    expect(back.copy?.id).toBe(ID_A);
    expect(JSON.parse(storage.getItem(PLANS_LOCAL_KEY) ?? '{"items":[]}').items).toEqual([]);
    expect(storage.getItem(CONVERTED_KEY)).toBeNull();
    // Redo converts again
    const redo = applyOps(back.doc, c.ops);
    expect(saveOps(ID_A, c.ops, { storage })).toEqual({ ok: true });
    expect(redo.skipped).toEqual([]);
  });

  it('keeps the copy\'s photo and copy date across Undo (the side envelope holds the item)', () => {
    const { storage, doc, c } = converted();
    const applied = applyOps(doc, c.ops);
    saveOps(ID_A, applied.inverse, { storage });
    const back = openTrip(ID_A, { storage });
    expect(back.kind === 'ok' && back.copy).toMatchObject({ photo: '/img/abc123-960.webp', copiedAt: '2026-10-20T10:00:00.000Z' });
  });

  it('a list written by a newer site is never written: the conversion is refused and the copy stays', () => {
    const o = open();
    o.storage.setItem(PLANS_LOCAL_KEY, JSON.stringify({ schema: 'plan-drafts/9', items: [] }));
    const c = convertOps(o.doc, TL, 'Dolomites', AT, id);
    expect(saveOps(ID_A, c.ops, { storage: o.storage })).toEqual({ ok: false, reason: 'newer' });
    expect(openTrip(ID_A, { storage: o.storage }).kind).toBe('ok');
    expect(JSON.parse(o.storage.getItem(COPIES_KEY)!).items).toHaveLength(1);
  });

  it('Reset to our plan after a conversion makes a fresh copy of our trip in place, and Undo brings the converted trip back', async () => {
    const { storage } = converted();
    const built = openTrip(ID_A, { storage });
    if (built.kind !== 'ok') throw new Error('open');
    const { emptyPlanTemplate } = await import('@/lib/trip-edit/model');
    const reset = applyOps(built.doc, [{ kind: 'toTemplate', id: id(), template: emptyPlanTemplate('dolomites-2027'), nights: 13, cc: 'IT' }]);
    expect(reset.skipped).toEqual([]);
    expect(saveOps(ID_A, [{ kind: 'toTemplate', id: id(), template: emptyPlanTemplate('dolomites-2027'), nights: 13, cc: 'IT' }], { storage })).toEqual({ ok: true });
    const fresh = openTrip(ID_A, { storage });
    expect(fresh.kind === 'ok' && fresh.doc.template).toMatchObject({ trip: 'dolomites-2027', removed: [], added: [] });
    expect(fresh.kind === 'ok' && fresh.copy?.id).toBe(ID_A);
    expect(saveOps(ID_A, reset.inverse, { storage })).toEqual({ ok: true });
    const again = openTrip(ID_A, { storage });
    expect(again.kind === 'ok' && again.doc.convertedAt).toBe(AT);
  });
});

describe('the words', () => {
  it('names the trip it began as, from the slug', () => {
    expect(fromTripName('canadian-rockies-2029')).toBe('Canadian Rockies');
    expect(fromTripName('dolomites-2027')).toBe('Dolomites');
    expect(fromTripName('canadian-rockies-sept-2029')).toBe('Canadian Rockies');
    expect(convertedLabel('dolomites-2027')).toBe('Made from Dolomites');
  });
  it('the cover says "Your trip" and where it was made from', () => {
    const o = open();
    const c = convertOps(o.doc, TL, 'Dolomites', AT, id);
    const built = applyOps(o.doc, c.ops).doc;
    expect(kickerWords(o.doc, 'Dolomites')).toBe('Your copy · from our Dolomites trip');
    // the catalogue's title carries the length ("Dolomites, 14 nights"): the converted trip names the trip from its slug
    expect(kickerWords(built, 'Dolomites, 14 nights')).toBe('Your trip · made from our Dolomites trip');
  });
});
