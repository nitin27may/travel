import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyOps, builtDays, type PlanOp } from '@travel/core/plan/ops.ts';
import type { PlanDraft, PlanOutputs } from '@travel/core/schema/plan-draft.ts';
import {
  BUILT_KEY,
  buildOps,
  builtDayChecks,
  builtMarks,
  builtShareUrl,
  editsAfterBuild,
  keepOps,
  keepState,
  keptCounts,
  keptWords,
  mustOps,
  rebuildInput,
  reflowOffer,
  resetBuiltDayOps,
  staleDays,
} from '@/lib/trip-edit/built';
import { moveToDayOps } from '@/lib/trip-edit/stopOps';
import { reflow } from '@/lib/trip-edit/reflow';
import { warnLevel } from '@travel/core/plan/warnings.ts';
import { stagedChanges, applyLine, rebuildLine } from '@/components/trips/edit/settings/built/apply';
import { stateOfDraft } from '@/lib/plan/draft';
import { sampleDraft } from '../../../core/test/plan/helpers';

// STEP2-B2: a built trip edited like a copy. Keep on Day n and Must see through the operations the item sheet sends, the marks, the
// re-flow on the device (kept and placed stops stay), the Apply line, and Rebuild: a rebuild NEVER moves a kept stop, and one Undo puts
// the previous build back.

let n = 0;
const id = () => `o-t${(++n).toString(36).padStart(6, '0')}`;
const item = (ref: string, startMin: number, visitMin: number, driveMin: number) => ({ ref, slug: ref.slice(6), name: ref.slice(6).toUpperCase(), startMin, visitMin, driveMin, basis: 'estimate' as const, locked: false });

/** Three days at one base: a and b on Day 1, c and d on Day 2, e on Day 3. */
function built(over: Partial<PlanDraft> = {}): PlanDraft {
  return sampleDraft({
    where: { mode: 'trip', cc: 'CA', regions: [] },
    nights: 2,
    pace: 'standard',
    picks: ['a', 'b', 'c', 'd', 'e'].map((s) => ({ ref: `place/${s}`, slug: s, name: s.toUpperCase(), must: false })),
    bases: [],
    edits: [],
    lastBuild: {
      engine: 'tb-e1.1',
      basis: 'estimate',
      bases: [{ town: 'ca-ab-jasper', name: 'Jasper', nights: 2, pinned: false, picks: 5, reasons: [] }],
      days: [
        { day: 1, base: 'ca-ab-jasper', move: false, items: [item('place/a', 600, 90, 30), item('place/b', 750, 60, 20)], returnMin: 40, warnings: ['W_PACE', 'W_ORDER'], reasons: [{ code: 'day_drive', values: { driveMin: 90 }, text: '1 h 30 ≈ of driving' }] },
        { day: 2, base: 'ca-ab-jasper', move: false, items: [item('place/c', 540, 120, 25), item('place/d', 720, 60, 15)], returnMin: 30, warnings: [], reasons: [] },
        { day: 3, base: null, move: false, items: [item('place/e', 540, 60, 20)], returnMin: 60, warnings: [], reasons: [] },
      ],
      didNotFit: [],
      spareDays: 0,
      builtAt: '2026-10-27T10:00:00.000Z',
    },
    ...over,
  });
}

const apply = (d: PlanDraft, ops: PlanOp[]) => {
  const r = applyOps(d, ops);
  expect(r.skipped).toEqual([]);
  return r;
};
const entry = (ref: string, day: number) => ({ id: ref, day, title: ref.slice(6).toUpperCase() });
const dayOf = (d: PlanDraft, ref: string) => builtDays(d).find((b) => b.refs.includes(ref))?.day ?? null;

