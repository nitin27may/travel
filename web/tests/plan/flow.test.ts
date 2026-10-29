import { describe, expect, it } from 'vitest';
import { PLAN_KINDS, planKindOf } from '@travel/core/schema/plan-draft.ts';
import {
  askedStages, asksDriveDay, asksMoves, canAdvance, defaultPace, estimateDays, flowReducer, isLastStage, leftOutIfShort, newFlow, nextStage, nightsRange, prevStage, primaryLabel, stepCount, stepNumber,
} from '@/lib/plan/flow';
import { KINDS, kindDef, kindOfDraft } from '@/lib/plan/kinds';
import { ID, T0, nearFlow, pick, tripFlow } from './helpers';

const kindAction = (kind: Parameters<typeof kindDef>[0], youngest: number | null = null) => ({ t: 'kind' as const, kind, youngest, now: T0 });

describe('the stages a kind asks (FLOW 2.1)', () => {
  it('Day trip asks Kind, Start, Pick; Weekend adds Days; the rest ask all five', () => {
    expect(askedStages('day')).toEqual([0, 1, 3]);
    expect(askedStages('weekend')).toEqual([0, 1, 3, 4]);
    for (const k of ['long_weekend', 'week_car', 'week_air', 'holiday'] as const) expect(askedStages(k)).toEqual([0, 1, 2, 3, 4]);
  });

  it('the phone counts only stages 1 to 4 that ask: 2, 3, 4, 4, 4, 4', () => {
    expect(KINDS.map((k) => stepCount(k.id))).toEqual([2, 3, 4, 4, 4, 4]);
    expect(stepNumber('weekend', 3)).toBe(2);
    expect(stepNumber('weekend', 4)).toBe(3);
    expect(stepNumber('day', 3)).toBe(2);
  });

  it('next and back skip the stages a kind does not ask, and the last asked stage builds', () => {
    expect(nextStage({ kind: 'weekend', stage: 1 })).toBe(3);
    expect(prevStage({ kind: 'weekend', stage: 3 })).toBe(1);
    expect(nextStage({ kind: 'day', stage: 3 })).toBeNull();
    expect(isLastStage({ kind: 'day', stage: 3 })).toBe(true);
    expect(isLastStage({ kind: 'weekend', stage: 3 })).toBe(false);
    expect(primaryLabel({ kind: 'weekend', stage: 1 })).toBe('Next: Pick');
    expect(primaryLabel({ kind: 'long_weekend', stage: 1 })).toBe('Next: Where');
    expect(primaryLabel({ kind: 'week_air', stage: 3 })).toBe('Next: Days');
    expect(primaryLabel({ kind: 'day', stage: 3 })).toBe('Build my day');
    expect(primaryLabel({ kind: 'holiday', stage: 4 })).toBe('Build my days');
  });
});

describe('the kind tiles', () => {
  it('set nights that derive the same kind (the kind is never stored, TK1)', () => {
    const expected = ['day', 'weekend', 'long_weekend', 'week', 'week', 'holiday'];
    expect(KINDS.map((k) => planKindOf(k.nights))).toEqual(expected);
    expect(KINDS.map((k) => k.nights)).toEqual([0, 2, 3, 7, 7, 14]);
    for (const k of PLAN_KINDS) expect(expected).toContain(k);
  });

  it('the stepper stays inside the kind band', () => {
    for (const k of KINDS) {
      const r = nightsRange(k.id);
      expect(planKindOf(r.min)).toBe(planKindOf(k.nights));
      expect(planKindOf(r.max)).toBe(planKindOf(k.nights));
      expect(k.nights).toBeGreaterThanOrEqual(r.min);
      expect(k.nights).toBeLessThanOrEqual(r.max);
    }
  });

  it('a stored draft reads back as its tile', () => {
    for (const k of KINDS) expect(kindOfDraft(k.nights, k.mode)).toBe(k.id);
  });

  it('near tiles are by car and air tiles say they fly (TF17, S8)', () => {
    expect(KINDS.filter((k) => k.mode === 'near').every((k) => /by car|from home/.test(k.meta))).toBe(true);
    expect(KINDS.filter((k) => k.mode === 'trip').every((k) => /fly somewhere/.test(k.meta))).toBe(true);
  });
});

describe('what each stage needs before Next works', () => {
  it('stage 0 needs a kind; stage 1 a start in near mode and nothing in trip mode', () => {
    expect(canAdvance(newFlow(ID, T0)).ok).toBe(false);
    expect(canAdvance({ ...newFlow(ID, T0), kind: 'weekend', stage: 1 })).toEqual({ ok: false, reason: 'Choose where you start.' });
    expect(canAdvance({ ...newFlow(ID, T0), kind: 'weekend', stage: 1 }, { startsAvailable: false }).reason).toMatch(/cannot plan/);
    expect(canAdvance({ ...nearFlow(), stage: 1 }).ok).toBe(true);
    expect(canAdvance({ ...tripFlow(), stage: 1, origin: null }).ok).toBe(true);
  });

  it('stage 2 needs a country and an area in trip mode and nothing in near mode', () => {
    expect(canAdvance({ ...tripFlow(), stage: 2, cc: null, regions: [] }).reason).toBe('Choose a country.');
    expect(canAdvance({ ...tripFlow(), stage: 2, regions: [] }).reason).toBe('Choose at least one area.');
    expect(canAdvance({ ...tripFlow(), stage: 2 }).ok).toBe(true);
    expect(canAdvance({ ...nearFlow({ kind: 'week_car' }), stage: 2 }).ok).toBe(true);
  });

  it('stages 3 and 4 need a pick', () => {
    expect(canAdvance(nearFlow({ picks: [] })).reason).toBe('Pick at least one place.');
    expect(canAdvance(nearFlow({ picks: [], stage: 4 })).ok).toBe(false);
    expect(canAdvance(nearFlow()).ok).toBe(true);
  });
});

