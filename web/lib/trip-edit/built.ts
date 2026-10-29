// A built trip read on the details page (STEP2-T1): the last build's days with the person's edits applied. Placement is core's
// `builtDays` (the one rule the page model and the re-flow read); this only turns it into the day list `tripPageModelForBuilt` takes.
import { builtDays, touchDraft, type PlanOp } from '@travel/core/plan/ops.ts';
import { parsePlanDraft, PLAN_DRAFTS_SCHEMA, type PlanDayOut, type PlanDraft, type PlanItemOut } from '@travel/core/schema/plan-draft.ts';
import type { StorageLike } from '@travel/core/schema/copies.ts';
import { buildChecks } from '@travel/core/plan/summary.ts';
import { PLANS_LOCAL_KEY } from '@/lib/plan/keys';

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

// ---- the device list of built documents (`plan-drafts/1`, the builder's list; the hand-off writes it) -----------------------------------
// The trip page opens a built trip from here when the id is not a copy, and writes an edit back to the same item. Read whole and written
// whole, other items untouched; a list from a newer site is left as it is. Pure over a `StorageLike`.

export type FindBuilt = { kind: 'ok'; doc: PlanDraft } | { kind: 'missing' } | { kind: 'newer' };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function readList(storage: StorageLike): { items: unknown[] } | 'newer' | null {
  let raw: string | null;
  try {
    raw = storage.getItem(PLANS_LOCAL_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!isObj(v)) return null;
    if (v.schema !== PLAN_DRAFTS_SCHEMA) return typeof v.schema === 'string' && /^plan-drafts\/\d+$/.test(v.schema) ? 'newer' : null;
    return { items: Array.isArray(v.items) ? v.items : [] };
  } catch {
    return null;
  }
}

/** The builder's document with this id: validated when opened (the start chunk never loads the schema). A draft with no build is a document too. */
export function findBuilt(storage: StorageLike, id: string): FindBuilt {
  const list = readList(storage);
  if (list === 'newer') return { kind: 'newer' };
  if (!list) return { kind: 'missing' };
  const item = list.items.find((x) => isObj(x) && x.id === id);
  if (!item) return { kind: 'missing' };
  const r = parsePlanDraft(item);
  if (!r.success) return { kind: 'missing' };
  // a copy's document (template) lives in `copies/2`; only a built document is opened from this list
  return r.data.template ? { kind: 'missing' } : { kind: 'ok', doc: r.data };
}

export type WriteBuilt = { ok: true } | { ok: false; reason: 'missing' | 'newer' | 'storage' | 'full' };

/** Replaces the item with this id by `doc` (updatedAt set), in place. */
export function writeBuilt(storage: StorageLike, doc: PlanDraft, now: Date = new Date()): WriteBuilt {
  const list = readList(storage);
  if (list === 'newer') return { ok: false, reason: 'newer' };
  if (!list || !list.items.some((x) => isObj(x) && x.id === doc.id)) return { ok: false, reason: 'missing' };
  const next = touchDraft(doc, now);
  const items = list.items.map((x) => (isObj(x) && x.id === doc.id ? next : x));
  try {
    storage.setItem(PLANS_LOCAL_KEY, JSON.stringify({ schema: PLAN_DRAFTS_SCHEMA, items }));
    return { ok: true };
  } catch (e) {
    const n = (e as { name?: string } | null)?.name;
    return { ok: false, reason: n === 'QuotaExceededError' ? 'full' : 'storage' };
  }
}

// ---- the words of the just-built line and the Summary's build block (Step 2 ruling R2, C2; patterns 3.10 item 1) ----------------------

const hm = (min: number): string => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}` : `${min} min`);

export interface BuiltFacts {
  /** the days as they stand (the person may have added or dropped one) */
  days: number;
  didNotFit: number;
  fix: number;
  check: number;
  /** "Built 8 days · 1 did not fit · 1 to fix · 2 to check"; "all fit" when nothing is left out and nothing is flagged; zero parts are left out */
  line: string;
  /** "2 h 30 driving a day ≈ · 1 move"; '' when the build drives nowhere and moves nowhere */
  checks: string;
  estimated: boolean;
}

/** The build's own facts, derived and never stored. Null with no build. */
export function builtFacts(d: PlanDraft): BuiltFacts | null {
  const b = d.lastBuild;
  if (!b) return null;
  const c = buildChecks(b);
  const days = builtDays(d).length;
  const parts = [`Built ${days} ${days === 1 ? 'day' : 'days'}`];
  if (c.didNotFit) parts.push(`${c.didNotFit} did not fit`);
  else if (!c.fix && !c.check) parts.push('all fit');
  if (c.fix) parts.push(`${c.fix} to fix`);
  if (c.check) parts.push(`${c.check} to check`);
  const checks = [c.driveDayAvgMin ? `${hm(c.driveDayAvgMin)} driving a day${c.estimated ? ' \u2248' : ''}` : '', c.moves ? `${c.moves} ${c.moves === 1 ? 'move' : 'moves'}` : ''].filter(Boolean).join(' \u00b7 ');
  return { days, didNotFit: c.didNotFit, fix: c.fix, check: c.check, line: parts.join(' \u00b7 '), checks, estimated: c.estimated };
}

export interface MissRow {
  ref: string;
  name: string;
  /** the engine's reason in its own words (a figure and its source), or the code's plain reading */
  why: string;
}

const MISS_WORDS: Record<string, string> = {
  TB_TOO_FAR: 'Too far from the bases for the drive limit.',
  TB_CLOSED: 'Closed in the month of the trip.',
  TB_FIT: 'Does not suit the party as planned.',
  TB_TIME: 'No day had room for it.',
  TB_BOOKING: 'Needs a booking the plan could not place.',
  TB_UNKNOWN: 'Not enough is known about it to place it.',
};

/** What the build left out, named from the picks, minus the ones the person has since removed or placed themselves. */
export function missRows(d: PlanDraft): MissRow[] {
  const b = d.lastBuild;
  if (!b) return [];
  const placed = new Set(builtDays(d).flatMap((x) => x.refs));
  return b.didNotFit.flatMap((m) => {
    const pick = d.picks.find((p) => p.ref === m.ref);
    if (!pick || placed.has(m.ref)) return [];
    return [{ ref: m.ref, name: pick.name, why: m.reasons[0]?.text ?? MISS_WORDS[m.code] ?? 'It did not fit.' }];
  });
}

/**
 * The operation that puts a catalogue place on a day, in the document's own form (edit-mode-spec 13.1): a copy's `addPlace`, a built trip's
 * `addPick` ("Added by you", placed by the person on that day). `day` is the document's name for the day (`dayRef`); a built trip's is its number.
 */
export function addPlaceOp(d: PlanDraft, day: number | string, slug: string, name: string, id: string): PlanOp {
  if (d.template) return { kind: 'addPlace', id, day, ref: `place/${slug}` } as PlanOp;
  return { kind: 'addPick', id, ref: `place/${slug}`, slug, name: name.slice(0, 120), day: Number(day) } as PlanOp;
}