describe('Keep on Day n and Must see', () => {
  it('a move marks Moved by you and Kept on Day n, with the reason under the switch', () => {
    const d = apply(built(), moveToDayOps(built(), entry('place/a', 1) as never, 2, null, id)).doc;
    expect(builtMarks(d)({ id: 'place/a', day: 2 })).toEqual(['Moved by you', 'Kept on Day 2']);
    const s = keepState(d, 'place/a');
    expect(s).toMatchObject({ day: 2, on: true, placed: true });
    expect(s.reason).toBe('On because you placed it. Turn off to let the plan move it.');
    // a stop the person did not touch has no marks and the switch is off
    expect(builtMarks(d)({ id: 'place/c', day: 2 })).toEqual([]);
    expect(keepState(d, 'place/c').on).toBe(false);
  });

  it('on is lock, off is release: the switch goes off for a placed stop, and Undo puts it back', () => {
    const moved = apply(built(), moveToDayOps(built(), entry('place/a', 1) as never, 2, null, id)).doc;
    const off = apply(moved, keepOps('place/a', false, id));
    expect(keepState(off.doc, 'place/a').on).toBe(false);
    expect(builtMarks(off.doc)({ id: 'place/a', day: 2 })).toEqual([]);
    expect(dayOf(off.doc, 'place/a')).toBe(2);
    expect(apply(off.doc, off.inverse).doc.edits).toEqual(moved.edits);
    const on = apply(built(), keepOps('place/c', true, id)).doc;
    expect(keepState(on, 'place/c')).toMatchObject({ on: true, locked: true, placed: false });
    expect(builtMarks(on)({ id: 'place/c', day: 2 })).toEqual(['Kept on Day 2']);
  });

  it('Must see is setMust', () => {
    const d = apply(built(), mustOps('place/d', true, id)).doc;
    expect(keepState(d, 'place/d').must).toBe(true);
    expect(d.picks.find((p) => p.ref === 'place/d')!.must).toBe(true);
  });

  it('an added place reads Added by you, and the counts name kept and added apart', () => {
    let d = apply(built(), moveToDayOps(built(), entry('place/a', 1) as never, 2, null, id)).doc;
    d = apply(d, keepOps('place/e', true, id)).doc;
    d = apply(d, [{ kind: 'addPick', id: id(), ref: 'place/x', slug: 'x', name: 'X', day: 1 }, { kind: 'addPick', id: id(), ref: 'place/y', slug: 'y', name: 'Y', day: 3 }]).doc;
    d = apply(d, keepOps('place/c', true, id)).doc;
    expect(builtMarks(d)({ id: 'place/x', day: 1 })).toEqual(['Added by you', 'Kept on Day 1']);
    expect(keptCounts(d)).toEqual({ kept: 3, added: 2 });
    expect(keptWords(keptCounts(d))).toBe('3 kept and 2 added by you stay');
    expect(keptWords({ kept: 1, added: 0 })).toBe('1 kept stays');
    expect(keptWords({ kept: 0, added: 0 })).toBe('');
  });
});

describe('the device re-flow', () => {
  it('offers itself once a day no longer reads as the build', () => {
    expect(reflowOffer(built())).toBeNull();
    const d = apply(built(), moveToDayOps(built(), entry('place/a', 1) as never, 2, null, id)).doc;
    expect(staleDays(d)).toEqual([1, 2]);
    expect(reflowOffer(d)).toBe('Re-flow the rest? 1 kept stays');
  });

  it('times the changed days again; kept and placed stops stay on their day and in their order', () => {
    let d = apply(built(), moveToDayOps(built(), entry('place/a', 1) as never, 2, 'place/d', id)).doc;
    d = apply(d, keepOps('place/d', true, id)).doc;
    const r = reflow(d, { adults: 2, children: [] })!;
    expect(r.days).toEqual([1, 2]);
    const day2 = r.lastBuild.days.find((x) => x.day === 2)!;
    // d (locked) then a (placed after it) keep their order; the free stop c is put where it costs least
    const kept = day2.items.map((i) => i.ref).filter((x) => x === 'place/a' || x === 'place/d');
    expect(kept).toEqual(['place/d', 'place/a']);
    expect(day2.items.every((i) => i.startMin !== null)).toBe(true);
    // times run forward through the day
    const starts = day2.items.map((i) => i.startMin!);
    expect([...starts].sort((x, y) => x - y)).toEqual(starts);
    // the untouched day keeps the build's own figures
    expect(r.lastBuild.days.find((x) => x.day === 3)).toEqual(d.lastBuild!.days.find((x) => x.day === 3));
    // written back as one step, the days read as built again and the marks stay
    const after = apply(d, buildOps(d, r.lastBuild, id));
    expect(staleDays(after.doc)).toEqual([]);
    expect(dayOf(after.doc, 'place/a')).toBe(2);
    expect(builtMarks(after.doc)({ id: 'place/a', day: 2 })).toEqual(['Moved by you', 'Kept on Day 2']);
    expect(builtMarks(after.doc)({ id: 'place/d', day: 2 })).toEqual(['Kept on Day 2']);
    // and one Undo puts the device's previous days back
    expect(apply(after.doc, after.inverse).doc.lastBuild).toEqual(d.lastBuild);
  });

  it('a full day hands its lowest free stop to the nearest day with room; nothing is dropped', () => {
    const heavy = built({ pace: 'relaxed' });
    // three long visits on Day 1 (each stop's visit from the build)
    const big = { ...heavy, lastBuild: { ...heavy.lastBuild!, days: heavy.lastBuild!.days.map((x) => ({ ...x, items: x.items.map((i) => ({ ...i, visitMin: 200 })) })) } };
    const d = apply(big, moveToDayOps(big, entry('place/c', 2) as never, 1, null, id)).doc;
    const r = reflow(d, { adults: 2, children: [] })!;
    const all = r.lastBuild.days.flatMap((x) => x.items.map((i) => i.ref)).sort();
    expect(all).toEqual(['place/a', 'place/b', 'place/c', 'place/d', 'place/e']);
    // the placed stop stays on Day 1
    expect(r.lastBuild.days.find((x) => x.day === 1)!.items.some((i) => i.ref === 'place/c')).toBe(true);
    expect(r.moved.every((m) => m.ref !== 'place/c')).toBe(true);
  });
});

