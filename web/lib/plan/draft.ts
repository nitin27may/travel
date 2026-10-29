// Flow state to the plan document and to the build body, and back (FLOW 4, 8). Pure; type-only imports from the core, so the start
// chunk loads no schema code. The document is `plan-draft/1`, built mode; the kind is never stored (the nights say it).
import type { PlanBuildAnswer, PlanBuildInput } from '@travel/core/schema/api/plan.ts';
import type { PlanDraft, PlanIdentity, PlanOutputs, PlanWhere } from '@travel/core/schema/plan-draft.ts';
import { DEFAULT_CHILD_AGE, type Party } from '@travel/core/trips/party.ts';
import { asksDriveDay, newFlow, type FlowState, type Moves } from './flow';
import { kindOfDraft } from './kinds';
import { PLAN_DRAFT_SCHEMA_ID } from './keys';

/** The trip identity colours, in the order a new draft takes the next free one (FLOW TF19; tokens 4; `none` is never given). */
export const IDENTITY_ORDER: readonly PlanIdentity[] = ['blue', 'orange', 'rose', 'teal', 'sky', 'yellow', 'vermillion'];

export function nextIdentity(used: readonly (PlanIdentity | undefined)[]): PlanIdentity {
  const taken = new Set(used);
  return IDENTITY_ORDER.find((k) => !taken.has(k)) ?? IDENTITY_ORDER[used.length % IDENTITY_ORDER.length]!;
}

/** `where` as the contract states it, or null while the stage 1 and 2 answers are missing. */
export function whereOf(s: FlowState): PlanWhere | null {
  if (s.kind === null) return null;
  const near = s.kind === 'day' || s.kind === 'weekend' || s.kind === 'long_weekend' || s.kind === 'week_car';
  if (near) return s.start ? { mode: 'near', start: s.start, driveLimitMin: s.driveLimitMin, ...(s.regions.length ? { regions: s.regions } : {}) } : null;
  return s.cc ? { mode: 'trip', cc: s.cc, regions: s.regions } : null;
}

/** The youngest child's age of a party (null: no children). An unset age plans as 10. */
export const youngestOf = (p: Party): number | null => (p.children.length ? Math.min(...p.children.map((c) => c ?? DEFAULT_CHILD_AGE)) : null);

/** The party as the build receives it: in the body only, never in a document, a URL or a log. */
export function buildParty(p: Party): PlanBuildInput['party'] {
  return { adults: p.adults, children: p.children.map((c) => c ?? DEFAULT_CHILD_AGE), walkKm: null };
}

/** The `p` band a cacheable candidates query may carry: the youngest age only, never the ages (api/plan.ts PLAN_PARTY_BAND_RE). */
export const partyBand = (p: Party): string | undefined => {
  const y = youngestOf(p);
  return y === null ? undefined : `family-${Math.min(17, Math.max(0, y))}`;
};

/** The document for the state, or null when it is not complete enough to be one (no kind, no start or country yet). */
export function draftOf(s: FlowState, identity: PlanIdentity, last: PlanOutputs | null = null): PlanDraft | null {
  const where = whereOf(s);
  if (!where) return null;
  const d: PlanDraft = {
    schema: PLAN_DRAFT_SCHEMA_ID,
    id: s.id,
    title: null,
    where,
    nights: s.nights,
    pace: s.pace,
    moves: s.moves,
    month: s.month,
    party: 'device',
    picks: s.picks.map((p) => ({ ref: p.ref, slug: p.slug, name: p.name, must: p.must })),
    bases: s.nights > 0 ? s.bases : [],
    edits: [],
    origin: where.mode === 'trip' ? s.origin : null,
    seed: s.seed ?? null,
    lastBuild: last,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    identity,
    ...(s.date ? { start: s.date } : {}),
    ...(s.driveDayMin !== null && asksDriveDay(s) ? { driveDayMin: s.driveDayMin } : {}),
  };
  return d;
}

/** The build body: the document's inputs plus the party. Null without a complete `where` or without a pick. */
export function buildInputOf(s: FlowState, party: Party): PlanBuildInput | null {
  const where = whereOf(s);
  if (!where || !s.picks.length) return null;
  return {
    where,
    nights: s.nights,
    pace: s.pace,
    moves: s.moves as Moves,
    month: s.month,
    picks: s.picks.map((p) => ({ ref: p.ref, must: p.must })),
    bases: s.nights > 0 ? s.bases : [],
    edits: [],
    origin: where.mode === 'trip' ? s.origin : null,
    party: buildParty(party),
    ...(s.driveDayMin !== null && asksDriveDay(s) ? { driveDayMin: s.driveDayMin } : {}),
  };
}

/** The build the document keeps: the answer without the picks matrix (it is fetched again on a rebuild). */
export function outputsOf(a: PlanBuildAnswer): PlanOutputs {
  const { matrix: _matrix, ...rest } = a;
  void _matrix;
  return rest;
}

/** The flow state a stored document resumes as. `visit` is not in a document, so the estimate restarts from the default visit length. */
export function stateOfDraft(d: PlanDraft): FlowState {
  const s = newFlow(d.id, d.createdAt);
  return {
    ...s,
    kind: kindOfDraft(d.nights, d.where.mode),
    // a draft with picks and no build opens Days, never builds (TF14); one with nothing picked opens Pick
    stage: d.picks.length ? 4 : 3,
    start: d.where.mode === 'near' ? d.where.start : null,
    origin: d.origin,
    month: d.month,
    date: d.start ?? null,
    cc: d.where.mode === 'trip' ? d.where.cc : null,
    regions: d.where.regions ?? [],
    driveLimitMin: d.where.mode === 'near' ? d.where.driveLimitMin : s.driveLimitMin,
    picks: d.picks.map((p) => ({ ...p })),
    nights: d.nights ?? s.nights,
    pace: d.pace,
    moves: d.moves,
    driveDayMin: d.driveDayMin ?? null,
    bases: d.bases,
    seed: d.seed,
    updatedAt: d.updatedAt,
  };
}

/** What the Your plans list says about a stored document (FLOW stage 0, TF13). */
export function draftStateWords(d: PlanDraft): string {
  if (d.template) return 'your copy';
  if (d.lastBuild) return 'built';
  return d.picks.length ? 'ready to build' : 'picking places';
}

/** A country's English name from its code, or the code (the browser knows the names; the document holds only the code). */
export function countryName(cc: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(cc) ?? cc;
  } catch {
    return cc;
  }
}

/** The name a stored document goes by in lists: its own title, else the country or the kind of trip. */
export function draftName(d: PlanDraft, kindLabel: string): string {
  if (d.title) return d.title;
  return d.where.mode === 'trip' ? countryName(d.where.cc) : kindLabel;
}