describe('the reducer', () => {
  it('a tap on a tile sets the kind defaults and goes to Start', () => {
    const s = flowReducer(newFlow(ID, T0), kindAction('week_car'));
    expect(s).toMatchObject({ kind: 'week_car', stage: 1, nights: 7, driveLimitMin: 360, pace: 'standard', moves: 'fewer' });
    expect(flowReducer(newFlow(ID, T0), kindAction('long_weekend', 4)).pace).toBe('relaxed');
    expect(defaultPace(9)).toBe('standard');
    expect(defaultPace(null)).toBe('standard');
  });

  it('the same tile again keeps the answers; another tile of the other mode drops the picks and the old start', () => {
    const near = nearFlow();
    const same = flowReducer({ ...near, nights: 1 }, kindAction('weekend'));
    expect(same.nights).toBe(1);
    expect(same.picks).toHaveLength(2);
    const air = flowReducer(near, kindAction('week_air'));
    expect(air).toMatchObject({ start: null, picks: [], visit: {}, nights: 7 });
    const car = flowReducer(near, kindAction('week_car'));
    expect(car.start).toEqual(near.start);
    expect(car.picks).toHaveLength(2);
  });

  it('a new country drops the areas and picks of the old one; the same country keeps them', () => {
    const t = tripFlow();
    expect(flowReducer(t, { t: 'country', cc: 'CA', name: 'Canada', now: T0 })).toMatchObject({ cc: 'CA', regions: [], picks: [] });
    expect(flowReducer(t, { t: 'country', cc: 'IT', name: 'Italy', now: T0 })).toBe(t);
  });

  it('picks, Must see and Remove', () => {
    let s = nearFlow({ picks: [], visit: {} });
    s = flowReducer(s, { t: 'pick', pick: pick(1), visitMin: 90, now: T0 });
    s = flowReducer(s, { t: 'pick', pick: pick(1), visitMin: 90, now: T0 });
    expect(s.picks).toHaveLength(1);
    s = flowReducer(s, { t: 'must', ref: 'place/p1', now: T0 });
    expect(s.picks[0]!.must).toBe(true);
    s = flowReducer(s, { t: 'unpick', ref: 'place/p1', now: T0 });
    expect(s.picks).toEqual([]);
    expect(s.visit).toEqual({});
  });

  it('regions toggle without duplicates and filters merge', () => {
    let s = tripFlow({ regions: [] });
    s = flowReducer(s, { t: 'region', id: 'IT/veneto', on: true, now: T0 });
    s = flowReducer(s, { t: 'region', id: 'IT/veneto', on: true, now: T0 });
    expect(s.regions).toEqual(['IT/veneto']);
    s = flowReducer(s, { t: 'region', id: 'IT/veneto', on: false, now: T0 });
    expect(s.regions).toEqual([]);
    s = flowReducer(s, { t: 'filters', patch: { stroller: true }, now: T0 });
    s = flowReducer(s, { t: 'filters', patch: { kinds: ['trail'] }, now: T0 });
    expect(s.filters).toMatchObject({ stroller: true, kinds: ['trail'], kids: true });
  });

  it('goto, next and back move through the asked stages only', () => {
    let s = nearFlow({ stage: 1 });
    s = flowReducer(s, { t: 'next' });
    expect(s.stage).toBe(3);
    s = flowReducer(s, { t: 'next' });
    expect(s.stage).toBe(4);
    expect(flowReducer(s, { t: 'next' }).stage).toBe(4);
    expect(flowReducer(s, { t: 'back' }).stage).toBe(3);
    expect(flowReducer(s, { t: 'goto', stage: 1 }).stage).toBe(1);
  });
});

describe('the estimate and the rules of stage 4', () => {
  it('turns visit minutes into days at the pace, with 90 minutes for an unknown visit', () => {
    const s = nearFlow({ pace: 'standard', picks: [pick(1), pick(2), pick(3)], visit: { 'place/p1': 360, 'place/p2': 360, 'place/p3': null } });
    expect(estimateDays(s)).toEqual({ days: 3, nights: 2 });
    expect(estimateDays({ ...s, picks: [pick(1)], visit: { 'place/p1': 30 } })).toEqual({ days: 1, nights: 0 });
    expect(estimateDays({ ...s, pace: 'relaxed' }).days).toBeGreaterThanOrEqual(3);
  });

  it('says how many places short nights leave out', () => {
    const s = nearFlow({ picks: Array.from({ length: 9 }, (_, i) => pick(i)), visit: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`place/p${i}`, 360])) });
    expect(estimateDays(s).days).toBe(9);
    expect(leftOutIfShort({ ...s, nights: 2 })).toBe(6);
    expect(leftOutIfShort({ ...s, nights: 8 })).toBe(0);
  });

  it('asks day-out driving from 3 nights and Moves from a long weekend (S1)', () => {
    expect(asksDriveDay({ nights: 2 })).toBe(false);
    expect(asksDriveDay({ nights: 3 })).toBe(true);
    expect(asksMoves({ kind: 'weekend' })).toBe(false);
    expect(asksMoves({ kind: 'day' })).toBe(false);
    expect(asksMoves({ kind: 'long_weekend' })).toBe(true);
  });
});
