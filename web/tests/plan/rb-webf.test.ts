import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parsePlanDraft } from '@travel/core/schema/plan-draft.ts';
import { draftOf, withParty } from '@/lib/plan/draft';
import { estimateDays, flowReducer, canAdvance, newFlow } from '@/lib/plan/flow';
import { readLastFrom, writeLastFrom } from '@/lib/plan/lastFrom';
import { PLANS_FROM_KEY } from '@/lib/plan/keys';
import { persistFlow } from '@/lib/plan/persist';
import { readDrafts, saveDraft } from '@/lib/plan/store';
import { derivedTitle, draftTitle, nightsWords } from '@/lib/trip-edit/title';
import { gettingThere } from '@/lib/trip-edit/gettingThere';
import { rebuildInput } from '@/lib/trip-edit/built';
import { partyFor } from '@/components/trips/edit/settings/built/rebuild';
import { fakeWindow, ID, nearFlow, outputs, pick, T0, tripFlow } from './helpers';

let w: ReturnType<typeof fakeWindow>;
beforeEach(() => {
  w = fakeWindow();
});
afterEach(() => vi.unstubAllGlobals());

const built = (over = {}) => ({ ...outputs, bases: [{ town: 'ca-ab-banff', name: 'Banff', nights: 4, pinned: false, picks: 3, reasons: [] }, { town: 'ca-ab-jasper', name: 'Jasper', nights: 3, pinned: false, picks: 2, reasons: [] }], ...over });

describe('RB-004: the built document carries the party it was built with', () => {
  it('is a valid document with the age snapshot, an unset age planned as 10, and the page, checks and a rebuild read it', () => {
    const doc = withParty(draftOf(tripFlow(), 'blue', built())!, { adults: 2, children: [7, null] });
    expect(doc.party).toBe('trip');
    expect(doc.travellers).toEqual({ adults: 2, children: [7, 10] });
    expect(parsePlanDraft(doc).success).toBe(true);
    expect(partyFor(doc)).toEqual({ adults: 2, children: [7, 10] });
    const body = rebuildInput(doc, partyFor(doc));
    expect(body?.party).toEqual({ adults: 2, children: [7, 10], walkKm: null });
  });

  it('autosave of the screen state keeps the party and the build the document already has', () => {
    const flow = tripFlow({ picks: [pick(1), pick(2)] });
    const doc = withParty(draftOf(flow, 'blue', built())!, { adults: 3, children: [4] });
    expect(saveDraft(doc)).toEqual({ ok: true });
    persistFlow({ ...flow, updatedAt: '2026-10-28T11:00:00.000Z' });
    const kept = readDrafts().drafts[0]!;
    expect(kept.party).toBe('trip');
    expect(kept.travellers).toEqual({ adults: 3, children: [4] });
    expect(kept.lastBuild?.bases).toHaveLength(2);
  });

  it('an unbuilt draft still names the device party and holds no travellers', () => {
    persistFlow(nearFlow());
    const d = readDrafts().drafts[0]!;
    expect(d.party).toBe('device');
    expect(d.travellers).toBeUndefined();
  });
});

describe('RB-015: one name for a trip the builder made', () => {
  it('names it from the towns it sleeps in and its length', () => {
    const d = draftOf(tripFlow({ nights: 7 }), 'blue', built())!;
    expect(draftTitle(d)).toBe('Banff and Jasper, 7 nights');
    expect(draftTitle({ ...d, title: 'Our Rockies' })).toBe('Our Rockies');
  });

  it('falls back to the first picks, then the country, then a plain word', () => {
    const d = draftOf(nearFlow({ nights: 2 }), 'blue')!;
    expect(draftTitle(d)).toBe('Place 1 and Place 2, 2 nights');
    expect(derivedTitle({ ...d, picks: [] })).toBe('Your trip, 2 nights');
    const t = draftOf(tripFlow({ nights: 7, picks: [] }), 'blue')!;
    expect(derivedTitle(t)).toBe('Italy, 7 nights');
    expect(nightsWords(0)).toBe('a day trip');
    expect(nightsWords(1)).toBe('1 night');
    expect(nightsWords(null)).toBe('');
  });

  it('shortens a long list of towns', () => {
    const many = built({ bases: ['a', 'b', 'c', 'd'].map((n) => ({ town: `x-y-${n}`, name: n.toUpperCase(), nights: 1, pinned: false, picks: 1, reasons: [] })) });
    expect(derivedTitle(draftOf(tripFlow({ nights: 4 }), 'blue', many)!)).toBe('A, B and more, 4 nights');
  });
});

