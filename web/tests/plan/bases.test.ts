import { describe, expect, it } from 'vitest';
import { PLAN_LIMITS, type PlanBaseChoice } from '@travel/core/schema/plan-draft.ts';
import { addBase, clampBases, MAX_BASES, moveBase, placedNights, removeBase, setBaseNights, splitNights, townName } from '@/lib/plan/bases';
import { driveLimit, moves, moveWords } from '@/lib/plan/baseMoves';
import { flowReducer } from '@/lib/plan/flow';
import { buildInputOf, draftOf } from '@/lib/plan/draft';
import { mergeTowns, spreadOf } from '@/lib/plan/useBaseTowns';
import type { Town } from '@travel/core/schema/api/index.ts';
import { ID, T0, tripFlow } from './helpers';

const b = (town: string, nights: number | null = null): PlanBaseChoice => ({ town, nights, pinned: true });
const BANFF = 'ca-ab-banff';
const JASPER = 'ca-ab-jasper';
const LOUISE = 'ca-ab-lake-louise';

describe('the base list (FLOW stage 4)', () => {
  it('holds the engine cap', () => {
    expect(MAX_BASES).toBe(PLAN_LIMITS.bases);
  });

  it('adds a town once, at the end, open for the plan to share, and stops at the cap', () => {
    let l: PlanBaseChoice[] = [];
    l = addBase(l, BANFF);
    l = addBase(l, BANFF);
    expect(l).toEqual([{ town: BANFF, nights: null, pinned: true }]);
    for (const t of ['a-1', 'a-2', 'a-3', 'a-4']) l = addBase(l, t);
    expect(l).toHaveLength(MAX_BASES);
    expect(l.at(-1)!.town).toBe('a-3');
  });

  it('moves a base earlier or later and stays put at the ends', () => {
    const l = [b(BANFF), b(LOUISE), b(JASPER)];
    expect(moveBase(l, JASPER, -1).map((x) => x.town)).toEqual([BANFF, JASPER, LOUISE]);
    expect(moveBase(l, BANFF, 1).map((x) => x.town)).toEqual([LOUISE, BANFF, JASPER]);
    expect(moveBase(l, BANFF, -1).map((x) => x.town)).toEqual([BANFF, LOUISE, JASPER]);
    expect(moveBase(l, JASPER, 1).map((x) => x.town)).toEqual([BANFF, LOUISE, JASPER]);
    expect(moveBase(l, 'nowhere', 1)).toEqual(l);
  });

  it('removes a base', () => {
    expect(removeBase([b(BANFF), b(JASPER)], BANFF).map((x) => x.town)).toEqual([JASPER]);
  });

  it('never gives the bases more nights than the trip has', () => {
    const l = [b(BANFF, 3), b(JASPER)];
    expect(setBaseNights(l, JASPER, 9, 7)[1]!.nights).toBe(4);
    expect(setBaseNights(l, BANFF, 2, 7)[0]!.nights).toBe(2);
    expect(setBaseNights(l, JASPER, null, 7)[1]!.nights).toBeNull();
    expect(placedNights(setBaseNights(l, JASPER, 99, 7))).toBe(7);
  });

  it('a shorter trip takes nights back from the last bases first; no nights, no bases', () => {
    const l = [b(BANFF, 4), b(JASPER, 3)];
    expect(clampBases(l, 5).map((x) => x.nights)).toEqual([4, 1]);
    expect(clampBases(l, 3).map((x) => x.nights)).toEqual([3, 0]);
    expect(clampBases(l, 9)).toEqual(l);
    expect(clampBases(l, 0)).toEqual([]);
  });

  it('splits the nights for the estimate: the visitor first, the open bases share the rest, spare when none is open', () => {
    expect(splitNights([b(BANFF, 3), b(JASPER)], 7)).toEqual({ nights: [3, 4], spare: 0 });
    expect(splitNights([b(BANFF), b(LOUISE), b(JASPER)], 7)).toEqual({ nights: [3, 2, 2], spare: 0 });
    expect(splitNights([b(BANFF, 2), b(JASPER, 3)], 7)).toEqual({ nights: [2, 3], spare: 2 });
    expect(splitNights([], 5)).toEqual({ nights: [], spare: 5 });
  });

  it('reads a name from a town id when the screen holds none', () => {
    expect(townName('ca-ab-banff')).toBe('Banff');
    expect(townName('ca-ab-lake-louise')).toBe('Lake Louise');
  });
});

