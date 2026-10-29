// The builder's stage state machine (FLOW 2, 2.1, 4): which stages a kind asks, what each stage saves, when Next works, and the
// counts the action bar shows. Pure, with type-only imports, so the start chunk carries no schema code. The document is made from this
// state by draft.ts; the state itself is the builder's screen state (store.ts keeps it under the UI key).
import type { PlanBaseChoice, PlanOrigin, PlanPick } from '@travel/core/schema/plan-draft.ts';
import { PLAN_BUILDER_UI, PLAN_DAY_ON_SITE_MIN, PLAN_UNKNOWN_VISIT_MIN } from '@/lib/config/product';
import { addBase, clampBases, moveBase, removeBase, setBaseNights, type BaseInfo } from './bases';
import { kindDef, type KindId, type PlanMode } from './kinds';

export type Stage = 0 | 1 | 2 | 3 | 4;
export const STAGE_NAMES: Record<Stage, string> = { 0: 'Kind', 1: 'Start', 2: 'Where', 3: 'Pick', 4: 'Days and driving' };
/** The short names the rail and "Next: ..." use. */
export const STAGE_SHORT: Record<Stage, string> = { 0: 'Kind', 1: 'Start', 2: 'Where', 3: 'Pick', 4: 'Days' };

export type Pace = 'relaxed' | 'standard' | 'full';
export type Moves = 'fewer' | 'balanced' | 'shorter';

export interface Filters {
  /** place kinds ("Looking for"); empty: all */
  kinds: string[];
  /** only places that fit the party's youngest child (the main list already drops the unfit; off shows everything) */
  kids: boolean;
  stroller: boolean;
  /** a month for the list only; null: the trip's month */
  month: number | null;
  /** trip mode (TB-W2): only these areas of the chosen ones (region ids); empty or absent: every chosen area */
  areas?: string[];
}

export interface FlowState {
  v: 1;
  /** the draft's id (a UUID v4 made on the device) */
  id: string;
  stage: Stage;
  kind: KindId | null;
  /** near mode: where the trip starts (a typed reference, never a point) */
  start: PlanOrigin | null;
  /** air kinds: the departure airport or hub */
  origin: PlanOrigin | null;
  /** the public names of `start` and `origin`, for the screen only */
  startName: string | null;
  originName: string | null;
  month: number | null;
  /** Day 1 as an ISO date, or null ("Not sure yet" or a month only) */
  date: string | null;
  cc: string | null;
  ccName: string | null;
  regions: string[];
  driveLimitMin: number;
  picks: PlanPick[];
  /** minutes on site by pick ref, from the candidate rows (screen state: the estimate needs it) */
  visit: Record<string, number | null>;
  nights: number;
  pace: Pace;
  moves: Moves;
  /** the longest drive in one day, minutes; null: from the pace */
  driveDayMin: number | null;
  bases: PlanBaseChoice[];
  /** a public trip this plan started from (TB-W2, X7 `?seed=<slug>`), and its name for the screen; the document keeps the slug as `seed` */
  seed?: string | null;
  seedName?: string | null;
  /** the names and public points of the bases, for the screen only (TB-W2); absent in a state saved before */
  baseInfo?: Record<string, BaseInfo>;
  /** the area's name of each pick by ref, for the tray's groups (TB-W2); screen state, absent in a state saved before */
  pickAreas?: Record<string, string>;
  filters: Filters;
  createdAt: string;
  updatedAt: string;
}

export const NO_FILTERS: Filters = { kinds: [], kids: true, stroller: false, month: null };

export function newFlow(id: string, nowIso: string): FlowState {
  return {
    v: 1, id, stage: 0, kind: null, start: null, origin: null, startName: null, originName: null, month: null, date: null, cc: null, ccName: null,
    regions: [], driveLimitMin: 180, picks: [], visit: {}, nights: 2, pace: 'standard', moves: 'fewer', driveDayMin: null, bases: [], filters: { ...NO_FILTERS }, createdAt: nowIso, updatedAt: nowIso,
  };
}

