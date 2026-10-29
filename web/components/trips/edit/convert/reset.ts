// "Reset to our plan" after a conversion (edit-mode-spec 5 "After conversion the same label replaces the trip with our current plan as a
// new copy in place"): `toTemplate` with a fresh block of our trip. Its inverse is `convert` with everything the person had, so Undo
// brings the trip back. Needs our trip's length and country, read once from the catalogue (P9: one trip a call).
import { emptyPlanTemplate, type PlanDraft, type PlanOp } from '@/lib/trip-edit/model';
import { newOpId } from '@/lib/trip-edit/stopOps';

/** True for a trip that was a copy and is the person's own now. */
export const isConverted = (d: PlanDraft): boolean => !d.template && d.convertedAt !== undefined && !!d.seed;

/** The operations that put our current plan back as a copy, or null when our trip cannot be read now. */
export async function resetOps(d: PlanDraft): Promise<PlanOp[] | null> {
  const seed = d.seed;
  if (!seed || d.template) return null;
  try {
    const [{ tripPlanModel }, { resolveRefs }] = await Promise.all([import('@/lib/trip-edit/planModel'), import('@/lib/client/data')]);
    const [model, rows] = await Promise.all([tripPlanModel(seed), resolveRefs([`trip:${seed}`])]);
    const cc = d.where.mode === 'trip' ? d.where.cc : (rows?.[0]?.cc ?? null);
    if (!model || !cc || !/^[A-Z]{2}$/.test(cc)) return null;
    return [{ kind: 'toTemplate', id: newOpId(), template: emptyPlanTemplate(seed), nights: Math.max(0, model.days.length - 1), cc } as PlanOp];
  } catch {
    return null;
  }
}
