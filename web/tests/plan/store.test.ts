import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parsePlanDrafts, type PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { PLAN_BUILDER_UI } from '@/lib/config/product';
import { draftOf } from '@/lib/plan/draft';
import { builtHref, handOffBuilt, HandOffError } from '@/lib/plan/handoff';
import { PLANS_CHANGED_EVENT, PLANS_LOCAL_KEY, PLANS_UI_KEY } from '@/lib/plan/keys';
import { persistFlow } from '@/lib/plan/persist';
import { readDrafts, readFlow, removeDraft, saveDraft, writeFlow } from '@/lib/plan/store';
import { DOC_CHANGED_EVENT } from '@/lib/trip-edit/keys';
import { CHANGED_EVENT } from '@/lib/mine/keys';
import { fakeWindow, ID, nearFlow, outputs, tripFlow } from './helpers';

let w: ReturnType<typeof fakeWindow>;
beforeEach(() => {
  w = fakeWindow();
});
afterEach(() => vi.unstubAllGlobals());

const doc = (id = ID, updatedAt = '2026-10-28T10:00:00.000Z'): PlanDraft => ({ ...draftOf(nearFlow({ id }), 'blue')!, updatedAt });
const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('the device list (plan-drafts/1 under travel.plans.local)', () => {
  it('writes a list the core accepts, newest first, replacing by id', () => {
    expect(saveDraft(doc(uuid(1), '2026-10-28T10:00:00.000Z'))).toEqual({ ok: true });
    expect(saveDraft(doc(uuid(2), '2026-10-28T11:00:00.000Z'))).toEqual({ ok: true });
    expect(saveDraft({ ...doc(uuid(1), '2026-10-28T12:00:00.000Z'), title: 'Renamed' })).toEqual({ ok: true });
    const list = readDrafts();
    expect(list.drafts.map((d) => d.id)).toEqual([uuid(1), uuid(2)]);
    expect(list.drafts[0]!.title).toBe('Renamed');
    expect(parsePlanDrafts(JSON.parse(w.store.get(PLANS_LOCAL_KEY)!)).success).toBe(true);
    expect(w.events).toContain(PLANS_CHANGED_EVENT);
  });

  it('refuses a new draft past the device cap (X1) but still updates one that is there', () => {
    for (let i = 1; i <= PLAN_BUILDER_UI.deviceDrafts; i++) expect(saveDraft(doc(uuid(i))).ok).toBe(true);
    expect(saveDraft(doc(uuid(99)))).toEqual({ ok: false, reason: 'cap' });
    expect(saveDraft(doc(uuid(3)))).toEqual({ ok: true });
    expect(readDrafts().drafts).toHaveLength(PLAN_BUILDER_UI.deviceDrafts);
  });

  it('refuses a document over 16 KB and leaves a newer list alone', () => {
    const big = { ...doc(), title: null, picks: Array.from({ length: 40 }, (_, i) => ({ ref: `place/${'x'.repeat(300)}${i}`, slug: `s${i}`, name: 'N'.repeat(120), must: false })) };
    expect(saveDraft(big)).toEqual({ ok: false, reason: 'toolarge' });
    w.store.set(PLANS_LOCAL_KEY, JSON.stringify({ schema: 'plan-drafts/2', items: [] }));
    expect(readDrafts().status).toBe('newer');
    expect(saveDraft(doc())).toEqual({ ok: false, reason: 'newer' });
    expect(removeDraft(ID)).toBe(false);
    expect(JSON.parse(w.store.get(PLANS_LOCAL_KEY)!).schema).toBe('plan-drafts/2');
  });

  it('reads a broken list as empty and ignores items that are not documents', () => {
    w.store.set(PLANS_LOCAL_KEY, '{nope');
    expect(readDrafts()).toEqual({ drafts: [], status: 'ok' });
    w.store.set(PLANS_LOCAL_KEY, JSON.stringify({ schema: 'plan-drafts/1', items: [doc(), { id: 'x' }, 5] }));
    expect(readDrafts().drafts).toHaveLength(1);
  });

  it('removes one and clears the key when none is left', () => {
    saveDraft(doc());
    expect(removeDraft(ID)).toBe(true);
    expect(w.store.has(PLANS_LOCAL_KEY)).toBe(false);
  });

  it('says blocked when the browser keeps nothing', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: () => { throw new Error('denied'); }, removeItem: () => undefined }, dispatchEvent: () => true });
    expect(saveDraft(doc())).toEqual({ ok: false, reason: 'blocked' });
  });
});

