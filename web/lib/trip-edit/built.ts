// A built trip read on the details page (STEP2-T1): the last build's days with the person's edits applied. Placement is core's
// `builtDays` (the one rule the page model and the re-flow read); this only turns it into the day list `tripPageModelForBuilt` takes.
import { builtDays, touchDraft, type BuiltDay, type PlanOp } from '@travel/core/plan/ops.ts';
import { parsePlanDraft, PLAN_DRAFTS_SCHEMA, PLAN_LIMITS, type PlanDayEdit, type PlanDayOut, type PlanDraft, type PlanItemOut, type PlanOutputs } from '@travel/core/schema/plan-draft.ts';
import type { PlanBuildAnswer, PlanBuildInput } from '@travel/core/schema/api/plan.ts';
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
    // a day the build still describes stop for stop (unedited, or re-flowed since) keeps its drive home; any other day is read without it
    const same = !!was && was.items.length === b.refs.length && was.items.every((it, i) => it.ref === b.refs[i]);
    return { day: b.day, base: was?.base ?? null, move: was?.move ?? false, items, returnMin: same ? (was?.returnMin ?? null) : null, warnings: was?.warnings ?? [], reasons: was?.reasons ?? [] };
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

/** The builder's list as items, or 'newer'; an absent or unreadable list is empty (STEP2-B3: `convertDevice.ts` moves a stored copy into it). */
export function plansItems(storage: StorageLike): unknown[] | 'newer' {
  const l = readList(storage);
  return l === 'newer' ? 'newer' : (l?.items ?? []);
}
/** Writes the builder's list whole (an empty one removes the key); the reason when storage refuses. */
export function putPlansItems(storage: StorageLike, items: unknown[]): { ok: true } | { ok: false; reason: 'full' | 'storage' } {
  try {
    if (items.length) storage.setItem(PLANS_LOCAL_KEY, JSON.stringify({ schema: PLAN_DRAFTS_SCHEMA, items }));
    else storage.removeItem(PLANS_LOCAL_KEY);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as { name?: string } | null)?.name === 'QuotaExceededError' ? 'full' : 'storage' };
  }
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

// ---- STEP2-B2: Keep on Day n, Must see, the marks, the re-flow offer, Reset Day n and Rebuild (edit-mode-spec 4.1, 5, 6, 8, 13.1) ---------

/** The placement rule and the longest plans, for the components (the fence keeps them off the plan code itself). */
export { builtDays };
export const BUILT_NIGHTS_MAX = { near: PLAN_LIMITS.nearNights, trip: PLAN_LIMITS.nights } as const;

/** A day's kept refs: locked, placed by the person, or from our trip (the three the engine and the re-flow never move). */
const keptOf = (b: BuiltDay): Set<string> => new Set([...b.locked, ...b.placed, ...b.fromTrip]);

export interface KeepState {
  /** the day the stop is on, or null (not on a day) */
  day: number | null;
  /** "Keep on Day n" is on */
  on: boolean;
  locked: boolean;
  placed: boolean;
  fromTrip: boolean;
  /** the pick was added by the person (not one the builder was given) */
  added: boolean;
  must: boolean;
  /** the line under the switch (TB-N2R R1) */
  reason: string;
}

/** The Keep on Day n and Must see state of one stop of a built trip. */
export function keepState(d: PlanDraft, ref: string): KeepState {
  const b = builtDays(d).find((x) => x.refs.includes(ref)) ?? null;
  const pick = d.picks.find((p) => p.ref === ref);
  const locked = !!b?.locked.includes(ref);
  const placed = !!b?.placed.includes(ref);
  const fromTrip = !!b?.fromTrip.includes(ref);
  const on = locked || placed || fromTrip;
  const n = b?.day ?? null;
  const reason = placed
    ? 'On because you placed it. Turn off to let the plan move it.'
    : fromTrip
      ? 'On because it came from our trip. Turn off to let the plan move it.'
      : locked
        ? `On: a rebuild keeps it on Day ${n}. Turn off to let the plan move it.`
        : 'Off: a rebuild or a re-flow may move it to another day.';
  return { day: n, on, locked, placed, fromTrip, added: !!pick?.added, must: !!pick?.must, reason };
}