describe('moves between bases', () => {
  const info = { [BANFF]: { name: 'Banff', lat: 51.178, lon: -115.571 }, [JASPER]: { name: 'Jasper', lat: 52.873, lon: -118.08 }, [LOUISE]: { name: 'Lake Louise', lat: 51.426, lon: -116.18 } };

  it('estimates each move from the towns\' points and calls one over the day\'s driving a long move', () => {
    const [far] = moves([b(BANFF), b(JASPER)], info, 120);
    expect(far!.min).toBeGreaterThan(150);
    expect(far!.long).toBe(true);
    expect(moveWords(far!)).toMatch(/^Move Banff to Jasper: \d h( \d\d)? ≈, a long move$/);
    const [near] = moves([b(BANFF), b(LOUISE)], info, 240);
    expect(near!.long).toBe(false);
    expect(moveWords(near!)).toMatch(/^Move Banff to Lake Louise: .* ≈$/);
    expect(moveWords(near!)).not.toMatch(/long/);
  });

  it('says the drive is known after the build when a point is missing', () => {
    const [m] = moves([b(BANFF), b('ca-bc-golden')], info, 240);
    expect(m!.min).toBeNull();
    expect(moveWords(m!)).toBe('Move Banff to Golden: the drive is known after the build');
  });

  it('no move for one base; the limit is the day\'s driving or the pace\'s', () => {
    expect(moves([b(BANFF)], info, 240)).toEqual([]);
    expect(driveLimit('standard', null)).toBe(240);
    expect(driveLimit('relaxed', null)).toBe(180);
    expect(driveLimit('full', 300)).toBe(300);
  });
});

describe('the state machine for bases', () => {
  const info = (name: string) => ({ name, lat: 51, lon: -115 });
  it('adds, orders, shares nights and removes through the reducer', () => {
    let s = tripFlow({ nights: 7 });
    s = flowReducer(s, { t: 'base-add', town: BANFF, info: info('Banff'), now: T0 });
    s = flowReducer(s, { t: 'base-add', town: JASPER, info: info('Jasper'), now: T0 });
    s = flowReducer(s, { t: 'base-nights', town: BANFF, nights: 3, now: T0 });
    s = flowReducer(s, { t: 'base-move', town: JASPER, by: -1, now: T0 });
    expect(s.bases.map((x) => [x.town, x.nights])).toEqual([[JASPER, null], [BANFF, 3]]);
    expect(s.baseInfo![JASPER]!.name).toBe('Jasper');
    s = flowReducer(s, { t: 'base-remove', town: JASPER, now: T0 });
    expect(s.bases.map((x) => x.town)).toEqual([BANFF]);
    expect(s.baseInfo![JASPER]).toBeUndefined();
    s = flowReducer(s, { t: 'bases-auto', now: T0 });
    expect(s.bases).toEqual([]);
  });

  it('fewer nights take nights back from the bases; a patch of nights does the same', () => {
    let s = tripFlow({ nights: 9, bases: [b(BANFF, 5), b(JASPER, 4)] });
    s = flowReducer(s, { t: 'nights', nights: 6, now: T0 });
    expect(s.bases.map((x) => x.nights)).toEqual([5, 1]);
    s = flowReducer(s, { t: 'patch', patch: { nights: 5 }, now: T0 });
    expect(s.bases.map((x) => x.nights)).toEqual([5, 0]);
  });

  it('a new country or kind drops the bases; the area filter keeps only chosen areas', () => {
    let s = tripFlow({ bases: [b(BANFF)], filters: { kinds: [], kids: true, stroller: false, month: null, areas: ['IT/veneto'] }, regions: ['IT/veneto', 'IT/lombardia'] });
    s = flowReducer(s, { t: 'regions', ids: ['IT/lombardia'], now: T0 });
    expect(s.filters.areas).toEqual([]);
    expect(flowReducer(s, { t: 'country', cc: 'CA', name: 'Canada', now: T0 }).bases).toEqual([]);
    expect(flowReducer(s, { t: 'kind', kind: 'holiday', youngest: null, now: T0 }).bases).toEqual([]);
  });

  it('the build body and the document carry the bases as chosen, none for a day trip', () => {
    const party = { adults: 2, children: [] as (number | null)[] };
    const s = tripFlow({ nights: 7, bases: [b(BANFF, 3), b(JASPER, 4)] });
    const body = buildInputOf(s, party)!;
    expect(body.bases).toEqual([{ town: BANFF, nights: 3, pinned: true }, { town: JASPER, nights: 4, pinned: true }]);
    expect(draftOf(s, 'blue')!.bases).toHaveLength(2);
    const day = tripFlow({ nights: 0, bases: [b(BANFF, 0)] });
    expect(buildInputOf(day, party)!.bases).toEqual([]);
    expect(draftOf(day, 'blue')!.bases).toEqual([]);
    expect(ID).toBeTruthy();
  });
});

describe('the towns near the picks', () => {
  const t = (id: string, name: string, places: number | null, pop: number | null, km: number | null): Town => ({ id, name, lat: 51, lon: -115, pop, cc: 'ca', region: 'alberta', places, distanceKm: km, bearing: null });
  it('reads around the first, the last and two between, at most four, once each', () => {
    expect(spreadOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4)).toEqual([1, 4, 7, 10]);
    expect(spreadOf([1, 2], 4)).toEqual([1, 2]);
    expect(spreadOf([], 4)).toEqual([]);
  });

  it('merges the answers: one row per town (the nearest sighting), the busiest first', () => {
    const merged = mergeTowns([[t('a', 'Alpha', 5, 100, 30), t('b', 'Bravo', 9, 10, 5)], [t('a', 'Alpha', 5, 100, 10), t('c', 'Charlie', 9, 500, 8)]]);
    expect(merged.map((x) => x.id)).toEqual(['c', 'b', 'a']);
    expect(merged.find((x) => x.id === 'a')!.distanceKm).toBe(10);
  });
});
