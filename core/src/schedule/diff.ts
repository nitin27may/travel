// What an addition changed in a day (spec 3.7): which entries moved and which went away. The page shows it for one viewing; the
// property test in web/tests/trips/add-invariants.test.ts holds it to the real difference between the two timelines.
import type { DayTimeline, TimelineEntry } from "./types.ts";

const at = (s: string): number => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const reported = (e: TimelineEntry): boolean => e.kind !== "leg" && e.kind !== "sun";

/**
 * `moved`: entry id to minutes (later is positive), rounded to 5; an entry whose start did not change is not in it.
 * `gone`: entries of the first timeline that the second no longer has (a rest the day no longer has room for).
 * Entries are paired by their stable id.
 */
export function diffTimelines(before: DayTimeline, after: DayTimeline): { moved: Map<string, number>; gone: TimelineEntry[] } {
  const was = new Map(before.entries.filter(reported).map((e) => [e.id, e]));
  const moved = new Map<string, number>();
  const now = new Set<string>();
  for (const e of after.entries) {
    if (!reported(e)) continue;
    now.add(e.id);
    const w = was.get(e.id);
    const d = w ? Math.round((at(e.start) - at(w.start)) / 5) * 5 : 0;
    if (d !== 0) moved.set(e.id, d);
  }
  return { moved, gone: [...was.values()].filter((e) => !now.has(e.id)) };
}