describe('Rebuild', () => {
  it('sends the kept stops as constraints with the inputs and the party, never more', () => {
    let d = apply(built(), moveToDayOps(built(), entry('place/a', 1) as never, 3, null, id)).doc;
    d = apply(d, keepOps('place/c', true, id)).doc;
    const input = rebuildInput(d, { adults: 2, children: [4] })!;
    expect(input.party).toEqual({ adults: 2, children: [4], walkKm: null });
    expect(input.picks).toHaveLength(5);
    expect(input.edits).toEqual([
      { day: 2, refs: ['place/c'], locked: ['place/c'] },
      { day: 3, refs: ['place/a'], locked: [], placed: ['place/a'] },
    ]);
  });

  it('NEVER moves a kept stop, whatever the build answers; one Undo restores the previous build and edits', () => {
    let d = apply(built(), moveToDayOps(built(), entry('place/a', 1) as never, 3, null, id)).doc;
    d = apply(d, keepOps('place/c', true, id)).doc;
    // a pace change, then an answer that put both kept stops elsewhere (or nowhere)
    const staged: PlanOp[] = [{ kind: 'setPace', id: id(), pace: 'relaxed' }];
    const next = apply(d, staged).doc;
    const answer: PlanOutputs = {
      ...d.lastBuild!,
      days: [
        { day: 1, base: 'ca-ab-jasper', move: false, items: [item('place/c', 600, 120, 20), item('place/b', 800, 60, 10)], returnMin: 30, warnings: [], reasons: [] },
        { day: 2, base: 'ca-ab-jasper', move: false, items: [item('place/d', 600, 60, 20)], returnMin: 30, warnings: [], reasons: [] },
        { day: 3, base: null, move: false, items: [item('place/e', 600, 60, 20)], returnMin: 30, warnings: [], reasons: [] },
      ],
      builtAt: '2026-10-28T10:00:00.000Z',
    };
    const all = apply(d, [...staged, ...buildOps(next, answer, id)]);
    expect(all.doc.pace).toBe('relaxed');
    expect(dayOf(all.doc, 'place/c')).toBe(2);
    expect(dayOf(all.doc, 'place/a')).toBe(3);
    expect(keepState(all.doc, 'place/c').on).toBe(true);
    expect(keepState(all.doc, 'place/a').placed).toBe(true);
    // a free stop goes where the build put it
    expect(dayOf(all.doc, 'place/b')).toBe(1);
    expect(all.doc.lastBuild!.builtAt).toBe('2026-10-28T10:00:00.000Z');
    // Undo: one step back to the trip as it was
    const back = apply(all.doc, all.inverse).doc;
    expect(back.lastBuild).toEqual(d.lastBuild);
    expect(back.edits).toEqual(d.edits);
    expect(back.pace).toBe('standard');
  });

  it('editsAfterBuild leaves days with nothing kept to the build', () => {
    const d = apply(built(), keepOps('place/e', true, id)).doc;
    const e = editsAfterBuild(d, d.lastBuild!);
    expect(e).toEqual([{ day: 3, refs: ['place/e'], locked: ['place/e'] }]);
  });
});