export const modeOf = (s: Pick<FlowState, 'kind'>): PlanMode => (s.kind ? kindDef(s.kind).mode : 'near');

// ---- which stages a kind asks (FLOW 2.1) ---------------------------------------------------------------------------------------------

/** Stages that show a screen for the kind, in order. Day trip skips Where and Days; Weekend skips Where. */
export function askedStages(kind: KindId | null): Stage[] {
  if (kind === 'day') return [0, 1, 3];
  if (kind === 'weekend') return [0, 1, 3, 4];
  return [0, 1, 2, 3, 4];
}

/** The phone counts only the stages 1 to 4 that ask: "2 of 3". */
export function stepCount(kind: KindId | null): number {
  return askedStages(kind).filter((x) => x >= 1).length;
}
export function stepNumber(kind: KindId | null, stage: Stage): number {
  return Math.max(1, askedStages(kind).filter((x) => x >= 1 && x <= stage).length);
}

export const lastStage = (kind: KindId | null): Stage => askedStages(kind).at(-1)!;
export const isLastStage = (s: Pick<FlowState, 'kind' | 'stage'>): boolean => s.stage === lastStage(s.kind);

export function nextStage(s: Pick<FlowState, 'kind' | 'stage'>): Stage | null {
  const list = askedStages(s.kind);
  return list.find((x) => x > s.stage) ?? null;
}
export function prevStage(s: Pick<FlowState, 'kind' | 'stage'>): Stage | null {
  const list = askedStages(s.kind);
  return [...list].reverse().find((x) => x < s.stage) ?? null;
}

/** The label of the primary: names its stage (L1), or builds. */
export function primaryLabel(s: Pick<FlowState, 'kind' | 'stage'>): string {
  const n = nextStage(s);
  if (n === null) return s.kind === 'day' ? 'Build my day' : 'Build my days';
  return `Next: ${STAGE_SHORT[n]}`;
}

// ---- when Next works ---------------------------------------------------------------------------------------------------------------

export interface Advance {
  ok: boolean;
  /** why it is off (shown under the bar and read by screen readers) */
  reason: string | null;
}

export function canAdvance(s: FlowState, opts: { startsAvailable?: boolean } = {}): Advance {
  switch (s.stage) {
    case 0:
      return s.kind ? { ok: true, reason: null } : { ok: false, reason: 'Choose the kind of trip.' };
    case 1:
      if (modeOf(s) === 'near' && !s.start) return { ok: false, reason: opts.startsAvailable === false ? 'We cannot plan from a starting point yet.' : 'Choose where you start.' };
      return { ok: true, reason: null };
    case 2:
      if (modeOf(s) === 'trip') {
        if (!s.cc) return { ok: false, reason: 'Choose a country.' };
        if (!s.regions.length) return { ok: false, reason: 'Choose at least one area.' };
      }
      return { ok: true, reason: null };
    case 3:
      return s.picks.length ? { ok: true, reason: null } : { ok: false, reason: 'Pick at least one place.' };
    case 4:
      return s.picks.length ? { ok: true, reason: null } : { ok: false, reason: 'Pick at least one place.' };
  }
}

// ---- the estimate ("Your 9 picks need about 6 days (5 nights) ≈") -------------------------------------------------------------------

export interface DaysEstimate {
  days: number;
  nights: number;
}

export function estimateDays(s: Pick<FlowState, 'picks' | 'visit' | 'pace'>): DaysEstimate {
  const minutes = s.picks.reduce((n, p) => n + (s.visit[p.ref] ?? PLAN_UNKNOWN_VISIT_MIN), 0);
  const days = Math.max(1, Math.ceil(minutes / PLAN_DAY_ON_SITE_MIN[s.pace]));
  return { days, nights: days - 1 };
}

