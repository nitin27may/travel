import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { parseTimelineUrl, serialiseTimelineUrl } from '@travel/core/schedule/profileCodec.ts';
import { DEFAULT_PROFILE, type Profile } from '@travel/core/schedule/types.ts';
import { applyOps, type PlanOp } from '@travel/core/plan/ops.ts';
import { copyToPlanDraft } from '@travel/core/plan/doc.ts';
import { DEFAULT_CHILD_AGE } from '@travel/core/trips/party.ts';
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { useTimeline, type TimelineApi, type TimelineChange } from '@/components/trips/timeline/useTimeline';
import type { TimelineModel } from '@/components/trips/timeline/model';
import type { TripUrl } from '@/components/trips/useTripUrl';
import { documentSource, opsFor, partyOps, planChanged, profileOfDraft, stateOfDraft } from '@/lib/trip-edit/source';
import { copy } from './helpers';

// STEP2-T1 steps 1 and 2: the two TimelineSources. The URL source is today's code moved (EA12: no change on /trips/), the document source
// reads the person's document and names each change as one operation. The page cannot tell them apart.

const defaults: Profile = { ...DEFAULT_PROFILE, party: 'family', youngest: 6, pace: 'standard', adults: 2 };
const draft = (over = {}): PlanDraft => (copyToPlanDraft(copy(over)) as { success: true; data: PlanDraft }).data;
let n = 0;
const id = () => `o-t${++n}`;

describe('the document as a timeline state', () => {
  it('reads the profile, the versions and the added places of a copy', () => {
    const d = draft({ overrides: { '2': 'B', '5': 'C' }, added: [{ day: 3, placeSlug: 'moraine-lake' }], profile: { party: 'family', youngest: 6, pace: 'relaxed', adults: 3, walk: 8, split: true } });
    const s = stateOfDraft(d, defaults);
    expect(s.profile).toEqual({ party: 'family', youngest: 6, pace: 'relaxed', adults: 3, walkKm: 8, split: true });
    expect(s.overrides).toEqual({ 2: 'B', 5: 'C' });
    expect(s.added).toEqual([{ day: 3, slug: 'moraine-lake' }]);
    expect(planChanged(s)).toBe(true);
  });

  it('plans for the travellers when the copy carries no profile', () => {
    const p = profileOfDraft(draft({ profile: null, adults: 3, children: [4, 9] }), defaults);
    expect(p).toMatchObject({ party: 'family', youngest: 4, adults: 3 });
    expect(profileOfDraft(draft({ profile: null, adults: 2, children: [] }), defaults)).toMatchObject({ party: 'adults', youngest: null });
  });

  it('is plain (the server timelines stand) exactly when it plans as the plan was written', () => {
    const plain = documentSource(draft({ overrides: {}, profile: { party: 'family', youngest: 6, pace: 'standard', adults: 2, walk: null, split: false } }), defaults, vi.fn());
    expect(plain.plain).toBe(true);
    expect(plain.changed).toBe(false);
    const changed = documentSource(draft(), defaults, vi.fn());
    expect(changed.plain).toBe(false);
    expect(changed.changed).toBe(true);
  });

  it('pins the child age a profile without ages plans for to the core default', () => {
    // a profile carries only the youngest; a family with none set is planned for DEFAULT_CHILD_AGE (source.ts holds the literal)
    const d = draft({ children: [] });
    const ops = opsFor(d, { profile: { ...defaults, party: 'family', youngest: null }, overrides: {}, added: [] }, { kind: 'profile', patch: { party: 'family' } }, id);
    expect(ops[0]).toMatchObject({ kind: 'setParty', travellers: { adults: 2, children: [DEFAULT_CHILD_AGE] } });
  });
});

