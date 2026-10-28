import { describe, expect, it } from 'vitest';
import { builtDays, type PlanOp } from '@travel/core/plan/ops.ts';
import { applyOp } from '@travel/core/plan/ops.ts';
import { tripPageModelForBuilt } from '@travel/core/plan/pageModel.ts';
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { placedBuild } from '@/lib/trip-edit/built';
import { sampleDraft } from '../../../core/test/plan/helpers';

// A built trip on the details page (STEP2-T1): the last build with every day's stops placed by core's builtDays (the person's edits over
// the build), never by a second placement rule here.

function built(): PlanDraft {
  return sampleDraft({
    where: { mode: 'trip', cc: 'IT', regions: [] },
    nights: 1,
    picks: [
      { ref: 'place/a', slug: 'a', name: 'Alpha', must: false },
      { ref: 'place/b', slug: 'b', name: 'Beta', must: false },
      { ref: 'place/c', slug: 'c', name: 'Gamma', must: false },
    ],
    bases: [{ town: 'it-tn-alpha', nights: 1, pinned: true }],
    edits: [],
    lastBuild: {
      engine: 'tb-e1.1', basis: 'estimate',
      bases: [{ town: 'it-tn-alpha', name: 'Alpha', nights: 1, pinned: true, picks: 3, reasons: [] }],
      days: [
        { day: 1, base: 'it-tn-alpha', move: false, returnMin: 20, warnings: [], reasons: [], items: [
          { ref: 'place/a', slug: 'a', name: 'Alpha', startMin: 540, visitMin: 120, driveMin: 10, basis: 'estimate', locked: false },
          { ref: 'place/b', slug: 'b', name: 'Beta', startMin: 720, visitMin: 60, driveMin: 10, basis: 'estimate', locked: false },
        ] },
        { day: 2, base: 'it-tn-alpha', move: false, returnMin: 15, warnings: [], reasons: [], items: [
          { ref: 'place/c', slug: 'c', name: 'Gamma', startMin: 600, visitMin: 90, driveMin: 5, basis: 'estimate', locked: false },
        ] },
      ],
      didNotFit: [], spareDays: 0, builtAt: '2026-10-27T10:00:00.000Z',
    },
  });
}

const refsOf = (d: PlanDraft | null) => d?.lastBuild?.days.map((x) => x.items.map((i) => i.ref)) ?? [];

describe('placedBuild', () => {
  it('is the build itself when nothing was edited, and null with no build', () => {
    const d = built();
    expect(refsOf(placedBuild(d))).toEqual([['place/a', 'place/b'], ['place/c']]);
    expect(placedBuild(sampleDraft({ lastBuild: null }))).toBeNull();
  });

  it('places stops as builtDays does after the person moved one, and an untimed stop carries no clock time', () => {
    const d0 = built();
    const move = applyOp(d0, { kind: 'moveItem', id: 'o-m1', ref: 'place/b', toDay: 2, first: true } as PlanOp);
    expect(move.ok, JSON.stringify(move)).toBe(true);
    const d = (move as { doc: PlanDraft }).doc;
    const placed = placedBuild(d)!;
    // the same order core's placement gives
    expect(refsOf(placed)).toEqual(builtDays(d).map((b) => b.refs));
    expect(refsOf(placed)).toEqual([['place/a'], ['place/b', 'place/c']]);
    const day2 = placed.lastBuild!.days[1].items;
    expect(day2[0]).toMatchObject({ ref: 'place/b', startMin: null, driveMin: null });
    expect(day2[1]).toMatchObject({ ref: 'place/c', startMin: 600 });
    // the page model reads it: day 2 lists both stops
    const m = tripPageModelForBuilt(placed, [])!;
    expect(m.days[1].stops.map((s) => s.id)).toEqual(['place/b', 'place/c']);
  });

  it('a pick added by the person with no day yet is not invented onto a day', () => {
    const d0 = built();
    const add = applyOp(d0, { kind: 'addPick', id: 'o-p1', ref: 'place/d', slug: 'd', name: 'Delta' } as PlanOp);
    expect(add.ok, JSON.stringify(add)).toBe(true);
    const placed = placedBuild((add as { doc: PlanDraft }).doc)!;
    expect(refsOf(placed).flat()).not.toContain('place/d');
  });
});
