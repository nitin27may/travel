// Our plan, as the `convert` operation takes it (STEP2-B3; edit-mode-spec 13.2): the days on screen become built days. Every stop that is
// a catalogue place becomes a pick; the ones from our plan are placed "From our trip" on their day (`fromTrip`), the ones the person added
// "Placed by you" (`placed`, a pick flagged `added`). The days' times and drives become the last build, so the trip reads as it did a
// moment ago; the person's notes move to the built keys. Rows that are not places (meals, rests, the hire car, check-in) are rules of the
// copy's scheduler: a built trip has no place for them, so they are counted and named in the notice, not carried. Pure.
import type { DayTimeline, TimelineEntry } from '@travel/core/schedule/types.ts';
import { PLAN_LIMITS, type PlanDraft, type PlanOp } from '@/lib/trip-edit/model';
import { dayRef, noteKeyOf, newOpId } from '@/lib/trip-edit/stopOps';
import { stopsOfDay } from '../panel/StopMenu';

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const clean = (s: string): string => s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 120);
const minutes = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m ? Math.min(2879, Number(m[1]) * 60 + Number(m[2])) : null;
};

export interface Conversion {
  ops: PlanOp[];
  /** places carried as picks */
  places: number;
  /** places left behind: a place twice, or more than a built plan holds */
  left: number;
  /** stops that are not places (a hire car, a booking) and have no place in a built plan */
  other: number;
}

export type Refusal = 'long' | 'empty';

/** Why this copy cannot become a built plan now, or null. A built plan holds at most `PLAN_LIMITS.nights` nights (R2) and needs a place to build from. */
export function refusal(doc: PlanDraft, timelines: readonly DayTimeline[]): Refusal | null {
  if (!doc.template) return null;
  if (timelines.length - 1 > PLAN_LIMITS.nights) return 'long';
  return timelines.some((t) => stopsOfDay(t.entries).some((e) => e.at?.placeSlug && SLUG.test(e.at.placeSlug))) ? null : 'empty';
}

const placeStop = (e: TimelineEntry): boolean => !!e.at?.placeSlug && SLUG.test(e.at.placeSlug);

export function convertOps(doc: PlanDraft, timelines: readonly DayTimeline[], title: string, at: string, newId: () => string = newOpId): Conversion {
  const days = [...timelines].sort((a, b) => a.day - b.day).slice(0, PLAN_LIMITS.days);
  const seen = new Set<string>();
  const picks: { ref: string; slug: string; name: string; must: boolean; added?: true }[] = [];
  const edits: { day: number; refs: string[]; locked: string[]; placed?: string[]; fromTrip?: string[] }[] = [];
  const outDays: { day: number; items: { ref: string; slug: string; name: string; startMin: number | null; visitMin: number; driveMin: number | null; basis: 'routed' | 'estimate' | null; locked: boolean }[]; warnings: string[] }[] = [];
  const notes: Record<string, string> = {};
  const tn = doc.template?.notes ?? {};
  let left = 0;
  let other = 0;
  for (const tl of days) {
    const refs: string[] = [];
    const placed: string[] = [];
    const fromTrip: string[] = [];
    const items: (typeof outDays)[number]['items'] = [];
    const stops = stopsOfDay(tl.entries);
    for (const e of stops) {
      if (!placeStop(e)) continue;
      const slug = e.at!.placeSlug!;
      const ref = `place/${slug}`;
      if (seen.has(ref) || picks.length >= PLAN_LIMITS.picks) {
        left++;
        continue;
      }
      seen.add(ref);
      const mine = e.addedBy === 'visitor';
      const name = clean(e.title) || slug;
      picks.push({ ref, slug, name, must: false, ...(mine ? { added: true as const } : {}) });
      refs.push(ref);
      (mine ? placed : fromTrip).push(ref);
      const at = tl.entries.indexOf(e);
      const leg = at > 0 ? tl.entries[at - 1] : undefined;
      const drive = leg && leg.kind === 'leg' && leg.leg?.mode === 'drive' ? leg : undefined;
      items.push({
        ref,
        slug,
        name,
        startMin: tl.blocks || e.block ? null : minutes(e.start),
        visitMin: Math.min(1440, Math.max(0, Math.round(e.durationMin))),
        driveMin: drive ? Math.min(1440, Math.round(drive.durationMin)) : null,
        basis: drive ? (drive.leg?.basis === 'routed' ? 'routed' : 'estimate') : null,
        locked: false,
      });
      const key = noteKeyOf(doc, e);
      if (tn[key]) notes[ref] = tn[key]!;
    }
    other += stops.filter((e) => !placeStop(e)).length;
    const dayKey = String(dayRef(doc, tl.day));
    if (tn[dayKey]) notes[String(tl.day)] = tn[dayKey]!;
    edits.push({ day: tl.day, refs, locked: [], ...(placed.length ? { placed } : {}), ...(fromTrip.length ? { fromTrip } : {}) });
    outDays.push({ day: tl.day, items, warnings: tl.warnings.map((w) => w.code).filter((c, i, a) => /^W_[A-Z0-9_]{2,40}$/.test(c) && a.indexOf(c) === i).slice(0, PLAN_LIMITS.warnings) });
  }
  if (tn.trip) notes.trip = tn.trip;
  const estimated = outDays.some((d) => d.items.some((i) => i.basis === 'estimate'));
  const routed = outDays.some((d) => d.items.some((i) => i.basis === 'routed'));
  const op: PlanOp = {
    kind: 'convert',
    id: newId(),
    at,
    picks,
    bases: [],
    edits,
    nights: Math.max(0, days.length - 1),
    lastBuild: {
      engine: 'copy',
      basis: estimated && routed ? 'mixed' : routed ? 'routed' : 'estimate',
      bases: [],
      days: outDays.map((d) => ({ day: d.day, base: null, move: false, items: d.items, returnMin: null, warnings: d.warnings, reasons: [] })),
      didNotFit: [],
      spareDays: 0,
      builtAt: at,
    },
    ...(Object.keys(notes).length ? { notes } : {}),
  } as PlanOp;
  // the person's own name for the trip goes with it: a built trip has no catalogue title to fall back on
  const named: PlanOp[] = doc.title === null || doc.title === undefined ? [{ kind: 'setTitle', id: newId(), title: clean(title) || null } as PlanOp] : [];
  return { ops: [op, ...named], places: picks.length, left, other };
}