describe('each change is one operation that applies', () => {
  const apply = (d: PlanDraft, ops: PlanOp[]) => {
    const r = applyOps(d, ops);
    expect(r.skipped).toEqual([]);
    return r.doc;
  };

  it('a version', () => {
    const d = draft();
    const src = documentSource(d, defaults, () => undefined, id);
    const next = { ...src.state, overrides: { ...src.state.overrides, 5: 'C' } };
    const ops = opsFor(d, next, { kind: 'variant', day: 5, key: 'C' }, id);
    expect(ops).toMatchObject([{ kind: 'setVariant', day: 5, variant: 'C' }]);
    expect(stateOfDraft(apply(d, ops), defaults).overrides).toEqual({ 2: 'B', 5: 'C' });
    const back = opsFor(apply(d, ops), next, { kind: 'variant', day: 5, key: null }, id);
    expect(stateOfDraft(apply(apply(d, ops), back), defaults).overrides).toEqual({ 2: 'B' });
  });

  it('an added place, and its removal by the operation that made it', () => {
    const d = draft();
    const add = opsFor(d, stateOfDraft(d, defaults), { kind: 'add', day: 4, slug: 'pyramid-lake' }, id);
    expect(add).toMatchObject([{ kind: 'addPlace', day: 4, ref: 'place/pyramid-lake' }]);
    const d2 = apply(d, add);
    expect(stateOfDraft(d2, defaults).added).toEqual([{ day: 4, slug: 'pyramid-lake' }]);
    const rm = opsFor(d2, stateOfDraft(d2, defaults), { kind: 'remove', day: 4, slug: 'pyramid-lake' }, id);
    expect(rm).toMatchObject([{ kind: 'removePlace', added: expect.stringMatching(/^o-/) }]);
    expect(stateOfDraft(apply(d2, rm), defaults).added).toEqual([]);
    // a place that is not there is no operation
    expect(opsFor(d2, stateOfDraft(d2, defaults), { kind: 'remove', day: 9, slug: 'pyramid-lake' }, id)).toEqual([]);
  });

  it('the party and pace set the travellers and the profile together, keeping real ages while the youngest holds', () => {
    const d = draft({ children: [6, 9] });
    const st = stateOfDraft(d, defaults);
    const ops = opsFor(d, { ...st, profile: { ...st.profile, pace: 'full', adults: 3 } }, { kind: 'profile', patch: { pace: 'full', adults: 3 } }, id);
    const d2 = apply(d, ops);
    expect(d2.travellers).toEqual({ adults: 3, children: [6, 9] });
    expect(d2.template?.profile).toMatchObject({ pace: 'full', adults: 3, party: 'family', youngest: 6 });
    const st2 = stateOfDraft(d2, defaults);
    const adultsOnly = apply(d2, opsFor(d2, { ...st2, profile: { ...st2.profile, party: 'adults', youngest: null } }, { kind: 'profile', patch: { party: 'adults' } }, id));
    expect(adultsOnly.travellers).toEqual({ adults: 3, children: [] });
    expect(adultsOnly.template?.profile).toMatchObject({ party: 'adults', youngest: null });
  });

  it('partyOps sets exactly the travellers it is given', () => {
    const d = draft();
    const d2 = apply(d, partyOps(d, defaults, { adults: 2, children: [3, 8, 12] }, 'relaxed', id));
    expect(d2.travellers).toEqual({ adults: 2, children: [3, 8, 12] });
    expect(d2.template?.profile).toMatchObject({ party: 'family', youngest: 3, pace: 'relaxed' });
  });

  it('reset clears the versions and the added places and leaves the party', () => {
    const d = draft({ added: [{ day: 3, placeSlug: 'x-lake' }] });
    const d2 = apply(d, opsFor(d, stateOfDraft(d, defaults), { kind: 'reset' }, id));
    expect(planChanged(stateOfDraft(d2, defaults))).toBe(false);
    expect(d2.travellers).toEqual(d.travellers);
  });

  it('a built document makes no operations in T1', () => {
    const built = { ...draft(), template: undefined } as PlanDraft;
    expect(opsFor(built, stateOfDraft(built, defaults), { kind: 'reset' }, id)).toEqual([]);
  });

  it('write() sends only the operations of the change', () => {
    const d = draft();
    const sent: PlanOp[][] = [];
    const src = documentSource(d, defaults, (ops) => sent.push(ops), id);
    src.write({ ...src.state, overrides: { ...src.state.overrides, 7: 'A' } }, { kind: 'variant', day: 7, key: 'A' });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject([{ kind: 'setVariant', day: 7, variant: 'A' }]);
    src.write(src.state, { kind: 'remove', day: 9, slug: 'nothing' });
    expect(sent).toHaveLength(1);
  });
});

