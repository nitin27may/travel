import { afterEach, describe, expect, it, vi } from 'vitest';
import { parsePlanBuildInput } from '@travel/core/schema/api/plan.ts';
import { parsePlanDraft, PLAN_LIMITS } from '@travel/core/schema/plan-draft.ts';
import { PLAN_BUILDER_UI } from '@/lib/config/product';
import { buildInputOf, buildParty, draftOf, draftStateWords, IDENTITY_ORDER, nextIdentity, outputsOf, partyBand, stateOfDraft, whereOf, youngestOf } from '@/lib/plan/draft';
import { hasEntry, parseEntry } from '@/lib/plan/entry';
import { candidateQuery } from '@/lib/plan/query';
import { monthOfDate, nextWeekend, whenKind, whenWords } from '@/lib/plan/when';
import { PLANS_LOCAL_KEY, PLANS_UI_KEY, PLAN_DRAFTS_SCHEMA_ID, PLAN_DRAFT_SCHEMA_ID } from '@/lib/plan/keys';
import { PLAN_DRAFTS_SCHEMA, PLAN_DRAFT_SCHEMA } from '@travel/core/schema/plan-draft.ts';
import { NO_FILTERS } from '@/lib/plan/flow';
import { nearFlow, outputs, tripFlow } from './helpers';

afterEach(() => vi.unstubAllGlobals());
const party = { adults: 2, children: [6, null] as (number | null)[] };

describe('the numbers and words the builder keeps in step with the contract', () => {
  it('its caps equal the contract caps', () => {
    expect(PLAN_BUILDER_UI.deviceDrafts).toBe(PLAN_LIMITS.drafts);
    expect(PLAN_BUILDER_UI.draftBytes).toBe(PLAN_LIMITS.draftBytes);
    expect(PLAN_BUILDER_UI.maxPicks).toBe(PLAN_LIMITS.picks);
    expect(PLAN_BUILDER_UI.driveDay).toMatchObject({ min: PLAN_LIMITS.driveDayMin.min, max: PLAN_LIMITS.driveDayMin.max, step: PLAN_LIMITS.driveDayMin.step });
    expect((PLAN_BUILDER_UI.driveDay.defaultMin - PLAN_LIMITS.driveDayMin.min) % PLAN_LIMITS.driveDayMin.step).toBe(0);
    for (const m of PLAN_BUILDER_UI.reachChoicesMin) {
      expect(m % PLAN_LIMITS.driveLimitMin.step).toBe(0);
      expect(m).toBeGreaterThanOrEqual(PLAN_LIMITS.driveLimitMin.min);
      expect(m).toBeLessThanOrEqual(PLAN_LIMITS.driveLimitMin.max);
    }
    expect(PLAN_BUILDER_UI.nearStrip).toBeLessThanOrEqual(PLAN_BUILDER_UI.alsoWithin);
    expect(PLAN_BUILDER_UI.alsoWithin).toBeLessThanOrEqual(PLAN_BUILDER_UI.pageSize);
  });

  it('the device keys and schema words equal the core constants and start travel.plans.', () => {
    expect(PLAN_DRAFTS_SCHEMA_ID).toBe(PLAN_DRAFTS_SCHEMA);
    expect(PLAN_DRAFT_SCHEMA_ID).toBe(PLAN_DRAFT_SCHEMA);
    expect(PLANS_LOCAL_KEY).toMatch(/^travel\.plans\./);
    expect(PLANS_UI_KEY).toMatch(/^travel\.plans\./);
  });

  it('the identity order is the tokens without none', () => {
    expect(IDENTITY_ORDER).toHaveLength(7);
    expect(IDENTITY_ORDER).not.toContain('none');
    expect(nextIdentity([])).toBe('blue');
    expect(nextIdentity(['blue', 'orange'])).toBe('rose');
    expect(nextIdentity([undefined, 'blue'])).toBe('orange');
    expect(IDENTITY_ORDER).toContain(nextIdentity([...IDENTITY_ORDER]));
  });
});