describe('RB-016: getting there and getting home on a trip by air', () => {
  const day = (n: number, base: string | null, items: { name: string; driveMin: number | null; basis: 'routed' | 'estimate' | null }[] = []) => ({
    day: n, base, move: false, returnMin: null, warnings: [], reasons: [],
    items: items.map((i, k) => ({ ref: `place/p${n}${k}`, slug: `p${n}${k}`, name: i.name, startMin: 540, visitMin: 60, driveMin: i.driveMin, basis: i.basis, locked: false })),
  });
  const doc = (origin: { kind: 'airport'; iata: string } | null) =>
    ({ ...draftOf(tripFlow({ nights: 2, origin }), 'blue', built({ days: [day(1, 'ca-ab-banff', [{ name: 'Lake Louise', driveMin: 90, basis: 'estimate' }]), day(2, 'ca-ab-banff'), day(3, null)] }))! });

  it('says what the build holds on Day 1 and the last day, and nothing between', () => {
    const d = doc({ kind: 'airport', iata: 'YYC' });
    expect(gettingThere(d, 1)).toMatchObject({ end: 'in', missing: false });
    expect(gettingThere(d, 1)!.text).toContain('Fly from YYC');
    expect(gettingThere(d, 1)!.text).toContain('1 h 30 ≈ by hire car to Lake Louise');
    expect(gettingThere(d, 3)).toMatchObject({ end: 'out', missing: false });
    expect(gettingThere(d, 3)!.text).toContain('Leave Banff');
    expect(gettingThere(d, 2)).toBeNull();
  });

  it('says what is missing when no airport was chosen, and is silent for a trip from home or a copy', () => {
    expect(gettingThere(doc(null), 1)).toMatchObject({ missing: true });
    expect(gettingThere(doc(null), 3)).toMatchObject({ missing: true });
    expect(gettingThere(draftOf(nearFlow(), 'blue', built({ days: [day(1, null)] }))!, 1)).toBeNull();
  });
});

describe('RB-019: the last place you flew from', () => {
  it('is kept as a typed reference and its name, on this device only', () => {
    expect(readLastFrom()).toBeNull();
    expect(writeLastFrom({ kind: 'airport', iata: 'YYZ' }, 'Toronto Pearson')).toBe(true);
    expect(readLastFrom()).toEqual({ origin: { kind: 'airport', iata: 'YYZ' }, name: 'Toronto Pearson' });
    expect(w.store.get(PLANS_FROM_KEY)).toBe('{"v":1,"o":"iata:YYZ","n":"Toronto Pearson"}');
    expect(writeLastFrom({ kind: 'hub', id: 'toronto' }, 'Toronto')).toBe(true);
    expect(readLastFrom()?.origin).toEqual({ kind: 'hub', id: 'toronto' });
  });

  it('reads nothing from a value that is not one', () => {
    w.store.set(PLANS_FROM_KEY, '{"v":1,"o":"43.6,-79.4","n":"x"}');
    expect(readLastFrom()).toBeNull();
    w.store.set(PLANS_FROM_KEY, 'nope');
    expect(readLastFrom()).toBeNull();
  });
});

describe('RB-022: Stay here on a picked town', () => {
  const info = { name: 'Ortisei', lat: 46.57, lon: 11.67 };
  it('makes the town a base and takes it back, with the pick', () => {
    let s = flowReducer(tripFlow({ nights: 7, picks: [], bases: [] }), { t: 'pick', pick: pick(1), visitMin: 60, now: T0, town: true, driveMin: 30 });
    expect(s.pickTowns).toEqual({ 'place/p1': true });
    s = flowReducer(s, { t: 'stay', ref: 'place/p1', town: 'it-bz-ortisei', info, now: T0 });
    expect(s.bases).toEqual([{ town: 'it-bz-ortisei', nights: null, pinned: true }]);
    expect(s.stay).toEqual({ 'place/p1': 'it-bz-ortisei' });
    s = flowReducer(s, { t: 'unstay', ref: 'place/p1', now: T0 });
    expect(s.bases).toEqual([]);
    s = flowReducer(flowReducer(s, { t: 'stay', ref: 'place/p1', town: 'it-bz-ortisei', info, now: T0 }), { t: 'unpick', ref: 'place/p1', now: T0 });
    expect(s.bases).toEqual([]);
    expect(s.picks).toEqual([]);
  });

  it('does nothing on a day trip (no night, no base)', () => {
    const s = flowReducer(tripFlow({ nights: 0 }), { t: 'stay', ref: 'place/p1', town: 'it-bz-ortisei', info, now: T0 });
    expect(s.bases).toEqual([]);
  });
});

describe('RB-007: the estimate counts the driving between places', () => {
  it('needs more days when the picks lie far from the centre, and says nothing more than before without drive figures', () => {
    const base = { picks: [pick(1), pick(2), pick(3)], visit: { 'place/p1': 60, 'place/p2': 60, 'place/p3': 60 }, pace: 'standard' as const };
    expect(estimateDays(base)).toEqual({ days: 1, nights: 0 });
    expect(estimateDays({ ...base, drive: { 'place/p1': 240, 'place/p2': 240, 'place/p3': 240 } })).toEqual({ days: 3, nights: 2 });
  });
});

describe('RB-009: a start with nothing in reach cannot go on', () => {
  it('Next is off with the reason, and on again once the reach holds a place', () => {
    const s = nearFlow({ stage: 1 });
    expect(canAdvance(s).ok).toBe(true);
    expect(canAdvance({ ...s, reachTotal: 0 })).toMatchObject({ ok: false });
    expect(canAdvance({ ...s, reachTotal: 0 }).reason).toContain('Drive further');
    expect(canAdvance({ ...s, reachTotal: 4 }).ok).toBe(true);
    expect(canAdvance({ ...newFlow(ID, T0), kind: 'week_air', stage: 1 }).ok).toBe(true);
  });
});
