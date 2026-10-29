// The day actions of a built trip (edit-mode-spec 6, 13.1 built column; STEP2-B2): Add a day after Day n, Drop Day n (its stops move to
// another day or go with it), Reset Day n (to the built plan), a day's note, and Move Day n earlier or later inside one base's run. Pure:
// the document and the day as the page numbers it (built days are numbered, never named by an operation id) go in, operations come out.
import { BUILT_NIGHTS_MAX, builtDays, resetBuiltDayOps } from '@/lib/trip-edit/built';
import type { PlanDraft, PlanOp } from '@/lib/trip-edit/model';
import { newOpId } from '@/lib/trip-edit/stopOps';

type NewId = () => string;

/** The days a built trip holds now. */
export const builtDayCount = (d: PlanDraft): number => (d.nights === null ? 1 : d.nights + 1);

/** Why Add a day is not possible, or null (a trip near home and a trip by air have their own longest plans). */
export function addBuiltDayBlock(d: PlanDraft): string | null {
  const max = BUILT_NIGHTS_MAX[d.where.mode];
  return d.nights !== null && d.nights >= max ? `A trip like this holds at most ${max + 1} days` : null;
}

export const addBuiltDayOps = (n: number, newId: NewId = newOpId): PlanOp[] => [{ kind: 'insertDay', id: newId(), after: n }];

export type BuiltDrop = { kind: 'move'; to: number } | { kind: 'remove' };
/** Drop Day n: its stops move to the end of `to`, or go with the day. `to` is the day as it shows before the drop. */
export const dropBuiltDayOps = (n: number, how: BuiltDrop, newId: NewId = newOpId): PlanOp[] => [{ kind: 'dropDay', id: newId(), day: n, ...(how.kind === 'move' ? { to: how.to } : {}) }];

export const builtDayNote = (d: PlanDraft, n: number): string => d.notes?.[String(n)] ?? '';
export function builtDayNoteOps(n: number, text: string, newId: NewId = newOpId): PlanOp[] {
  const t = text.trim();
  return [{ kind: 'setNote', id: newId(), key: String(n), text: t === '' ? null : t }];
}

/** Reset Day n to the built plan (lib/trip-edit/built.ts `resetBuiltDayOps`), or null when it already is. */
export const resetBuiltDay = (d: PlanDraft, n: number, newId: NewId = newOpId): PlanOp[] | null => resetBuiltDayOps(d, n, newId);

/**
 * Move Day n one day earlier (-1) or later (1): only inside one base's run of the last build, and never a move day (core `moveDay`'s rule,
 * asked here first so the menu can say why not). Null when it cannot move that way.
 */
export function moveBuiltDayOps(d: PlanDraft, n: number, dir: -1 | 1, newId: NewId = newOpId): PlanOp[] | null {
  const to = n + dir;
  const days = d.lastBuild?.days ?? [];
  const a = days.find((x) => x.day === n);
  const b = days.find((x) => x.day === to);
  if (!a || !b || to < 1 || to > builtDayCount(d)) return null;
  if (a.base === null || a.base !== b.base || a.move || b.move) return null;
  return [{ kind: 'moveDay', id: newId(), day: n, to }];
}

/** The stops on Day n now, by ref (for the drop question and the empty-day line). */
export const builtStopsOn = (d: PlanDraft, n: number): string[] => builtDays(d).find((x) => x.day === n)?.refs ?? [];

/** "Dropped Day 4 · its 2 stops moved to Day 3" (the day it moved to keeps its place; past the dropped day it shows one lower). */
export function droppedBuiltWords(n: number, how: BuiltDrop, stops: number): string {
  if (stops === 0) return `Dropped Day ${n}`;
  if (how.kind === 'move') return `Dropped Day ${n} · ${stops === 1 ? 'its stop moved' : `its ${stops} stops moved`} to Day ${how.to > n ? how.to - 1 : how.to}`;
  return `Dropped Day ${n} and ${stops === 1 ? 'its stop' : `its ${stops} stops`}`;
}