// ---- the URL source: today's behaviour, driven through useTimeline on the server renderer ----

const model = { slug: 't', defaultProfile: { party: 'family', youngest: 6, pace: 'standard', walkKm: null, split: false }, days: [], addables: {}, addByDay: {}, defaultTimelines: [] } as unknown as TimelineModel;

function through(timeline: string): { api: TimelineApi; go: ReturnType<typeof vi.fn> } {
  const go = vi.fn();
  const url = { view: null, hash: 'day-3', day: 3, category: null, timeline, go } as unknown as TripUrl;
  let api!: TimelineApi;
  const C = () => {
    api = useTimeline(model, url);
    return null;
  };
  renderToStaticMarkup(createElement(C));
  return { api, go };
}

describe('the URL source is the page as it was', () => {
  const d: Profile = { ...model.defaultProfile, adults: 2 };

  it('reads the address and is plain exactly when the address carries no profile keys', () => {
    expect(through('').api.pending).toBe(false);
    expect(through('').api.changed).toBe(false);
    const c = through('pace=relaxed&d=5C');
    expect(c.api.state).toEqual(parseTimelineUrl('pace=relaxed&d=5C', d));
    expect(c.api.changed).toBe(true);
    expect(c.api.pending).toBe(true);
    expect([...c.api.changedDays]).toEqual([5]);
  });

  it('every write pushes the address the codec makes, keeping the fragment', () => {
    const { api, go } = through('d=5C');
    api.setVariant(7, 'B');
    expect(go).toHaveBeenLastCalledWith({ hash: 'day-3', timeline: serialiseTimelineUrl({ profile: d, overrides: { 5: 'C', 7: 'B' }, added: [] }, d) }, 'push');
    api.addPlace(2, 'moraine-lake');
    expect(go).toHaveBeenLastCalledWith({ hash: 'day-3', timeline: serialiseTimelineUrl({ profile: d, overrides: { 5: 'C' }, added: [{ day: 2, slug: 'moraine-lake' }] }, d) }, 'push');
    api.setProfile({ pace: 'full' });
    expect(go).toHaveBeenLastCalledWith({ hash: 'day-3', timeline: serialiseTimelineUrl({ profile: { ...d, pace: 'full' }, overrides: { 5: 'C' }, added: [] }, d) }, 'push');
    api.reset();
    expect(go).toHaveBeenLastCalledWith({ hash: 'day-3', timeline: '' }, 'push');
  });

  it('adults only has no youngest; a family with none set gets the default', () => {
    const { api, go } = through('');
    api.setProfile({ party: 'adults' });
    expect(go).toHaveBeenLastCalledWith({ hash: 'day-3', timeline: serialiseTimelineUrl({ profile: { ...d, party: 'adults', youngest: null }, overrides: {}, added: [] }, d) }, 'push');
  });
});

describe('an explicit source replaces the address', () => {
  it('reads its state and writes through it, never to the address', () => {
    const write = vi.fn();
    const state = { profile: { ...DEFAULT_PROFILE, adults: 3 }, overrides: { 2: 'B' }, added: [] };
    const src = { state, defaults: DEFAULT_PROFILE, plain: false, changed: true, write };
    const go = vi.fn();
    const url = { view: null, hash: '', day: null, category: null, timeline: 'p=adults', go } as unknown as TripUrl;
    let api!: TimelineApi;
    const C = () => {
      api = useTimeline(model, url, src);
      return null;
    };
    renderToStaticMarkup(createElement(C));
    expect(api.state).toBe(state);
    expect(api.pending).toBe(true);
    api.setVariant(4, 'C');
    api.reset();
    expect(go).not.toHaveBeenCalled();
    const kinds = write.mock.calls.map((c) => (c[1] as TimelineChange).kind);
    expect(kinds).toEqual(['variant', 'reset']);
  });
});