describe('the document made from a state', () => {
  it('near mode makes a valid built-mode plan-draft with the start as a reference only', () => {
    const d = draftOf(nearFlow({ date: '2026-11-07', month: 11, driveDayMin: 240, nights: 3 }), 'teal', null)!;
    expect(d.where).toEqual({ mode: 'near', start: { kind: 'hub', id: 'calgary' }, driveLimitMin: 180 });
    const r = parsePlanDraft(d);
    expect(r.success, JSON.stringify(r)).toBe(true);
    expect(d.driveDayMin).toBe(240);
    expect(d.start).toBe('2026-11-07');
    expect(d.party).toBe('device');
    expect(d.template).toBeUndefined();
  });

  it('trip mode carries the country, areas and departure; the kind is not stored', () => {
    const d = draftOf(tripFlow(), 'blue', outputs)!;
    expect(d.where).toEqual({ mode: 'trip', cc: 'IT', regions: ['IT/veneto'] });
    expect(d.origin).toEqual({ kind: 'airport', iata: 'YYZ' });
    expect(parsePlanDraft(d).success).toBe(true);
    expect(JSON.stringify(d)).not.toMatch(/"kind":"week_air"|"kind":"weekend"/);
  });

  it('holds no household data: no party, no ages, no start name', () => {
    const d = draftOf(nearFlow({ startName: 'Home sweet home' }), 'blue')!;
    const text = JSON.stringify(d);
    expect(text).not.toMatch(/adults|children|Home sweet home|startName|walkKm/);
  });

  it('day-out driving is left out under 3 nights, and an incomplete state makes no document', () => {
    expect(draftOf(nearFlow({ driveDayMin: 240, nights: 2 }), 'blue')!.driveDayMin).toBeUndefined();
    expect(draftOf(nearFlow({ start: null }), 'blue')).toBeNull();
    expect(draftOf(tripFlow({ cc: null }), 'blue')).toBeNull();
    expect(whereOf({ ...nearFlow(), kind: null })).toBeNull();
  });

  it('near regions narrow the reach when chosen', () => {
    expect(whereOf(nearFlow({ kind: 'week_car', regions: ['CA/alberta'] }))).toMatchObject({ mode: 'near', regions: ['CA/alberta'] });
  });

  it('resumes as the state it came from: Days with picks, Pick without', () => {
    const d = draftOf(tripFlow({ nights: 9, pace: 'relaxed' }), 'blue')!;
    const s = stateOfDraft(d);
    expect(s).toMatchObject({ kind: 'week_air', stage: 4, cc: 'IT', regions: ['IT/veneto'], nights: 9, pace: 'relaxed', id: d.id });
    expect(s.picks).toHaveLength(2);
    expect(stateOfDraft({ ...d, picks: [] }).stage).toBe(3);
    expect(stateOfDraft(draftOf(nearFlow(), 'blue')!)).toMatchObject({ kind: 'weekend', start: { kind: 'hub', id: 'calgary' } });
  });

  it('words for the Your plans list', () => {
    const d = draftOf(nearFlow(), 'blue')!;
    expect(draftStateWords(d)).toBe('ready to build');
    expect(draftStateWords({ ...d, picks: [] })).toBe('picking places');
    expect(draftStateWords({ ...d, lastBuild: { ...outputs } })).toBe('built');
  });
});

describe('the build body', () => {
  it('is a valid PlanBuildInput with the party in the body only', () => {
    const b = buildInputOf(nearFlow({ driveDayMin: 180, nights: 4 }), party)!;
    const r = parsePlanBuildInput(b);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    expect(b.party).toEqual({ adults: 2, children: [6, 10], walkKm: null });
    expect(b.picks).toEqual([{ ref: 'place/p1', must: false }, { ref: 'place/p2', must: true }]);
    expect(b.driveDayMin).toBe(180);
    expect(JSON.stringify(draftOf(nearFlow(), 'blue'))).not.toContain('"walkKm"');
  });

  it('is null without a pick or a complete where; trip mode sends the departure', () => {
    expect(buildInputOf(nearFlow({ picks: [] }), party)).toBeNull();
    expect(buildInputOf(nearFlow({ start: null }), party)).toBeNull();
    expect(buildInputOf(tripFlow(), party)!.origin).toEqual({ kind: 'airport', iata: 'YYZ' });
    expect(buildInputOf(nearFlow(), party)!.origin).toBeNull();
  });

  it('an unset child age plans as 10, and the youngest drives the band', () => {
    expect(buildParty({ adults: 1, children: [null] }).children).toEqual([10]);
    expect(youngestOf(party)).toBe(6);
    expect(youngestOf({ adults: 2, children: [] })).toBeNull();
    expect(partyBand(party)).toBe('family-6');
    expect(partyBand({ adults: 2, children: [] })).toBeUndefined();
  });

  it('the kept build drops the picks matrix', () => {
    const out = outputsOf({ ...outputs, matrix: { refs: ['place/p1'], minutes: [[0]], estimated: [] } });
    expect(out).not.toHaveProperty('matrix');
    expect(out.builtAt).toBe(outputs.builtAt);
  });
});

