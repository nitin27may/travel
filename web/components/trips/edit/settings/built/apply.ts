// What the built Settings sections have staged, as operations and as the words of the Apply line (edit-mode-spec 8: "each changes the trip
// with one Apply that states its effect"). The stages edit a copy of the builder's own state (lib/plan/flow.ts) made from the document
// (lib/plan/draft.ts `stateOfDraft`); this compares it with the document and names each difference once: "Apply: 2 days longer, pace
// Relaxed, 1 base added". Nothing changes until Apply, which runs these operations and the rebuild as one undo step. Pure.
import type { FlowState, Pace } from '@/lib/plan/flow';
import { whereOf } from '@/lib/plan/draft';
import type { PlanDraft, PlanOp } from '@/lib/trip-edit/model';

export interface Staged {
  ops: PlanOp[];
  /** the parts of the Apply line, in the sections' order */
  parts: string[];
  /** why Apply cannot run as staged (the words under it); null when it can */
  blocked: string | null;
}

const PACE_WORD: Record<Pace, string> = { relaxed: 'Relaxed', standard: 'Standard', full: 'Full' };
/** Equal content whatever the key order; an empty area list reads as none. */
const stable = (x: unknown): string =>
  JSON.stringify(x, (_k, v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter(([k, y]) => !(k === 'regions' && Array.isArray(y) && y.length === 0)).sort(([a], [b]) => (a < b ? -1 : 1))) : v));
const same = (a: unknown, b: unknown): boolean => stable(a) === stable(b);
const hm = (min: number): string => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}` : `${min} min`);
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** The staged changes of `flow` (and the Who is going section's pace, `pace`) against the document. */
export function stagedChanges(doc: PlanDraft, flow: FlowState, pace: Pace | null, newId: () => string): Staged {
  const ops: PlanOp[] = [];
  const parts: string[] = [];
  let blocked: string | null = null;

  // Where you start, Where (a new country is a new trip: its picks are of the old one)
  const where = whereOf(flow);
  if (where && !same(where, doc.where)) {
    if (where.mode === 'trip' && doc.where.mode === 'trip' && where.cc !== doc.where.cc) {
      blocked = 'Another country is a new trip. Plan it from the start.';
    } else if (where.mode !== doc.where.mode) {
      blocked = 'A trip from home and a trip by air are planned differently. Plan a new trip instead.';
    } else {
      ops.push({ kind: 'setWhere', id: newId(), where });
      if (where.mode === 'near' && doc.where.mode === 'near') {
        if (!same(where.start, doc.where.start)) parts.push(flow.startName ? `starting from ${flow.startName}` : 'a new start');
        if (where.driveLimitMin !== doc.where.driveLimitMin) parts.push(`up to ${hm(where.driveLimitMin)} each way`);
        if (!same(where.regions ?? [], doc.where.regions ?? [])) parts.push('other areas');
      } else parts.push('other areas');
    }
  }

  // Days and driving
  if (doc.nights !== null && flow.nights !== doc.nights) {
    ops.push({ kind: 'setNights', id: newId(), nights: flow.nights });
    const k = flow.nights - doc.nights;
    parts.push(`${plural(Math.abs(k), 'day')} ${k > 0 ? 'longer' : 'shorter'}`);
  }
  const p = pace ?? flow.pace;
  if (p !== doc.pace) {
    ops.push({ kind: 'setPace', id: newId(), pace: p });
    parts.push(`pace ${PACE_WORD[p]}`);
  }
  if ((flow.driveDayMin ?? null) !== (doc.driveDayMin ?? null)) {
    ops.push({ kind: 'setDriveDay', id: newId(), driveDayMin: flow.driveDayMin });
    parts.push(flow.driveDayMin === null ? 'driving set by the pace' : `driving up to ${hm(flow.driveDayMin)} a day`);
  }
  // places the Days and driving section offered ("Also within your driving") join the trip as picks the plan places
  const had = new Set(doc.picks.map((x) => x.ref));
  const added = flow.picks.filter((x) => !had.has(x.ref));
  for (const x of added) ops.push({ kind: 'addPick', id: newId(), ref: x.ref, slug: x.slug, name: x.name.slice(0, 120), ...(x.must ? { must: true } : {}) });
  if (added.length) parts.push(`${plural(added.length, 'place')} added`);

  // Bases (TB-E2): a town the person chose, its nights, pinned or not; a town taken away lets the plan choose again
  const before = new Map(doc.bases.map((b) => [b.town, b]));
  const after = new Map(flow.bases.map((b) => [b.town, b]));
  let more = 0;
  let fewer = 0;
  let changed = 0;
  for (const [town, b] of after) {
    const was = before.get(town);
    if (was && same(was, b)) continue;
    ops.push({ kind: 'setBase', id: newId(), town, base: b });
    if (was) changed++;
    else more++;
  }
  for (const town of before.keys()) {
    if (after.has(town)) continue;
    ops.push({ kind: 'setBase', id: newId(), town, base: null });
    fewer++;
  }
  if (more) parts.push(`${plural(more, 'base')} added`);
  if (fewer) parts.push(`${plural(fewer, 'base')} let go`);
  if (changed) parts.push(`${plural(changed, 'base')} changed`);
  const baseNights = flow.bases.reduce((n, b) => n + (b.nights ?? 0), 0);
  if (!blocked && baseNights > flow.nights) blocked = `The bases add up to ${plural(baseNights, 'night')}; the trip has ${plural(flow.nights, 'night')}.`;

  // Getting there (a trip by air): the airport or hub the trip starts and ends at
  if (doc.where.mode === 'trip' && !same(flow.origin, doc.origin)) {
    ops.push({ kind: 'setOrigin', id: newId(), origin: flow.origin });
    parts.push(flow.origin ? `flying from ${flow.originName ?? 'a new airport'}` : 'no airport chosen');
  }
  return { ops, parts, blocked };
}

/** "Apply: 2 days longer, pace Relaxed, 1 base added"; '' with nothing staged. */
export const applyLine = (parts: readonly string[]): string => (parts.length ? `Apply: ${parts.join(', ')}` : '');

/** "Rebuild 6 days · 3 kept and 2 added by you stay" (edit-mode-spec 8's effect line); the days are the ones the plan will have. */
export const rebuildLine = (days: number, kept: string): string => `Rebuild ${plural(days, 'day')}${kept ? ` · ${kept}` : ''}`;
