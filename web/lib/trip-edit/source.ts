// The document as a TimelineSource (STEP2-T1 step 2): the trip page reads its profile, versions and additions from the person's
// `plan-draft/1` and writes each change as one operation (setParty, setVariant, addPlace, removePlace). Pure: the draft and the
// ops go in and out; the store (open.ts) saves them. Imports from core/src/plan only what the X-S2 fence names.
import { isChanged } from '@travel/core/schedule/profileCodec.ts';
import type { TimelineUrlState } from '@travel/core/schedule/profileCodec.ts';
import type { Profile } from '@travel/core/schedule/types.ts';
import type { PlanOp } from '@travel/core/plan/ops.ts';
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import type { TimelineChange, TimelineSource } from '@/components/trips/timeline/useTimeline';

/** The age a child of unknown age is planned for (core `DEFAULT_CHILD_AGE`, pinned equal in tests/trip-edit/source.test.ts). */
const CHILD_AGE = 10;
const PLACE = 'place/';

const newOpId = (): string => `o-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

/** The profile a document plans for: its template's, else its travellers' (an adult count and the youngest child), else the plan's own. */
export function profileOfDraft(d: PlanDraft, defaults: Profile): Profile {
  const p = d.template?.profile;
  if (p) return { party: p.party, youngest: p.youngest, pace: p.pace, adults: p.adults, walkKm: p.walk, split: p.split };
  const t = d.travellers;
  if (!t) return { ...defaults, pace: d.pace };
  const youngest = t.children.length ? Math.min(...t.children) : null;
  return { ...defaults, party: youngest === null ? 'adults' : 'family', youngest, adults: t.adults, pace: d.pace };
}

/** The document in the shape the timeline reads: the profile, the chosen versions by day, the places added by day. Built documents carry none. */
export function stateOfDraft(d: PlanDraft, defaults: Profile): TimelineUrlState {
  const t = d.template;
  const overrides: Record<number, string> = {};
  const added: TimelineUrlState['added'] = [];
  if (t) {
    for (const [day, key] of Object.entries(t.overrides)) overrides[Number(day)] = key;
    for (const a of t.added) if (typeof a.day === 'number' && a.ref.startsWith(PLACE)) added.push({ day: a.day, slug: a.ref.slice(PLACE.length) });
  }
  return { profile: profileOfDraft(d, defaults), overrides, added };
}

/** Anything the person changed in the plan itself (a version or a place); the party is theirs from the start and is not a change from our plan. */
export const planChanged = (s: TimelineUrlState): boolean => Object.keys(s.overrides).length > 0 || s.added.length > 0;

/** The travellers a profile implies, keeping the children's real ages while the youngest still matches (a profile carries only the youngest). */
function travellersFor(d: PlanDraft, p: Profile): { adults: number; children: number[] } {
  if (p.party === 'adults') return { adults: p.adults, children: [] };
  const kept = d.travellers?.children ?? [];
  const youngest = p.youngest ?? CHILD_AGE;
  return { adults: p.adults, children: kept.length && Math.min(...kept) === youngest ? [...kept] : [youngest] };
}

/** The operation that sets who is going and the pace, with the profile that plans for them (set together, bug B1). Template documents only. */
export function partyOps(d: PlanDraft, defaults: Profile, party: { adults: number; children: number[] }, pace: Profile['pace'], newId: () => string = newOpId): PlanOp[] {
  if (!d.template) return [];
  const was = profileOfDraft(d, defaults);
  const youngest = party.children.length ? Math.min(...party.children) : null;
  const profile = { party: youngest === null ? ('adults' as const) : ('family' as const), youngest, pace, adults: party.adults, walk: was.walkKm, split: was.split };
  return [{ kind: 'setParty', id: newId(), travellers: { adults: party.adults, children: [...party.children] }, profile, pace }];
}

/** The operations one change makes on a template document. Empty for a built document (T1 reads it) or a change that targets nothing. */
export function opsFor(d: PlanDraft, next: TimelineUrlState, change: TimelineChange, newId: () => string = newOpId): PlanOp[] {
  const t = d.template;
  if (!t) return [];
  switch (change.kind) {
    case 'profile': {
      const p = next.profile;
      const profile = { party: p.party, youngest: p.youngest, pace: p.pace, adults: p.adults, walk: p.walkKm, split: p.split };
      return [{ kind: 'setParty', id: newId(), travellers: travellersFor(d, p), profile, pace: p.pace }];
    }
    case 'variant':
      return [{ kind: 'setVariant', id: newId(), day: change.day, variant: (change.key as 'A' | 'B' | 'C' | null) ?? null }];
    case 'add':
      return [{ kind: 'addPlace', id: newId(), day: change.day, ref: `${PLACE}${change.slug}` }];
    case 'remove': {
      const entry = t.added.find((a) => a.day === change.day && a.ref === `${PLACE}${change.slug}`);
      return entry ? [{ kind: 'removePlace', id: newId(), added: entry.op }] : [];
    }
    case 'reset':
      return [{ kind: 'reset', id: newId(), day: null }];
  }
}

/** The source for one document. `apply` saves operations (open.ts) and answers whether they were taken. */
export function documentSource(d: PlanDraft, defaults: Profile, apply: (ops: PlanOp[]) => unknown, newId?: () => string): TimelineSource {
  const state = stateOfDraft(d, defaults);
  const changed = planChanged(state);
  return {
    state,
    defaults,
    // the server's timelines stand while the document plans exactly as the plan was written
    plain: !isChanged(state, defaults),
    changed,
    write: (next, change) => {
      const ops = opsFor(d, next, change, newId);
      if (ops.length) apply(ops);
    },
  };
}