describe('the candidates query', () => {
  it('near mode names the start as a reference and the reach; the party is only the youngest band', () => {
    const q = candidateQuery(nearFlow({ filters: { ...NO_FILTERS, kinds: ['trail', 'lake'], stroller: true } }), party)!;
    expect(q).toMatchObject({ mode: 'near', start: { kind: 'hub', id: 'calgary' }, driveLimitMin: 180, month: 7, party: 'family-6', facets: { kind: ['trail', 'lake'], stroller: ['1'] }, pageSize: 40 });
    expect(JSON.stringify(q)).not.toMatch(/adults|children|"ages"/);
  });

  it('a strip ignores the filters but keeps the month and the party band; a near strip carries the pick', () => {
    const q = candidateQuery(nearFlow({ filters: { ...NO_FILTERS, kinds: ['trail'] } }), party, { near: 'p1', limit: 6, strip: true })!;
    expect(q.facets).toBeUndefined();
    expect(q).toMatchObject({ near: 'p1', limit: 6, party: 'family-6', month: 7 });
  });

  it('trip mode needs a country and an area; the kids filter off drops the band; the list month wins', () => {
    expect(candidateQuery(tripFlow({ regions: [] }), party)).toBeNull();
    expect(candidateQuery(nearFlow({ start: null }), party)).toBeNull();
    const q = candidateQuery(tripFlow({ filters: { ...NO_FILTERS, kids: false, month: 9 } }), party)!;
    expect(q).toMatchObject({ mode: 'trip', cc: 'IT', regions: ['IT/veneto'], month: 9 });
    expect(q.party).toBeUndefined();
  });

  it('a count may override the reach', () => {
    expect(candidateQuery(nearFlow(), party, { driveLimitMin: 240, pageSize: 1 })).toMatchObject({ driveLimitMin: 240, pageSize: 1 });
  });
});

describe('ways in and the When chips', () => {
  it('reads only public keys from the link', () => {
    expect(parseEntry('?m=near&n=0&p=moraine-lake')).toEqual({ kind: 'day', nights: 0, cc: null, place: 'moraine-lake', seed: null });
    expect(parseEntry('?m=near&n=1&p=x')).toMatchObject({ kind: 'weekend', nights: 1 });
    expect(parseEntry('?m=near&n=2')).toMatchObject({ kind: 'weekend' });
    expect(parseEntry('?m=trip&cc=ca&p=lake-louise')).toEqual({ kind: 'week_air', nights: null, cc: 'CA', place: 'lake-louise', seed: null });
    expect(parseEntry('?p=Bad Slug!&cc=zzz')).toEqual({ kind: null, nights: null, cc: null, place: null, seed: null });
    expect(parseEntry('?seed=canadian-rockies-2029')).toEqual({ kind: null, nights: null, cc: null, place: null, seed: 'canadian-rockies-2029' });
    expect(hasEntry(parseEntry('?seed=canadian-rockies-2029'))).toBe(true);
    // a seed is a public trip slug and nothing else
    expect(parseEntry('?seed=Bad Slug!').seed).toBeNull();
    expect(parseEntry(`?seed=${'a'.repeat(121)}`).seed).toBeNull();
    expect(parseEntry('')).toEqual({ kind: null, nights: null, cc: null, place: null, seed: null });
  });

  it('next weekend is the coming Saturday', () => {
    expect(nextWeekend(new Date(2026, 9, 28))).toBe('2026-10-31');
    expect(nextWeekend(new Date(2026, 9, 31))).toBe('2026-11-07');
    expect(nextWeekend(new Date(2026, 9, 25))).toBe('2026-10-31');
  });

  it('names the chip a state reads as', () => {
    const today = new Date(2026, 9, 28);
    expect(whenKind({ month: 10, date: '2026-10-31' }, today)).toBe('weekend');
    expect(whenKind({ month: 7, date: '2027-07-12' }, today)).toBe('dates');
    expect(whenKind({ month: 7, date: null }, today)).toBe('month');
    expect(whenKind({ month: null, date: null }, today)).toBe('unsure');
    expect(whenWords({ month: 7, date: null }, today)).toBe('July');
    expect(whenWords({ month: 7, date: '2027-07-12' }, today)).toBe('12 Jul 2027');
    expect(whenWords({ month: null, date: null }, today)).toBe('Not sure yet');
    expect(monthOfDate('2027-07-12')).toBe(7);
    expect(monthOfDate('nope')).toBeNull();
  });
});
