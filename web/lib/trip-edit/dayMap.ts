// Which published day a displayed day is (STEP2-E4). A copy shows its days as Day 1, 2, 3 ... (`TemplateDay.n`), but the document names a
// day by its REF: a published day's number, or the operation id of a day the person inserted. Dropping Day 3 makes published Day 4 show as
// Day 3; inserting after Day 2 makes published Day 3 show as Day 4. Every operation that names a day goes through `refOfDay`, every label
// of a day in a document row goes through `nOfRef`. Pure, and it needs no count of the published days: the days past the last insert or
// drop shift by one constant, so the walk stops as soon as it has the day asked for. Mirrors core's `scheduleTemplate` ordering (inserts
// after Day 0 first, then each published day followed by the days inserted after it, in operation order).
import type { PlanDayOp } from '@travel/core/schema/plan-draft.ts';

export type DayRef = number | string;
export interface DaySlot {
  n: number;
  ref: DayRef;
  inserted: boolean;
}

/** The first `upto` days of the copy, in order. */
export function daySlots(ops: readonly PlanDayOp[], upto: number): DaySlot[] {
  const dropped = new Set<number>();
  const after = new Map<number, string[]>();
  for (const x of ops) {
    if (x.kind === 'drop') {
      if (typeof x.day === 'number') dropped.add(x.day);
    } else {
      after.set(x.after, [...(after.get(x.after) ?? []), x.op]);
    }
  }
  const out: DaySlot[] = [];
  const put = (ref: DayRef, inserted: boolean): void => void (out.length < upto && out.push({ n: out.length + 1, ref, inserted }));
  for (const op of after.get(0) ?? []) put(op, true);
  for (let p = 1; out.length < upto && p < upto + ops.length + 2; p++) {
    if (!dropped.has(p)) put(p, false);
    for (const op of after.get(p) ?? []) put(op, true);
  }
  return out;
}

/** The ref of displayed Day `n`; the number itself when the copy has no day edits (and for a day past the walk). */
export function refOfDay(ops: readonly PlanDayOp[], n: number): DayRef {
  if (!ops.length) return n;
  return daySlots(ops, n)[n - 1]?.ref ?? n;
}

/** The displayed number of a day ref, or null when that day is dropped (or the ref names nothing). */
export function nOfRef(ops: readonly PlanDayOp[], ref: DayRef): number | null {
  if (!ops.length) return typeof ref === 'number' ? ref : null;
  if (typeof ref === 'number' && ops.some((x) => x.kind === 'drop' && x.day === ref)) return null;
  // an inserted day can sit after any published day: walk far enough to reach the last one an insert names
  const reach = typeof ref === 'number' ? ref : Math.max(0, ...ops.map((x) => (x.kind === 'insert' ? x.after : 0)));
  const slots = daySlots(ops, reach + ops.length + 1);
  return slots.find((s) => s.ref === ref)?.n ?? null;
}

/** The words for a day of the document: "Day 4", or "Day 3 of our plan" for a published day that has been dropped. */
export function dayWordOf(ops: readonly PlanDayOp[], ref: DayRef): string {
  const n = nOfRef(ops, ref);
  if (n !== null) return `Day ${n}`;
  return typeof ref === 'number' ? `Day ${ref} of our plan` : 'a day you added';
}