describe('autosave', () => {
  it('writes the screen state always and the document from the first pick, keeping identity and any build', () => {
    persistFlow(nearFlow({ picks: [] }));
    expect(readFlow()?.id).toBe(ID);
    expect(readDrafts().drafts).toHaveLength(0);
    persistFlow(nearFlow());
    const first = readDrafts().drafts[0]!;
    expect(first.identity).toBe('blue');
    persistFlow(nearFlow({ nights: 1 }));
    expect(readDrafts().drafts[0]).toMatchObject({ identity: 'blue', nights: 1 });
    saveDraft({ ...first, lastBuild: outputs });
    persistFlow(nearFlow({ nights: 2 }));
    expect(readDrafts().drafts[0]!.lastBuild).toEqual(outputs);
    // a second draft takes the next colour
    persistFlow(nearFlow({ id: uuid(5) }));
    expect(readDrafts().drafts.find((d) => d.id === uuid(5))!.identity).toBe('orange');
  });

  it('reports the cap instead of dropping the draft silently', () => {
    for (let i = 1; i <= PLAN_BUILDER_UI.deviceDrafts; i++) saveDraft(doc(uuid(i)));
    expect(persistFlow(nearFlow({ id: uuid(77) }))).toEqual({ ok: false, reason: 'cap' });
  });

  it('screen state round-trips and a foreign value is ignored', () => {
    writeFlow(tripFlow());
    expect(readFlow()).toMatchObject({ kind: 'week_air', cc: 'IT' });
    w.store.set(PLANS_UI_KEY, JSON.stringify({ v: 2 }));
    expect(readFlow()).toBeNull();
    w.store.set(PLANS_UI_KEY, 'not json');
    expect(readFlow()).toBeNull();
  });
});

describe('handOffBuilt (the contract STEP2-B1 reads)', () => {
  const built = (): PlanDraft => ({ ...draftOf(tripFlow(), 'teal', outputs)! });

  it('stores the document, clears the screen state, tells the trip page and returns the address', () => {
    writeFlow(tripFlow());
    const url = handOffBuilt(built());
    expect(url).toBe(`/t/${ID}/?edit=1&built=1`);
    expect(url).toBe(builtHref(ID));
    expect(readDrafts().drafts[0]).toMatchObject({ id: ID, identity: 'teal', lastBuild: outputs });
    expect(w.store.has(PLANS_UI_KEY)).toBe(false);
    expect(w.events).toEqual(expect.arrayContaining([PLANS_CHANGED_EVENT, DOC_CHANGED_EVENT, CHANGED_EVENT]));
  });

  it('the address holds an id and two flags and nothing about the household', () => {
    const url = handOffBuilt(built());
    expect(url).toMatch(/^\/t\/[0-9a-f-]{36}\/\?edit=1&built=1$/);
    expect(url).not.toMatch(/start|party|adults|home|from/i);
  });

  it('replaces a draft of the same id (the draft the person was building becomes the built trip)', () => {
    saveDraft(doc());
    handOffBuilt(built());
    const list = readDrafts().drafts;
    expect(list).toHaveLength(1);
    expect(list[0]!.lastBuild).toEqual(outputs);
  });

  it('throws a reason when it cannot keep the plan, and writes nothing', () => {
    expect(() => handOffBuilt({ ...built(), lastBuild: null })).toThrow(HandOffError);
    try {
      handOffBuilt({ ...built(), lastBuild: null });
    } catch (e) {
      expect((e as HandOffError).reason).toBe('unbuilt');
    }
    for (let i = 1; i <= PLAN_BUILDER_UI.deviceDrafts; i++) saveDraft(doc(uuid(i)));
    try {
      handOffBuilt({ ...built(), id: uuid(50) });
      expect.unreachable();
    } catch (e) {
      expect((e as HandOffError).reason).toBe('cap');
    }
    expect(readDrafts().drafts.some((d) => d.id === uuid(50))).toBe(false);
  });
});