const opId = (): string => `o-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

/** Keep on Day n: on is `lock`; off is `release` (the lock, placed-by-you and from-our-trip marks off, in one step). */
export function keepOps(ref: string, on: boolean, newId: () => string = opId): PlanOp[] {
  return [on ? { kind: 'lock', id: newId(), ref } : { kind: 'release', id: newId(), refs: [ref] }];
}
export const mustOps = (ref: string, must: boolean, newId: () => string = opId): PlanOp[] => [{ kind: 'setMust', id: newId(), ref, must }];

/**
 * The marks of a built stop (edit-mode-spec 4.1; README ruling R6): what the person did ("Added by you", "Moved by you", "From our trip"),
 * then "Kept on Day n" when the switch is on. At most two; words, never colour alone (P6).
 */
export function builtMarks(d: PlanDraft): (e: { id: string; day: number }) => string[] {
  const days = builtDays(d);
  const added = new Set(d.picks.filter((p) => p.added).map((p) => p.ref));
  return (e) => {
    const b = days.find((x) => x.day === e.day && x.refs.includes(e.id));
    const out: string[] = [];
    if (added.has(e.id)) out.push('Added by you');
    else if (b?.placed.includes(e.id)) out.push('Moved by you');
    else if (b?.fromTrip.includes(e.id)) out.push('From our trip');
    if (b && keptOf(b).has(e.id)) out.push(`Kept on Day ${b.day}`);
    return out;
  };
}

/** What stays where it is on a re-flow or a rebuild: the kept stops the plan gave or the person moved, and the places the person added. */
export function keptCounts(d: PlanDraft): { kept: number; added: number } {
  const added = new Set(d.picks.filter((p) => p.added).map((p) => p.ref));
  let kept = 0;
  let mine = 0;
  for (const b of builtDays(d)) for (const r of keptOf(b)) if (added.has(r)) mine++; else kept++;
  return { kept, added: mine };
}

/** "3 kept and 2 added by you stay"; "1 kept stays"; "" when nothing is kept. */
export function keptWords(c: { kept: number; added: number }): string {
  if (c.kept && c.added) return `${c.kept} kept and ${c.added} added by you stay`;
  if (c.kept) return `${c.kept} kept ${c.kept === 1 ? 'stays' : 'stay'}`;
  if (c.added) return `${c.added} added by you ${c.added === 1 ? 'stays' : 'stay'}`;
  return '';
}

/** The days the last build no longer describes stop for stop (a move, an add, a removal): the ones a re-flow would time again. */
export function staleDays(d: PlanDraft): number[] {
  const b = d.lastBuild;
  if (!b) return [];
  const byDay = new Map(b.days.map((x) => [x.day, x]));
  return builtDays(d).flatMap((x) => {
    const was = byDay.get(x.day);
    const refs = was ? was.items.map((i) => i.ref) : [];
    return refs.length === x.refs.length && refs.every((r, i) => r === x.refs[i]) ? [] : [x.day];
  });
}

/** "Re-flow the rest? 3 kept and 2 added by you stay": the offer after a move, while a day reads untimed. */
export function reflowOffer(d: PlanDraft): string | null {
  if (!staleDays(d).length) return null;
  const w = keptWords(keptCounts(d));
  return `Re-flow the rest?${w ? ` ${w}` : ''}`;
}

/**
 * Reset Day n (to the built plan): the day's stops as the last build has them, every move into or out of it undone. A stop the person
 * moved here goes back to its own day of the build; one they added, or one the build left out, is no longer on a day ("Your picks not on
 * a day"). One `restoreFields` (an undo step of its own). Null when the day already reads as the build.
 */
export function resetBuiltDayOps(d: PlanDraft, n: number, newId: () => string = opId): PlanOp[] | null {
  const b = d.lastBuild;
  if (!b || (!staleDays(d).includes(n) && !d.edits.some((e) => e.day === n))) return null;
  const buildDay = new Map<string, number>();
  for (const x of b.days) for (const it of x.items) buildDay.set(it.ref, x.day);
  const ownRefs = new Set(b.days.find((x) => x.day === n)?.items.map((i) => i.ref) ?? []);
  const was = d.edits.find((e) => e.day === n);
  const edits: PlanDayEdit[] = d.edits
    .filter((e) => e.day !== n)
    .map((e) => {
      // this day's stops come home from the days they were moved to
      const refs = e.refs.filter((r) => !ownRefs.has(r));
      const keep = (xs: string[] | undefined) => (xs === undefined ? undefined : xs.filter((r) => refs.includes(r)));
      // and a stop moved here from an edited day goes back to that day, at its place in the build's order
      const order = b.days.find((x) => x.day === e.day)?.items.map((i) => i.ref) ?? [];
      for (const r of was?.refs ?? []) {
        if (ownRefs.has(r) || buildDay.get(r) !== e.day || refs.includes(r)) continue;
        const k = order.indexOf(r);
        const at = refs.findIndex((x) => order.indexOf(x) > k);
        refs.splice(at < 0 ? refs.length : at, 0, r);
      }
      const out: PlanDayEdit = { day: e.day, refs, locked: e.locked.filter((r) => refs.includes(r)) };
      const placed = keep(e.placed);
      const fromTrip = keep(e.fromTrip);
      if (placed?.length) out.placed = placed;
      if (fromTrip?.length) out.fromTrip = fromTrip;
      return out;
    });
  return [{ kind: 'restoreFields', id: newId(), edits }];
}

/** The party a rebuild plans for: the trip's own when it has one, else the device's; the ages go in the body only, never a URL or a log. */
export type BuildParty = { adults: number; children: number[] };

/**
 * The build body for a Rebuild (edit-mode-spec 8): the document's inputs, its picks with Must see, and the days the person edited with
 * their kept stops (locked, placed, from our trip), so the engine fixes them first on their day and order (pack.ts step 1). Null with no pick.
 */
export function rebuildInput(d: PlanDraft, party: BuildParty): PlanBuildInput | null {
  if (!d.picks.length || d.nights === null) return null;
  const edits = builtDays(d).flatMap((b): PlanDayEdit[] => {
    const kept = keptOf(b);
    if (!kept.size) return [];
    const refs = b.refs.filter((r) => kept.has(r));
    const e: PlanDayEdit = { day: b.day, refs, locked: b.locked.filter((r) => kept.has(r)) };
    if (b.placed.length) e.placed = [...b.placed];
    if (b.fromTrip.length) e.fromTrip = [...b.fromTrip];
    return [e];
  });
  return {
    where: d.where,
    nights: d.nights,
    pace: d.pace,
    moves: d.moves,
    month: d.month,
    picks: d.picks.map((p) => ({ ref: p.ref, must: p.must })),
    bases: d.bases,
    edits,
    origin: d.where.mode === 'trip' ? d.origin : null,
    party: { adults: Math.min(12, Math.max(1, party.adults)), children: party.children.slice(0, 12).map((c) => Math.min(17, Math.max(0, c))), walkKm: null },
    ...(d.driveDayMin !== undefined ? { driveDayMin: d.driveDayMin } : {}),
  };
}

/** The build a document keeps: the answer without its picks matrix. */
export function outputsOfAnswer(a: PlanBuildAnswer): PlanOutputs {
  const { matrix: _m, ...rest } = a;
  void _m;
  return rest;
}

/**
 * The edits after a new build (Rebuild or a device re-flow): each day the person kept stops on reads as the new build has it, and every
 * kept stop is on its own day at its rank, whatever the build did with it (a rebuild NEVER moves a kept stop; one the engine could not
 * place stays there, untimed). Days with nothing kept are left to the build. Pure.
 */
export function editsAfterBuild(d: PlanDraft, build: PlanOutputs): PlanDayEdit[] {
  const picks = new Set(d.picks.map((p) => p.ref));
  const last = d.nights === null ? Number.POSITIVE_INFINITY : d.nights + 1;
  const keptDay = new Map<string, number>();
  const days = builtDays(d).filter((b) => b.day <= last);
  for (const b of days) for (const r of keptOf(b)) keptDay.set(r, b.day);
  const out: PlanDayEdit[] = [];
  for (const b of days) {
    const kept = keptOf(b);
    if (!kept.size) continue;
    const fresh = build.days.find((x) => x.day === b.day)?.items.map((i) => i.ref) ?? [];
    const refs = fresh.filter((r) => picks.has(r) && (keptDay.get(r) ?? b.day) === b.day);
    b.refs.forEach((r, rank) => {
      if (kept.has(r) && !refs.includes(r)) refs.splice(Math.min(rank, refs.length), 0, r);
    });
    const e: PlanDayEdit = { day: b.day, refs, locked: b.locked.filter((r) => refs.includes(r)) };
    const placed = b.placed.filter((r) => refs.includes(r));
    const fromTrip = b.fromTrip.filter((r) => refs.includes(r));
    if (placed.length) e.placed = placed;
    if (fromTrip.length) e.fromTrip = fromTrip;
    out.push(e);
  }
  return out;
}

/** The operations that write a new build into the document as one undo step: the build, then the edits it leaves. */
export function buildOps(d: PlanDraft, build: PlanOutputs, newId: () => string = opId): PlanOp[] {
  return [
    { kind: 'setBuild', id: newId(), lastBuild: build },
    { kind: 'restoreFields', id: newId(), edits: editsAfterBuild(d, build) },
  ];
}

// ---- the day's checks for a built day (edit-mode-spec 11.1; STEP2-E5's levels, the engine's codes) ------------------------------------

/** What a built day's check codes mean to a visitor. The engine raised them; the words never name a code. */
const CHECK_WORDS: Record<string, string> = {
  W_PACE: 'Longer than your pace allows',
  W_DRIVE_LIMIT: 'More driving than your daily limit',
  W_DAYLIGHT: 'A walk ends after sunset',
  W_HOURS: 'A stop is closed or outside its hours that day',
  W_CEILING: 'A trail is harder than your party walks',
  W_EARLY: 'Starts before 06:00',
  W_OVERLAP: 'Two stops overlap',
  W_FIT: 'A stop has a limit your party does not meet',
  W_DEADLINE: 'A book-by date has passed',
  W_BOOKING_DAY: 'A booking is for another day',
  W_NO_ROUTE: 'No road between two stops',
};

export interface BuiltDayCheck {
  code: string;
  level: 'fix' | 'check';
  text: string;
}

/**
 * The checks of one built day: the build's warning codes at their level (`level` is core's WARN_LEVEL reader), hidden ones and codes
 * without words left out; the drive line from the build's reasons. A day the person changed since the build says so instead of
 * repeating figures that no longer hold.
 */
export function builtDayChecks(d: PlanDraft, n: number, level: (code: string) => 'fix' | 'check' | 'hidden' | null): { checks: BuiltDayCheck[]; line: string; stale: boolean } {
  const day = d.lastBuild?.days.find((x) => x.day === n);
  const stale = staleDays(d).includes(n);
  if (!day || stale) return { checks: [], line: '', stale };
  const checks = day.warnings.flatMap((code): BuiltDayCheck[] => {
    const l = level(code);
    const text = CHECK_WORDS[code];
    return (l === 'fix' || l === 'check') && text ? [{ code, level: l, text }] : [];
  });
  checks.sort((a, b) => (a.level === b.level ? 0 : a.level === 'fix' ? -1 : 1));
  const line = day.reasons.find((r) => r.code === 'day_drive')?.text ?? '';
  return { checks, line, stale };
}

// ---- Share for a built trip (edit-mode-spec 14; trip-builder 2.5; review STEP2-ES ES-007, ES-008) -------------------------------------

/**
 * The key a built trip's page, timeline, export and print are filed under on the device: a built trip has no public slug, and its private
 * id never goes into a request path, a file name or a shared link (review STEP2-ES ES-008).
 */
export const BUILT_KEY = 'trip-plan';

/** The title Share hands to the share sheet: a generic public one, never the person's own title (ES-007). */
export const BUILT_SHARE_TITLE = 'Trip plan';

/**
 * The builder's share link for a built trip (trip-builder 2.5): public keys only, the mode, the country and areas, the nights, pace, moves
 * and month, the picks as public slugs (`!` for Must see), the chosen bases, and the days the person kept stops on. Never the party, the
 * start, the dates, the notes or the trip's private id (edit-mode-spec 14). The recipient builds it with their own party.
 */
export function builtShareUrl(d: PlanDraft, origin: string): string {
  const q = new URLSearchParams();
  q.set('m', d.where.mode);
  if (d.where.mode === 'trip') {
    q.set('cc', d.where.cc);
    if (d.where.regions.length) q.set('rg', d.where.regions.join(','));
  } else {
    q.set('r', String(d.where.driveLimitMin));
    if (d.where.regions?.length) q.set('rg', d.where.regions.join(','));
  }
  if (d.nights !== null) q.set('n', String(d.nights));
  q.set('pace', d.pace);
  q.set('mv', d.moves);
  if (d.month !== null) q.set('mo', String(d.month));
  if (d.picks.length) q.set('p', d.picks.map((p) => `${p.slug}${p.must ? '!' : ''}`).join(','));
  if (d.bases.length) q.set('b', d.bases.map((b) => `${b.town}${b.pinned ? '@' : ''}${b.nights !== null ? `:${b.nights}` : ''}`).join(','));
  const slugOf = new Map(d.picks.map((p) => [p.ref, p.slug]));
  const kept = builtDays(d).flatMap((b) => {
    const k = keptOf(b);
    const refs = b.refs.filter((r) => k.has(r)).flatMap((r) => (slugOf.has(r) ? [slugOf.get(r)!] : []));
    return refs.length ? [`${b.day}:${refs.join('.')}`] : [];
  });
  if (kept.length) q.set('o', kept.join(';'));
  return `${origin}/plan/?${q.toString()}`;
}
