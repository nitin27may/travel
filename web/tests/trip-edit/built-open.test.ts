import { describe, expect, it } from 'vitest';
import type { PlanOp } from '@travel/core/plan/ops.ts';
import { PLAN_DRAFTS_SCHEMA, type PlanDraft } from '@travel/core/schema/plan-draft.ts';
import type { StorageLike } from '@travel/core/schema/copies.ts';
import { builtFacts, findBuilt, missRows, placedBuild, writeBuilt } from '@/lib/trip-edit/built';
import { openTrip, saveOps } from '@/lib/trip-edit/open';
import { consumeBuilt } from '@/components/trips/edit/built/useJustBuilt';
import { PLANS_LOCAL_KEY } from '@/lib/plan/keys';
import { sampleDraft } from '../../../core/test/plan/helpers';
import { copy, ID_A, ID_B, memory } from './helpers';

// STEP2-B1: a trip the builder made opens from the plans list on the same page as a copy, and an edit is written back to the same item.

const op = (o: Record<string, unknown>): PlanOp => ({ id: `o-${Math.random().toString(36).slice(2, 10)}`, ...o }) as PlanOp;

function built(over: Partial<PlanDraft> = {}): PlanDraft {
  const d = sampleDraft({ id: ID_A, nights: 2, where: { mode: 'trip', cc: 'CA', regions: [] }, edits: [], ...over });
  return d;
}

function store(items: unknown[], schema: string = PLAN_DRAFTS_SCHEMA): StorageLike {
  const m = new Map<string, string>([[PLANS_LOCAL_KEY, JSON.stringify({ schema, items })]]);
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) };
}

describe('openTrip for a built trip', () => {
  it('reads the document from the plans list: device, no copy item', () => {
    const r = openTrip(ID_A, { storage: store([built()]) });
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.where).toBe('device');
    expect(r.copy).toBeNull();
    expect(r.doc.template).toBeUndefined();
    expect(r.doc.lastBuild).not.toBeNull();
  });

  it('is not found for another id, and the same answer as an empty device', () => {
    expect(openTrip(ID_B, { storage: store([built()]) })).toEqual({ kind: 'missing' });
    expect(openTrip(ID_A, { storage: memory() })).toEqual({ kind: 'missing' });
  });

  it('a list written by a newer site is newer, never overwritten', () => {
    const s = store([built()], 'plan-drafts/2');
    expect(openTrip(ID_A, { storage: s })).toEqual({ kind: 'newer' });
    expect(saveOps(ID_A, [op({ kind: 'removePick', ref: 'place/arrowhead' })], { storage: s })).toEqual({ ok: false, reason: 'newer' });
    expect(JSON.parse(s.getItem(PLANS_LOCAL_KEY)!).schema).toBe('plan-drafts/2');
  });

  it('a copy with the same id wins; a document that does not validate is missing', () => {
    expect(findBuilt(store([{ id: ID_A, schema: 'plan-draft/1', where: {} }]), ID_A)).toEqual({ kind: 'missing' });
    const both = memory([copy()]);
    const r = openTrip(ID_A, { storage: both });
    expect(r.kind === 'ok' && r.copy?.id).toBe(ID_A);
  });
});

describe('saveOps on a built trip', () => {
  it('removes a pick and writes the document back in place, other items untouched', () => {
    const other = built({ id: ID_B, title: 'Other' });
    const s = store([built(), other]);
    expect(saveOps(ID_A, [op({ kind: 'removePick', ref: 'place/arrowhead' })], { storage: s })).toEqual({ ok: true });
    const items = JSON.parse(s.getItem(PLANS_LOCAL_KEY)!).items as PlanDraft[];
    expect(items.map((d) => d.id)).toEqual([ID_A, ID_B]);
    expect(items[0]!.picks.map((p) => p.ref)).not.toContain('place/arrowhead');
    expect(items[1]!.title).toBe('Other');
    const again = openTrip(ID_A, { storage: s });
    expect(again.kind === 'ok' && placedBuild(again.doc)?.lastBuild?.days.flatMap((d) => d.items.map((i) => i.ref))).not.toContain('place/arrowhead');
  });

  it('adds a place with addPick as "added", and refuses an operation that does not apply, writing nothing', () => {
    const s = store([built()]);
    const add = op({ kind: 'addPick', ref: 'place/moraine-lake', slug: 'moraine-lake', name: 'Moraine Lake', day: 2 });
    expect(saveOps(ID_A, [add], { storage: s })).toEqual({ ok: true });
    const doc = (JSON.parse(s.getItem(PLANS_LOCAL_KEY)!).items as PlanDraft[])[0]!;
    expect(doc.picks.find((p) => p.ref === 'place/moraine-lake')?.added).toBe(true);
    const before = s.getItem(PLANS_LOCAL_KEY);
    expect(saveOps(ID_A, [op({ kind: 'moveItem', ref: 'place/nowhere', toDay: 1 })], { storage: s })).toEqual({ ok: false, reason: 'invalid' });
    expect(s.getItem(PLANS_LOCAL_KEY)).toBe(before);
  });

  it('writeBuilt is missing for an id not in the list and sets updatedAt', () => {
    const s = store([built()]);
    expect(writeBuilt(s, built({ id: ID_B }))).toEqual({ ok: false, reason: 'missing' });
    expect(writeBuilt(s, built(), new Date('2026-10-28T12:00:00Z'))).toEqual({ ok: true });
    expect((JSON.parse(s.getItem(PLANS_LOCAL_KEY)!).items as PlanDraft[])[0]!.updatedAt).toBe('2026-10-28T12:00:00.000Z');
  });
});

describe('the build words', () => {
  it('says the build in parts, leaving zero parts out', () => {
    const f = builtFacts(built())!;
    expect(f.line).toMatch(/^Built \d+ days? · 1 did not fit/);
    expect(f.line).toContain('to check');
    const clean = built();
    clean.lastBuild = { ...clean.lastBuild!, didNotFit: [], days: clean.lastBuild!.days.map((d) => ({ ...d, warnings: [] })) };
    expect(builtFacts(clean)!.line).toMatch(/^Built \d+ days? · all fit$/);
    expect(builtFacts(sampleDraft({ lastBuild: null }))).toBeNull();
  });

  it('lists what did not fit with the engine\'s reason or the code\'s words, and drops a pick the person placed or removed', () => {
    const rows = missRows(built());
    expect(rows.map((m) => m.ref)).toEqual(['place/arrowhead']);
    expect(rows[0]!.why).toBe('No day had room for it.');
    const placed = built({ edits: [{ day: 1, refs: ['place/arrowhead'], locked: [] }] });
    expect(missRows(placed)).toEqual([]);
    const gone = built({ picks: built().picks.filter((p) => p.ref !== 'place/arrowhead') });
    expect(missRows(gone)).toEqual([]);
  });
});

describe('built=1 is consumed once', () => {
  it('lands on Days when the address names no tab and removes the key', () => {
    expect(consumeBuilt(new URL('https://x.test/t/a/?edit=1&built=1'), true)).toBe('/t/a/?edit=1&view=day&built=1');
    expect(consumeBuilt(new URL('https://x.test/t/a/?edit=1&view=day&built=1'), false)).toBe('/t/a/?edit=1&view=day');
    expect(consumeBuilt(new URL('https://x.test/t/a/?view=day#day-2'), false)).toBe('/t/a/?view=day#day-2');
    expect(consumeBuilt(new URL('https://x.test/t/a/?edit=1&view=table&built=1'), true)).toBe('/t/a/?edit=1&view=table&built=1');
  });
});
