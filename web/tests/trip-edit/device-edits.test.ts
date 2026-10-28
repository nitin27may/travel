import { describe, expect, it } from 'vitest';
import { copyToPlanDraft } from '@travel/core/plan/doc.ts';
import { applyOps } from '@travel/core/plan/ops.ts';
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { storeDeviceEdits, withDeviceEdits } from '@/lib/trip-edit/deviceEdits';
import { copy, memory } from './helpers';

// STEP2-INT: `copies/1` names an added place by a published day number only, so a place added to a day the person inserted
// (its day is the insert's operation id) lives in the device envelope alone and must survive a read back.
const draft = (): PlanDraft => (copyToPlanDraft(copy({ slug: 'canadian-rockies-2029', days: 15, cc: 'CA', overrides: {}, added: [{ day: 4, placeSlug: 'jasper-dark-sky-preserve-stargazing' }] })) as { success: true; data: PlanDraft }).data;

describe('the device envelope and an added day', () => {
  it('keeps a place added to an inserted day when the copy lists the numbered adds the same', () => {
    const s = memory();
    const d0 = draft();
    const d1 = applyOps(d0, [{ kind: 'insertDay', id: 'o-day', after: 2 }]).doc;
    const d2 = applyOps(d1, [{ kind: 'addPlace', id: 'o-add', day: 'o-day', ref: 'place/bow-river-float-raft' }]).doc;
    expect(d2.template!.added.map((a) => a.day)).toEqual([4, 'o-day']);
    storeDeviceEdits(s, d0.id ?? 'x', d2, [d0.id ?? 'x']);
    const back = withDeviceEdits(s, d0.id ?? 'x', d0);
    expect(back.template!.days).toHaveLength(1);
    expect(back.template!.added.map((a) => a.day)).toEqual([4, 'o-day']);
    expect(back.template!.added[1]!.op).toBe('o-add');
  });
  it('still ignores a stored list whose numbered places differ from the copy (the copy changed elsewhere)', () => {
    const s = memory();
    const d0 = draft();
    const other = applyOps(d0, [{ kind: 'addPlace', id: 'o-x', day: 2, ref: 'place/lake-louise' }]).doc;
    storeDeviceEdits(s, d0.id ?? 'x', other, [d0.id ?? 'x']);
    expect(withDeviceEdits(s, d0.id ?? 'x', d0).template!.added).toEqual(d0.template!.added);
  });
});