describe('the Apply line', () => {
  it('names what the staged sections change, and what stays', () => {
    const d = built();
    const flow = { ...stateOfDraft(d), nights: 4, bases: [{ town: 'ca-ab-banff', nights: 2, pinned: true }] };
    const s = stagedChanges(d, flow, null, id);
    expect(applyLine(s.parts)).toBe('Apply: 2 days longer, 1 base added');
    expect(s.ops.map((o) => o.kind)).toEqual(['setNights', 'setBase']);
    expect(s.blocked).toBeNull();
    expect(stagedChanges(d, stateOfDraft(d), 'relaxed', id).parts).toEqual(['pace Relaxed']);
    expect(stagedChanges(d, stateOfDraft(d), null, id).ops).toEqual([]);
    expect(rebuildLine(6, '3 kept and 2 added by you stay')).toBe('Rebuild 6 days · 3 kept and 2 added by you stay');
  });

  it('a new country is a new trip, and base nights cannot pass the trip\'s', () => {
    const d = built();
    expect(stagedChanges(d, { ...stateOfDraft(d), cc: 'IT', regions: [] }, null, id).blocked).toMatch(/new trip/);
    expect(stagedChanges(d, { ...stateOfDraft(d), bases: [{ town: 'ca-ab-banff', nights: 5, pinned: true }] }, null, id).blocked).toMatch(/add up to 5 nights/);
  });
});

describe('Reset Day n, checks and Share', () => {
  it('Reset Day n brings the day back to the build and its stops home', () => {
    const moved = apply(built(), moveToDayOps(built(), entry('place/a', 1) as never, 2, null, id)).doc;
    const ops = resetBuiltDayOps(moved, 2, id)!;
    const r = apply(moved, ops).doc;
    expect(builtDays(r).map((b) => b.refs)).toEqual([['place/a', 'place/b'], ['place/c', 'place/d'], ['place/e']]);
    expect(resetBuiltDayOps(built(), 2, id)).toBeNull();
  });

  it('a day\'s checks are the build\'s codes at their level, hidden ones left out', () => {
    const c = builtDayChecks(built(), 1, (code) => warnLevel(code));
    expect(c.checks).toEqual([{ code: 'W_PACE', level: 'check', text: 'Longer than your pace allows' }]);
    expect(c.line).toBe('1 h 30 ≈ of driving');
    const moved = apply(built(), moveToDayOps(built(), entry('place/a', 1) as never, 2, null, id)).doc;
    expect(builtDayChecks(moved, 1, (code) => warnLevel(code)).stale).toBe(true);
  });

  it('Share hands over the builder\'s public keys, never the id, the party or a date', () => {
    let d = built({ start: '2027-07-03', travellers: { adults: 2, children: [4] }, party: 'trip' });
    d = apply(d, keepOps('place/c', true, id)).doc;
    const url = builtShareUrl(d, 'https://example.test');
    expect(url.startsWith('https://example.test/plan/?')).toBe(true);
    const q = new URL(url).searchParams;
    expect(q.get('m')).toBe('trip');
    expect(q.get('cc')).toBe('CA');
    expect(q.get('p')).toBe('a,b,c,d,e');
    expect(q.get('o')).toBe('2:c');
    expect(url).not.toContain(d.id);
    expect(url).not.toMatch(/2027|adults|children/);
    expect(BUILT_KEY).not.toMatch(/[0-9a-f]{8}-/);
  });
});

describe('Rebuild through the settings runner', () => {
  afterEach(() => vi.resetModules());
  it('runs the staged ops, the server build and the edits it leaves as one step', async () => {
    let d = apply(built(), moveToDayOps(built(), entry('place/a', 1) as never, 3, null, id)).doc;
    d = apply(d, keepOps('place/c', true, id)).doc;
    const calls: unknown[] = [];
    vi.doMock('@/lib/client/data', () => ({
      planBuild: async (input: unknown) => {
        calls.push(input);
        return { ...d.lastBuild!, days: d.lastBuild!.days.map((x) => ({ ...x, items: x.items.filter((i) => i.ref !== 'place/c') })), matrix: { refs: [], minutes: [], estimated: [] }, builtAt: '2026-10-28T11:00:00.000Z' };
      },
    }));
    vi.doMock('@/lib/storage/partyKey', () => ({ readParty: () => null }));
    const { runRebuild } = await import('@/components/trips/edit/settings/built/rebuild');
    const steps: { ops: PlanOp[]; label: string }[] = [];
    const r = await runRebuild(d, [{ kind: 'setPace', id: id(), pace: 'full' }], (ops, label) => {
      steps.push({ ops, label });
      return true;
    });
    expect(r).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.label).toBe('Rebuilt 3 days · 2 kept stayed');
    const out = apply(d, steps[0]!.ops).doc;
    // the engine left c out; it is kept, so it stays on Day 2
    expect(dayOf(out, 'place/c')).toBe(2);
    expect(out.pace).toBe('full');
  });
});