/** Picks that nights below the estimate would leave out, roughly: the share of the days missing. */
export function leftOutIfShort(s: Pick<FlowState, 'picks' | 'visit' | 'pace' | 'nights'>): number {
  const est = estimateDays(s);
  if (s.nights + 1 >= est.days) return 0;
  return Math.max(1, Math.round(s.picks.length * (1 - (s.nights + 1) / est.days)));
}

// ---- the reducer -------------------------------------------------------------------------------------------------------------------

/** The pace a party starts at: relaxed with a child under 6, else standard (FLOW 3 factor 4b). `youngest` is the youngest child's age, or null. */
export const defaultPace = (youngest: number | null): Pace => (youngest !== null && youngest < 6 ? 'relaxed' : 'standard');

export type FlowAction =
  | { t: 'kind'; kind: KindId; youngest: number | null; now: string }
  | { t: 'patch'; patch: Partial<Omit<FlowState, 'v' | 'id' | 'stage'>>; now: string }
  | { t: 'country'; cc: string; name: string; now: string }
  | { t: 'region'; id: string; on: boolean; now: string }
  | { t: 'regions'; ids: string[]; now: string }
  | { t: 'pick'; pick: PlanPick; visitMin: number | null; now: string; area?: string | null }
  /** nights, with the bases' nights cut to fit (a shorter trip takes nights back from the last bases) */
  | { t: 'nights'; nights: number; now: string }
  | { t: 'base-add'; town: string; info: BaseInfo; now: string }
  | { t: 'base-remove'; town: string; now: string }
  | { t: 'base-move'; town: string; by: -1 | 1; now: string }
  | { t: 'base-nights'; town: string; nights: number | null; now: string }
  /** "Let the plan choose": no base is pinned */
  | { t: 'bases-auto'; now: string }
  | { t: 'unpick'; ref: string; now: string }
  | { t: 'must'; ref: string; now: string }
  | { t: 'filters'; patch: Partial<Filters>; now: string }
  | { t: 'goto'; stage: Stage }
  | { t: 'next' }
  | { t: 'back' }
  | { t: 'load'; state: FlowState };

const touch = (s: FlowState, now: string, patch: Partial<FlowState>): FlowState => ({ ...s, ...patch, updatedAt: now });

