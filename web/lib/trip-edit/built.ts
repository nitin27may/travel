// A built trip read on the details page (STEP2-T1): the last build's days with the person's edits applied. Placement is core's
// `builtDays` (the one rule the page model and the re-flow read); this only turns it into the day list `tripPageModelForBuilt` takes.
import { builtDays } from '@travel/core/plan/ops.ts';
import type { PlanDayOut, PlanDraft, PlanItemOut } from '@travel/core/schema/plan-draft.ts';

/** A stop the build did not place: no time, no drive (the page then reads the day in parts of the day, never with invented clock times). */
function untimed(ref: string, d: PlanDraft): PlanItemOut | null {
  const pick = d.picks.find((p) => p.ref === ref);
  return pick ? { ref, slug: pick.slug, name: pick.name, startMin: null, visitMin: 60, driveMin: null, basis: null, locked: false } : null;
}

/**
 * The draft's last build with every day's stops as `builtDays` places them: a stop on the day the build put it keeps its time and drive,
 * a stop moved or added by the person is untimed. Null when there is no build ("Not built yet").
 */
export function placedBuild(d: PlanDraft): PlanDraft | null {
  const build = d.lastBuild;
  if (!build) return null;
  const byRef = new Map<string, { item: PlanItemOut; day: number }>();
  for (const day of build.days) for (const it of day.items) byRef.set(it.ref, { item: it, day: day.day });
  const buildDay = new Map(build.days.map((b) => [b.day, b]));
  const days: PlanDayOut[] = builtDays(d).map((b) => {
    const was = buildDay.get(b.day);
    const items = b.refs.flatMap((ref) => {
      const hit = byRef.get(ref);
      const item = hit && hit.day === b.day ? hit.item : untimed(ref, d);
      return item ? [item] : [];
    });
    return { day: b.day, base: was?.base ?? null, move: was?.move ?? false, items, returnMin: b.edited ? null : (was?.returnMin ?? null), warnings: was?.warnings ?? [], reasons: was?.reasons ?? [] };
  });
  return { ...d, lastBuild: { ...build, days } };
}