export function flowReducer(s: FlowState, a: FlowAction): FlowState {
  switch (a.t) {
    case 'load':
      return a.state;
    case 'kind': {
      const k = kindDef(a.kind);
      const same = s.kind === a.kind;
      if (same) return touch(s, a.now, { stage: 1 });
      // a new kind resets what the old one decided (nights, reach, pace) and keeps who and where from
      return touch(s, a.now, {
        kind: a.kind,
        stage: 1,
        nights: k.nights,
        pace: defaultPace(a.youngest),
        moves: 'fewer',
        driveDayMin: null,
        bases: [],
        driveLimitMin: k.reachMin ?? s.driveLimitMin,
        // the old kind's start does not carry across modes
        start: k.mode === 'near' ? s.start : null,
        startName: k.mode === 'near' ? s.startName : null,
        origin: k.mode === 'trip' ? s.origin : null,
        originName: k.mode === 'trip' ? s.originName : null,
        regions: k.mode === 'trip' ? s.regions : [],
        cc: k.mode === 'trip' ? s.cc : null,
        ccName: k.mode === 'trip' ? s.ccName : null,
        picks: s.kind && kindDef(s.kind).mode !== k.mode ? [] : s.picks,
        visit: s.kind && kindDef(s.kind).mode !== k.mode ? {} : s.visit,
      });
    }
    case 'patch': {
      const patch = a.patch as Partial<FlowState>;
      // fewer nights take nights back from the bases, so the document never holds more than the plan has
      return touch(s, a.now, patch.nights !== undefined && patch.bases === undefined ? { ...patch, bases: clampBases(s.bases, patch.nights) } : patch);
    }
    case 'country':
      // a different country drops the areas and the picks of the old one
      return a.cc === s.cc ? s : touch(s, a.now, { cc: a.cc, ccName: a.name, regions: [], picks: [], visit: {}, bases: [], baseInfo: {}, pickAreas: {}, filters: { ...s.filters, areas: [] } });
    case 'region':
      return touch(s, a.now, { regions: a.on ? [...new Set([...s.regions, a.id])] : s.regions.filter((r) => r !== a.id) });
    case 'regions': {
      const ids = [...new Set(a.ids)];
      // an area filter on the list can only name areas still chosen
      const areas = (s.filters.areas ?? []).filter((r) => ids.includes(r));
      return touch(s, a.now, { regions: ids, filters: { ...s.filters, areas } });
    }
    case 'pick': {
      if (s.picks.some((p) => p.ref === a.pick.ref)) return s;
      return touch(s, a.now, { picks: [...s.picks, a.pick], visit: { ...s.visit, [a.pick.ref]: a.visitMin }, ...(a.area ? { pickAreas: { ...s.pickAreas, [a.pick.ref]: a.area } } : {}) });
    }
    case 'nights':
      return touch(s, a.now, { nights: a.nights, bases: clampBases(s.bases, a.nights) });
    case 'base-add':
      return touch(s, a.now, { bases: addBase(s.bases, a.town), baseInfo: { ...s.baseInfo, [a.town]: a.info } });
    case 'base-remove': {
      const { [a.town]: _gone, ...baseInfo } = s.baseInfo ?? {};
      void _gone;
      return touch(s, a.now, { bases: removeBase(s.bases, a.town), baseInfo });
    }
    case 'base-move':
      return touch(s, a.now, { bases: moveBase(s.bases, a.town, a.by) });
    case 'base-nights':
      return touch(s, a.now, { bases: setBaseNights(s.bases, a.town, a.nights, s.nights) });
    case 'bases-auto':
      return touch(s, a.now, { bases: [], baseInfo: {} });
    case 'unpick': {
      const { [a.ref]: _gone, ...visit } = s.visit;
      const { [a.ref]: _area, ...pickAreas } = s.pickAreas ?? {};
      void _gone;
      void _area;
      return touch(s, a.now, { picks: s.picks.filter((p) => p.ref !== a.ref), visit, pickAreas });
    }
    case 'must':
      return touch(s, a.now, { picks: s.picks.map((p) => (p.ref === a.ref ? { ...p, must: !p.must } : p)) });
    case 'filters':
      return touch(s, a.now, { filters: { ...s.filters, ...a.patch } });
    case 'goto':
      return { ...s, stage: a.stage };
    case 'next': {
      const n = nextStage(s);
      return n === null ? s : { ...s, stage: n };
    }
    case 'back': {
      const p = prevStage(s);
      return p === null ? s : { ...s, stage: p };
    }
  }
}

/** The nights a kind's stepper offers: the kind is derived from the nights (TK1), so the range stays inside the kind's band. */
export function nightsRange(kind: KindId | null): { min: number; max: number } {
  switch (kind) {
    case 'day':
      return { min: 0, max: 0 };
    case 'weekend':
      return { min: 1, max: 2 };
    case 'long_weekend':
      return { min: 3, max: 4 };
    case 'week_car':
    case 'week_air':
      return { min: 5, max: 9 };
    case 'holiday':
      return { min: 10, max: 21 };
    default:
      return { min: 1, max: 21 };
  }
}

/** The day-out driving choice is asked only when nights are 3 or more (FLOW TF7, S1). */
export const asksDriveDay = (s: Pick<FlowState, 'nights'>): boolean => s.nights >= 3;
/** Moves are asked for a long weekend and longer (S1). */
export const asksMoves = (s: Pick<FlowState, 'kind'>): boolean => s.kind !== null && s.kind !== 'day' && s.kind !== 'weekend';

export const REACH_CHOICES = PLAN_BUILDER_UI.reachChoicesMin;
