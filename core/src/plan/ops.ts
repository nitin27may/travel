// The edit operations on one editable trip document (edit-my-trip.md 4.4 item 1, EM5; task EM-C). Every change a person makes to a
// copy is one operation with an id; applying it returns the new draft and its INVERSE (a short list of operations that undo it), so
// undo, redo and the conflict rebase all use the same functions. Pure: no clock, no storage, no randomness (inverse ids are derived
// from the operation's id unless the caller passes `newId`).
//
// The set (4.4): setTitle, setDates, setParty, setVariant, setNote, setWindow, addPlace, removePlace, moveItem, insertDay, dropDay,
// addMaybe, reset; and two entry-level forms the inverses use, deleteEntry and restoreEntry. Most need a template draft (`mode`
// otherwise); setTitle, setDates and setParty (without a profile) apply to a built draft too.
//
// STEP2-C1 (gap-analysis D2, D9; edit-mode-spec 5, 6, 8, 11.3, 13): the BUILT-MODE operations edit mode needs on a builder plan or a
// converted copy: addPick, removePick, swapItems, replacePick, lock, unlock, release, setMust, moveDay, the engine inputs setPace,
// setNights, setBase, setOrigin, setWhere and setDriveDay, setBuild (a build or a re-flow's result), and the built forms of moveItem
// (`ref`), insertDay, dropDay and setNote (the top-level `notes`). Both modes take setIdentity; template mode takes setRev (11.3, "OK
// records the new rev"). `convert` is the one bridge from template to built (13.2); its inverse `toTemplate` restores the template block
// byte for byte, and is also "Reset to our plan" on a converted trip (a fresh block of our trip). Built operations refuse a template
// draft and template operations a built one (`mode`, D9). restoreFields is the built inverse form.
//
// Built mode keeps the person's placement in `edits` (one entry per edited day: its refs in order, the locked, the placed and the
// from-our-trip refs) and changes INPUTS only; `lastBuild` is the engine's output and changes only by setBuild, except that the day
// operations renumber its days so it keeps describing the same days. Where a day has no `edits` entry its stops are the last build's;
// `builtDays` resolves the two into one placement (the page model and the re-flow read it, never a second rule). A built operation
// that needs a day's order writes that day's entry in full ("materialises" it) and keeps `edits` in day order.
//
// A built document has no entries to hold operation ids, so it keeps a short ledger, `opLog` (the last PLAN_EDIT.builtOpLog ids of
// the operations that touch the placement, picks, bases, notes, nights or build): a resend after a lost answer is skipped whole. An
// operation whose intent is already true (remove a pick that is gone, lock a locked stop) changes only the ledger; one whose target
// is gone (move a removed pick) is skipped as `gone` and listed by the rebase. The inverse of a recorded operation is a snapshot of
// the fields it changed (restoreFields), so a built undo is last-write-wins on those fields, as the field operations are (known
// limit: an undo can overwrite another device's change to the same field made since the step was taken). Undo never shortens the
// ledger, so "apply then inverse" is the identity on the content, with the ledger one id longer.
//
// Day numbers in a template block count the PUBLISHED plan's days, and an inserted day is named by its operation id, so an operation
// made on one device still means the same day after another device inserted or dropped one (the rebase never renumbers).
//
// Rebase (4.4 steps 2 and 3): `rebase(serverDoc, pending)` re-applies the device's pending operations, in order, onto the server's
// latest document. An operation whose id the document already holds is already applied (another tab sent it): it changes nothing. An
// operation whose target is gone, that would duplicate a place, or that would break a rule of the document is SKIPPED and listed with
// its reason, never dropped silently (P4: the copy shows "1 change from this device was not applied"). Field operations (title,
// dates, party, a day's version, a note, the window) are last-write-wins by arrival.
import { z } from "zod";
import { PLAN_DOC_LIMITS, PLAN_EDIT } from "../config/plans.ts";
import { apiTownId } from "../schema/api/common.ts";
import {
  type Checked,
  parsePlanDraft,
  planAdded,
  planBaseChoice,
  planBuiltNotes,
  planDayEdit,
  type PlanDayEdit,
  planDayOp,
  planDayRef,
  planDraft,
  type PlanDraft,
  planIssuesOf,
  planMaybe,
  planMoved,
  planNoteText,
  planOpId,
  planOrigin,
  planOutputs,
  planPick,
  planProfile,
  planRef,
  planRemoved,
  planScheduleId,
  planSlug,
  planSourceRevision,
  planTemplate,
  planTemplateDay,
  type PlanTemplate,
  type PlanTemplateList,
  planTravellers,
  planWhere,
  planWindowId,
  PLAN_BUILT_NOTE_KEY_RE,
  PLAN_COUNTRY_RE,
  PLAN_IDENTITY_KEYS,
  PLAN_LIMITS,
  PLAN_NOTE_KEY_RE,
  PLAN_PACES,
  PLAN_TEMPLATE_LISTS,
} from "../schema/plan-draft.ts";

const id = planOpId;
const variant = z.enum(["A", "B", "C"]);
/** A day of a built plan, 1 to PLAN_LIMITS.days (built days are numbered; nothing is named by an operation id there). */
const builtDay = z.number().int().min(1).max(PLAN_LIMITS.days);
const pickName = planPick.shape.name;
const driveDayMin = planDraft.shape.driveDayMin.unwrap();
/** A note key of either mode; the document's own rules say which mode takes which form. */
const noteKey = z.union([z.string().regex(PLAN_NOTE_KEY_RE), z.string().regex(PLAN_BUILT_NOTE_KEY_RE)]);

/** One operation. Strict objects inside the JSON Schema subset, so the outbox exports and validates like any envelope. */
export const planOp = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("setTitle"), id, title: planDraft.shape.title }),
  /** `month` defaults to the start's month (a start and the draft's month always agree); an inverse carries it explicitly */
  z.strictObject({ kind: z.literal("setDates"), id, start: z.iso.date().nullable(), month: z.number().int().min(1).max(12).nullable().optional() }),
  /**
   * The trip's own party (null: back to the device party) and, on a template draft, the timeline profile that plans for it, set
   * together so the two never disagree (bug B1). `pace` defaults to the profile's
   */
  z.strictObject({ kind: z.literal("setParty"), id, travellers: planTravellers.nullable(), profile: planProfile.nullable().optional(), pace: z.enum(PLAN_PACES).optional() }),
  /** a published day's version; null: back to the version chosen for the party */
  z.strictObject({ kind: z.literal("setVariant"), id, day: planTemplateDay, variant: variant.nullable() }),
  /**
   * a note; null removes it. Template: the trip, a published day, an inserted day, a published stop (`<day>:<item>`) or an added place
   * (its operation id), in `template.notes`. Built: the trip, a day or a pick (its ref), in the top-level `notes`
   */
  z.strictObject({ kind: z.literal("setNote"), id, key: noteKey, text: planNoteText.nullable() }),
  z.strictObject({ kind: z.literal("setWindow"), id, window: planWindowId.nullable() }),
  /** a catalogue place onto a day; the entry it makes carries this operation's id */
  z.strictObject({ kind: z.literal("addPlace"), id, day: planDayRef, ref: planRef, after: planScheduleId.optional() }),
  /** a published stop (`day` and `item`) or a place the person added (`added`: its entry's operation id); exactly one (a rule) */
  z.strictObject({ kind: z.literal("removePlace"), id, day: planTemplateDay.optional(), item: planScheduleId.optional(), added: planOpId.optional() }),
  /**
   * Template: a published stop (`day` and `item`) or an added place (`added`) to `toDay`, after `after` (a published stop: absent is
   * the start). Built (STEP2-C1): a pick (`ref`) to the built day `toDay`, after `afterRef`, first with `first`, else at the end; it is
   * then placed by the person ("Moved by you", kept on its day) and keeps a lock it had
   */
  z.strictObject({
    kind: z.literal("moveItem"),
    id,
    day: planTemplateDay.optional(),
    item: planScheduleId.optional(),
    added: planOpId.optional(),
    ref: planRef.optional(),
    toDay: planDayRef,
    after: planScheduleId.optional(),
    afterRef: planRef.optional(),
    first: z.literal(true).optional(),
  }),
  /** an empty day after `after` (0: before Day 1); built: the later days renumber, and the new day has the base of the day before */
  z.strictObject({ kind: z.literal("insertDay"), id, after: z.number().int().min(0).max(99) }),
  /**
   * Template: a published day (a number), or an inserted day (its operation id) with what was put on it. Built: a day number, its
   * stops removed with it, and the later days renumbered. `to` (STEP2-C1): the day its stops move to instead
   */
  z.strictObject({ kind: z.literal("dropDay"), id, day: planDayRef, to: planDayRef.optional() }),
  z.strictObject({ kind: z.literal("addMaybe"), id, ref: planRef }),
  /** a published day's changes (versions, places, moves, its drop), or with `day: null` every change to the published plan */
  z.strictObject({ kind: z.literal("reset"), id, day: planTemplateDay.nullable() }),
  /** removes the template entry made by operation `target` (an inverse form) */
  z.strictObject({ kind: z.literal("deleteEntry"), id, target: planOpId }),
  /** puts one template entry back at `index` of its list, or replaces the entry with its operation id (an inverse form) */
  z.strictObject({
    kind: z.literal("restoreEntry"),
    id,
    index: z.number().int().min(0).max(999),
    days: planDayOp.optional(),
    added: planAdded.optional(),
    removed: planRemoved.optional(),
    moved: planMoved.optional(),
    maybe: planMaybe.optional(),
  }),
  // ---- STEP2-C1: both modes, template only, built only ----
  /** the trip's identity colour (FLOW TF19); null removes it. Both modes */
  z.strictObject({ kind: z.literal("setIdentity"), id, identity: z.enum(PLAN_IDENTITY_KEYS).nullable() }),
  /** template: the revision of our trip the person has seen ("We updated this trip · OK", edit-mode-spec 11.3) */
  z.strictObject({ kind: z.literal("setRev"), id, rev: planSourceRevision.nullable() }),
  /** built: a catalogue place as a pick ("Added by you"); with `day`, placed on that day after `afterRef` (absent: the end) */
  z.strictObject({ kind: z.literal("addPick"), id, ref: planRef, slug: planSlug, name: pickName, must: z.boolean().optional(), day: builtDay.optional(), afterRef: planRef.optional() }),
  /** built: a pick off the trip, from its day and its note (any stop: ours, the engine's or the person's) */
  z.strictObject({ kind: z.literal("removePick"), id, ref: planRef }),
  /** built: two placed picks change places (days and positions); both are then placed by the person */
  z.strictObject({ kind: z.literal("swapItems"), id, a: planRef, b: planRef }),
  /** built: a pick swapped for a nearby place, which takes its day and position ("Swap for a nearby place") */
  z.strictObject({ kind: z.literal("replacePick"), id, ref: planRef, with: z.strictObject({ ref: planRef, slug: planSlug, name: pickName }) }),
  /** built: keep a placed pick on its day and position on every rebuild ("Keep on Day n" on) */
  z.strictObject({ kind: z.literal("lock"), id, ref: planRef }),
  /** built: the lock off; a stop the person placed stays placed */
  z.strictObject({ kind: z.literal("unlock"), id, ref: planRef }),
  /** built: "Let the plan move it": the lock, placed-by-you and from-our-trip marks off for these picks, in one step */
  z.strictObject({ kind: z.literal("release"), id, refs: z.array(planRef).min(1).max(PLAN_LIMITS.picks) }),
  /** built: Must see on or off */
  z.strictObject({ kind: z.literal("setMust"), id, ref: planRef, must: z.boolean() }),
  /** built: a day moves to position `to`, inside one base's run of the last build (edit-mode-spec 6 "Reorder days") */
  z.strictObject({ kind: z.literal("moveDay"), id, day: builtDay, to: builtDay }),
  /** built engine input: the pace (Apply line, then a re-flow) */
  z.strictObject({ kind: z.literal("setPace"), id, pace: z.enum(PLAN_PACES) }),
  /** built engine input: the nights; a shorter plan lets go of the edits, notes and built days past its last day */
  z.strictObject({ kind: z.literal("setNights"), id, nights: z.number().int().min(0).max(PLAN_LIMITS.nights) }),
  /** built engine input: the base of `town` becomes `base` (a new town appends; null removes it) */
  z.strictObject({ kind: z.literal("setBase"), id, town: apiTownId, base: planBaseChoice.nullable() }),
  /** built engine input: where the trip starts (Getting there); null: not chosen */
  z.strictObject({ kind: z.literal("setOrigin"), id, origin: planOrigin.nullable() }),
  /** built engine input: where (a country and regions, or a start and a drive limit) */
  z.strictObject({ kind: z.literal("setWhere"), id, where: planWhere }),
  /** built engine input: the longest drive in a day; null: from the pace */
  z.strictObject({ kind: z.literal("setDriveDay"), id, driveDayMin: driveDayMin.nullable() }),
  /** built: the result of a build, a rebuild or a re-flow on the device; null clears it */
  z.strictObject({ kind: z.literal("setBuild"), id, lastBuild: planOutputs.nullable() }),
  /**
   * template to built in place (edit-mode-spec 13.2): the caller materialises our plan from the plan model (picks, pinned bases, every
   * day's stops in `edits` with ours in `fromTrip` and the person's in `placed`, the chosen versions flattened) and may pass a build;
   * `seed` becomes our trip and `convertedAt` is `at`. Absent fields keep the draft's (`where`, `pace`, `origin`) or stay absent
   */
  z.strictObject({
    kind: z.literal("convert"),
    id,
    at: z.iso.datetime(),
    picks: z.array(planPick).max(PLAN_LIMITS.picks),
    bases: z.array(planBaseChoice).max(PLAN_LIMITS.bases),
    edits: z.array(planDayEdit).max(PLAN_LIMITS.days),
    lastBuild: planOutputs.nullable().optional(),
    notes: planBuiltNotes.optional(),
    nights: z.number().int().min(0).max(PLAN_LIMITS.nights).optional(),
    pace: z.enum(PLAN_PACES).optional(),
    origin: planOrigin.nullable().optional(),
    where: planWhere.optional(),
    driveDayMin: driveDayMin.optional(),
  }),
  /**
   * a converted trip back to template mode on its own trip (`seed`): `convert`'s inverse, and "Reset to our plan" after conversion (a
   * fresh block). The built inputs, the build and the built notes go; `pace` defaults to the block's profile, else the draft's
   */
  z.strictObject({
    kind: z.literal("toTemplate"),
    id,
    template: planTemplate,
    nights: z.number().int().min(0).max(PLAN_DOC_LIMITS.templateDays - 1),
    cc: z.string().regex(PLAN_COUNTRY_RE),
    pace: z.enum(PLAN_PACES).optional(),
  }),
  /** built: puts back the fields a recorded built operation changed, as they were (the built inverse form); null removes the notes */
  z.strictObject({
    kind: z.literal("restoreFields"),
    id,
    picks: z.array(planPick).max(PLAN_LIMITS.picks).optional(),
    bases: z.array(planBaseChoice).max(PLAN_LIMITS.bases).optional(),
    edits: z.array(planDayEdit).max(PLAN_LIMITS.days).optional(),
    notes: planBuiltNotes.nullable().optional(),
    nights: planDraft.shape.nights.optional(),
    lastBuild: planOutputs.nullable().optional(),
  }),
]);
export type PlanOp = z.infer<typeof planOp>;
export type PlanOpKind = PlanOp["kind"];
export const PLAN_OP_KINDS = planOp.options.map((o) => o.shape.kind.value) as readonly PlanOpKind[];

/** The operations that need a template draft. setNote, moveItem, insertDay and dropDay have a built form too (STEP2-C1). */
const TEMPLATE_ONLY = new Set<PlanOpKind>(["setVariant", "setWindow", "addPlace", "removePlace", "addMaybe", "reset", "deleteEntry", "restoreEntry", "setRev", "convert"]);
/** The operations that need a built draft (STEP2-C1). */
export const BUILT_OP_KINDS = [
  "addPick",
  "removePick",
  "swapItems",
  "replacePick",
  "lock",
  "unlock",
  "release",
  "setMust",
  "moveDay",
  "setPace",
  "setNights",
  "setBase",
  "setOrigin",
  "setWhere",
  "setDriveDay",
  "setBuild",
  "toTemplate",
  "restoreFields",
] as const satisfies readonly PlanOpKind[];
const BUILT_ONLY = new Set<PlanOpKind>(BUILT_OP_KINDS);
/** The operations of template mode (edit-mode-spec 13.1's left column, and the inverse forms). */
export const TEMPLATE_OP_KINDS = [...TEMPLATE_ONLY] as readonly PlanOpKind[];
/** The operations both modes take; moveItem, insertDay, dropDay and setNote act by the draft's mode. */
export const SHARED_OP_KINDS = ["setTitle", "setDates", "setParty", "setNote", "setIdentity", "moveItem", "insertDay", "dropDay"] as const satisfies readonly PlanOpKind[];

/** Why an operation was not applied. */
export type PlanSkipReason =
  /** the operation does not parse or breaks its own rule */
  | "invalid-op"
  /** it needs the other mode: a template draft, or a built one (D9) */
  | "mode"
  /** its target is not in the draft (removed or dropped elsewhere) */
  | "gone"
  /** the place is already on the plan or the Maybe list */
  | "duplicate"
  /** the result would break a rule of the document (a cap, a day of the plan, the 16 KB) */
  | "invalid";

export type PlanOpResult =
  | { ok: true; doc: PlanDraft; inverse: PlanOp[]; /** false when the draft already held it (a resend, or a no-op) */ changed: boolean }
  | { ok: false; reason: PlanSkipReason; issues: string[] };

/** Exactly one target: a published stop (`day` and `item`) or an added place (`added`). */
const oneTarget = (o: { day?: number; item?: string; added?: string }): boolean =>
  o.added !== undefined ? o.day === undefined && o.item === undefined : o.day !== undefined && o.item !== undefined;

/** An operation's own rules: one target for remove and move, one entry for restoreEntry. Paths only. */
export function planOpRules(op: PlanOp): string[] {
  if (op.kind === "moveItem" && op.ref !== undefined) {
    if (op.day !== undefined || op.item !== undefined || op.added !== undefined || op.after !== undefined) return ["$: a built move names a pick (ref), not a template stop"];
    if (op.afterRef !== undefined && op.first !== undefined) return ["$: after a stop or first, not both"];
    if (op.afterRef === op.ref) return ["$.afterRef: another stop"];
    return [];
  }
  if (op.kind === "moveItem" && (op.afterRef !== undefined || op.first !== undefined)) return ["$: afterRef and first belong to a built move"];
  if ((op.kind === "removePlace" || op.kind === "moveItem") && !oneTarget(op)) return ["$: a published stop (day and item) or an added place, not both"];
  if (op.kind === "addPick" && op.afterRef !== undefined && op.day === undefined) return ["$.afterRef: only with a day"];
  if (op.kind === "addPick" && op.afterRef === op.ref) return ["$.afterRef: another stop"];
  if (op.kind === "swapItems" && op.a === op.b) return ["$: two different stops"];
  if (op.kind === "replacePick" && op.with.ref === op.ref) return ["$.with: another place"];
  if (op.kind === "moveDay" && op.day === op.to) return ["$.to: another position"];
  if (op.kind === "dropDay" && op.to !== undefined && op.to === op.day) return ["$.to: another day"];
  if (op.kind === "restoreEntry" && PLAN_TEMPLATE_LISTS.filter((l) => op[l] !== undefined).length !== 1) return ["$: exactly one entry"];
  if (op.kind === "setParty" && op.travellers === null && op.profile !== undefined && op.profile !== null && op.profile.party === "family") {
    return ["$.profile: a family profile needs the travellers"];
  }
  return [];
}

/** One operation, as received (an outbox read, a request): the schema, then its rules. */
export function parsePlanOp(x: unknown): Checked<PlanOp> {
  const r = planOp.safeParse(x);
  if (!r.success) return { success: false, issues: planIssuesOf(r.error) };
  const rules = planOpRules(r.data);
  return rules.length ? { success: false, issues: rules } : { success: true, data: r.data };
}

// ---- helpers --------------------------------------------------------------------------------------------------------------------

type Entry<L extends PlanTemplateList> = PlanTemplate[L][number];
type AnyEntry = Entry<PlanTemplateList>;
type Found = { list: PlanTemplateList; index: number; entry: AnyEntry };

/** The entry an operation id made, in whichever list holds it. */
function findEntry(t: PlanTemplate, op: string): Found | null {
  for (const list of PLAN_TEMPLATE_LISTS) {
    const index = (t[list] as readonly AnyEntry[]).findIndex((e) => e.op === op);
    if (index >= 0) return { list, index, entry: (t[list] as readonly AnyEntry[])[index]! };
  }
  return null;
}

/** 32-bit FNV-1a, base 36: a short deterministic token for derived inverse ids. */
function fnv(s: string, seed = 0x811c9dc5): string {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** Ids for the inverse of `op`: the caller's (`newId`, a random token on the device), else derived from the operation's id. */
function idMaker(op: PlanOp, newId?: () => string): () => string {
  let n = 0;
  return () => {
    if (newId) return newId();
    const k = `${op.id}:${n++}`;
    return `o-u${fnv(k)}${fnv(k, 0x050c5d1f)}`;
  };
}

const restoreOf = (nextId: () => string, f: Found): PlanOp => ({ kind: "restoreEntry", id: nextId(), index: f.index, [f.list]: f.entry }) as PlanOp;
const deleteOf = (nextId: () => string, target: string): PlanOp => ({ kind: "deleteEntry", id: nextId(), target });

/** A day operation's effect on the nights: an insert adds one, a drop takes one. */
const nightsOf = (e: AnyEntry, list: PlanTemplateList): number => (list !== "days" ? 0 : (e as Entry<"days">).kind === "insert" ? 1 : -1);

/** Notes in a fixed key order: days by number (JavaScript keeps integer keys first anyway), `trip`, then inserted days in day-op order. */
function orderNotes(t: PlanTemplate): void {
  const ins = t.days.flatMap((d) => (d.kind === "insert" ? [d.op] : []));
  const rank = (k: string): number => (/^\d+$/.test(k) ? Number(k) : k === "trip" ? 1000 : 2000 + (ins.indexOf(k) + 1 || 999));
  t.notes = Object.fromEntries(Object.entries(t.notes).sort((a, b) => rank(a[0]) - rank(b[0])));
}

/** Deletes the template notes whose key matches `pick`; returns the setNote operations that put them back (STEP2-C1 stop notes). */
function dropNotes(t: PlanTemplate, pick: (key: string) => boolean, nextId: () => string): PlanOp[] {
  const back: PlanOp[] = [];
  for (const [key, text] of Object.entries(t.notes)) {
    if (!pick(key)) continue;
    delete t.notes[key];
    back.push({ kind: "setNote", id: nextId(), key, text });
  }
  return back;
}

/** Removes the entries matching `pick` from one list; returns what went, with the indexes they had (ascending). */
function takeWhere<L extends PlanTemplateList>(t: PlanTemplate, list: L, pick: (e: Entry<L>) => boolean): Found[] {
  const all = t[list] as Entry<L>[];
  const gone: Found[] = [];
  const keep: Entry<L>[] = [];
  all.forEach((e, index) => (pick(e) ? gone.push({ list, index, entry: e }) : keep.push(e)));
  (t as Record<PlanTemplateList, unknown>)[list] = keep;
  return gone;
}

const skip = (reason: PlanSkipReason, issues: string[] = []): PlanOpResult => ({ ok: false, reason, issues });
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
/** Equal content whatever the key order (a built result is written in the document's key order, its input may not be). */
const stable = (x: unknown): string =>
  JSON.stringify(x, (_k, v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v));
const sameContent = (a: unknown, b: unknown): boolean => stable(a) === stable(b);

/** The document's keys in their declared order: a built result, a conversion and its inverse are written in it, so a round trip is byte for byte. */
const DRAFT_KEYS = Object.keys(planDraft.shape) as (keyof PlanDraft)[];
function canonical(n: PlanDraft): PlanDraft {
  const o: Record<string, unknown> = {};
  for (const k of DRAFT_KEYS) if (n[k] !== undefined) o[k] = n[k];
  return o as PlanDraft;
}
const monthOf = (iso: string): number => Number(iso.slice(5, 7));

// ---- apply ----------------------------------------------------------------------------------------------------------------------

/**
 * Applies one operation to a draft. Returns the new draft (validated whole: `parsePlanDraft`) and the inverse operations that restore
 * the draft exactly when applied in order, or the reason it was skipped. Never mutates its input; never touches `updatedAt` (the
 * caller stamps it when it saves, `touchDraft`).
 */
export function applyOp(d: PlanDraft, x: PlanOp, opts: { newId?: () => string } = {}): PlanOpResult {
  const p = parsePlanOp(x);
  if (!p.success) return skip("invalid-op", p.issues);
  const op = p.data;
  const nextIdOf = idMaker(op, opts.newId);
  if (d.template === undefined && !UNLOGGED.has(op.kind) && d.opLog?.includes(op.id)) return { ok: true, doc: d, inverse: [], changed: false };
  if (TEMPLATE_ONLY.has(op.kind) && d.template === undefined) {
    // a resend of the conversion that made this trip changes nothing
    if (op.kind === "convert" && d.convertedAt === op.at) return { ok: true, doc: d, inverse: [], changed: false };
    return skip("mode");
  }
  if (BUILT_ONLY.has(op.kind) && d.template !== undefined) {
    if (op.kind === "toTemplate" && same(d.template, op.template)) return { ok: true, doc: d, inverse: [], changed: false };
    return skip("mode");
  }
  if (op.kind === "setParty" && d.template === undefined && op.profile !== undefined && op.profile !== null) return skip("mode");
  if (op.kind === "moveItem" && op.ref !== undefined && d.template !== undefined) return skip("mode");
  if (op.kind === "convert" || op.kind === "toTemplate") return applyBridge(d, op, nextIdOf);
  if (d.template === undefined && (BUILT_ONLY.has(op.kind) || BUILT_FORMS.has(op.kind))) return applyBuilt(d, op, nextIdOf);
  const n: PlanDraft = structuredClone(d);
  const t = n.template as PlanTemplate; // present for every TEMPLATE_ONLY kind (checked above)
  const nextId = nextIdOf;
  const already = (): PlanOpResult => ({ ok: true, doc: d, inverse: [], changed: false });
  let inverse: PlanOp[] = [];

  switch (op.kind) {
    case "setTitle":
      n.title = op.title;
      inverse = [{ kind: "setTitle", id: nextId(), title: d.title }];
      break;
    case "setDates": {
      if (op.start === null) delete n.start;
      else n.start = op.start;
      n.month = op.month !== undefined ? op.month : op.start !== null ? monthOf(op.start) : d.month;
      inverse = [{ kind: "setDates", id: nextId(), start: d.start ?? null, month: d.month }];
      break;
    }
    case "setParty": {
      if (op.travellers === null) {
        n.party = "device";
        delete n.travellers;
      } else {
        n.party = "trip";
        n.travellers = { adults: op.travellers.adults, children: [...op.travellers.children] };
      }
      if (n.template !== undefined && op.profile !== undefined) t.profile = op.profile;
      n.pace = op.pace ?? (n.template !== undefined && op.profile ? op.profile.pace : n.pace);
      inverse = [
        {
          kind: "setParty",
          id: nextId(),
          travellers: d.travellers ?? null,
          ...(d.template !== undefined && op.profile !== undefined ? { profile: d.template.profile } : {}),
          pace: d.pace,
        },
      ];
      break;
    }
    case "setVariant": {
      const k = String(op.day);
      const old = t.overrides[k] ?? null;
      if (op.variant === null) delete t.overrides[k];
      else t.overrides[k] = op.variant;
      inverse = [{ kind: "setVariant", id: nextId(), day: op.day, variant: old }];
      break;
    }
    case "setNote": {
      const old = t.notes[op.key] ?? null;
      if (op.text === null) delete t.notes[op.key];
      else t.notes[op.key] = op.text;
      orderNotes(t);
      inverse = [{ kind: "setNote", id: nextId(), key: op.key, text: old }];
      break;
    }
    case "setWindow":
      t.window = op.window;
      inverse = [{ kind: "setWindow", id: nextId(), window: d.template!.window }];
      break;
    case "addPlace": {
      if (findEntry(t, op.id)) return already();
      if (t.added.some((a) => a.ref === op.ref)) return skip("duplicate");
      t.added.push({ op: op.id, day: op.day, ref: op.ref, ...(op.after !== undefined ? { after: op.after } : {}) });
      inverse = [deleteOf(nextId, op.id)];
      break;
    }
    case "removePlace": {
      if (op.added !== undefined) {
        const f = findEntry(t, op.added);
        if (!f || f.list !== "added") return skip("gone");
        t.added.splice(f.index, 1);
        const gone = op.added;
        inverse = [restoreOf(nextId, f), ...dropNotes(t, (k) => k === gone, nextId)];
        break;
      }
      if (findEntry(t, op.id)) return already();
      if (t.removed.some((r) => r.day === op.day && r.item === op.item)) return already();
      t.removed.push({ op: op.id, day: op.day!, item: op.item! });
      inverse = [deleteOf(nextId, op.id)];
      break;
    }
    case "moveItem": {
      const after = op.after !== undefined ? { after: op.after } : {};
      if (op.added !== undefined) {
        const f = findEntry(t, op.added);
        if (!f || f.list !== "added") return skip("gone");
        const old = f.entry as Entry<"added">;
        t.added[f.index] = { op: old.op, day: op.toDay, ref: old.ref, ...after };
        inverse = [restoreOf(nextId, f)];
        break;
      }
      if (findEntry(t, op.id)) return already();
      const entry = { op: op.id, day: op.day!, item: op.item!, toDay: op.toDay, ...after };
      const i = t.moved.findIndex((m) => m.day === op.day && m.item === op.item);
      if (i >= 0) {
        const f: Found = { list: "moved", index: i, entry: t.moved[i]! };
        t.moved[i] = entry;
        inverse = [deleteOf(nextId, op.id), restoreOf(nextId, f)];
      } else {
        t.moved.push(entry);
        inverse = [deleteOf(nextId, op.id)];
      }
      break;
    }
    case "insertDay": {
      if (findEntry(t, op.id)) return already();
      t.days.push({ op: op.id, kind: "insert", after: op.after });
      n.nights = (n.nights ?? 0) + 1;
      inverse = [deleteOf(nextId, op.id)];
      break;
    }
    case "dropDay": {
      const to = op.to !== undefined ? { to: op.to } : {};
      if (typeof op.day === "number") {
        if (findEntry(t, op.id)) return already();
        if (t.days.some((x) => x.kind === "drop" && x.day === op.day)) return already();
        t.days.push({ op: op.id, kind: "drop", day: op.day, ...to });
        n.nights = (n.nights ?? 0) - 1;
        inverse = [deleteOf(nextId, op.id)];
        break;
      }
      const day = op.day;
      const ins = findEntry(t, day);
      if (!ins || ins.list !== "days") return skip("gone");
      t.days.splice(ins.index, 1);
      let added: Found[];
      let moved: Found[];
      if (op.to === undefined) {
        added = takeWhere(t, "added", (a) => a.day === day);
        moved = takeWhere(t, "moved", (m) => m.toDay === day);
      } else {
        // STEP2-C1: its stops move to `to` (at the end of that day) instead of going with it
        const dest = op.to;
        added = [];
        moved = [];
        t.added.forEach((a, index) => {
          if (a.day !== day) return;
          added.push({ list: "added", index, entry: a });
          t.added[index] = { op: a.op, day: dest, ref: a.ref };
        });
        t.moved.forEach((m, index) => {
          if (m.toDay !== day) return;
          moved.push({ list: "moved", index, entry: m });
          t.moved[index] = { op: m.op, day: m.day, item: m.item, toDay: dest };
        });
      }
      const goneAdds = new Set(op.to === undefined ? added.map((f) => f.entry.op) : []);
      n.nights = (n.nights ?? 0) - 1;
      inverse = [
        restoreOf(nextId, ins),
        ...added.map((f) => restoreOf(nextId, f)),
        ...moved.map((f) => restoreOf(nextId, f)),
        ...dropNotes(t, (k) => k === day || goneAdds.has(k), nextId),
      ];
      break;
    }
    case "addMaybe": {
      if (findEntry(t, op.id)) return already();
      if (t.maybe.some((m) => m.ref === op.ref)) return already();
      t.maybe.push({ op: op.id, ref: op.ref });
      inverse = [deleteOf(nextId, op.id)];
      break;
    }
    case "reset": {
      const day = op.day;
      const all = day === null;
      const inserted = t.days.flatMap((x) => (x.kind === "insert" ? [x.op] : []));
      const days = takeWhere(t, "days", (x) => all || (x.kind === "drop" && x.day === day));
      const added = takeWhere(t, "added", (a) => all || a.day === day);
      const removed = takeWhere(t, "removed", (r) => all || r.day === day);
      const moved = takeWhere(t, "moved", (m) => all || m.day === day || m.toDay === day);
      const maybe = all ? takeWhere(t, "maybe", () => true) : [];
      const overrides = Object.entries(d.template!.overrides).filter(([k]) => all || k === String(day));
      for (const [k] of overrides) delete t.overrides[k];
      const goneAdds = new Set(added.map((f) => f.entry.op));
      const notes = Object.entries(d.template!.notes).filter(([k]) => (all && inserted.includes(k)) || goneAdds.has(k));
      for (const [k] of notes) delete t.notes[k];
      const windowWas = d.template!.window;
      if (all) t.window = null;
      n.nights = (n.nights ?? 0) - days.reduce((s, f) => s + nightsOf(f.entry, "days"), 0);
      inverse = [
        ...days.map((f) => restoreOf(nextId, f)),
        ...added.map((f) => restoreOf(nextId, f)),
        ...removed.map((f) => restoreOf(nextId, f)),
        ...moved.map((f) => restoreOf(nextId, f)),
        ...maybe.map((f) => restoreOf(nextId, f)),
        ...overrides.map(([k, v]) => ({ kind: "setVariant", id: nextId(), day: Number(k), variant: v }) as PlanOp),
        ...notes.map(([k, v]) => ({ kind: "setNote", id: nextId(), key: k, text: v }) as PlanOp),
        ...(all && windowWas !== null ? [{ kind: "setWindow", id: nextId(), window: windowWas } as PlanOp] : []),
      ];
      break;
    }
    case "deleteEntry": {
      const f = findEntry(t, op.target);
      if (!f) return skip("gone");
      (t[f.list] as AnyEntry[]).splice(f.index, 1);
      n.nights = (n.nights ?? 0) - nightsOf(f.entry, f.list);
      inverse = [restoreOf(nextId, f)];
      break;
    }
    case "restoreEntry": {
      const list = PLAN_TEMPLATE_LISTS.find((l) => op[l] !== undefined)!;
      const entry = op[list] as AnyEntry;
      const f = findEntry(t, entry.op);
      if (f && f.list !== list) return skip("invalid", ["$: an operation id names one entry (R7)"]);
      const arr = t[list] as AnyEntry[];
      if (f) {
        if (same(f.entry, entry)) return already();
        if (list === "days" && (f.entry as Entry<"days">).kind !== (entry as Entry<"days">).kind) return skip("invalid", ["$.days: an entry keeps its kind"]);
        arr[f.index] = entry;
        inverse = [restoreOf(nextId, f)];
      } else {
        arr.splice(Math.min(op.index, arr.length), 0, entry);
        n.nights = (n.nights ?? 0) + nightsOf(entry, list);
        inverse = [deleteOf(nextId, entry.op)];
      }
      if (list === "days") orderNotes(t);
      break;
    }
    case "setIdentity":
      if (op.identity === null) delete n.identity;
      else n.identity = op.identity;
      inverse = [{ kind: "setIdentity", id: nextId(), identity: d.identity ?? null }];
      break;
    case "setRev":
      t.rev = op.rev;
      inverse = [{ kind: "setRev", id: nextId(), rev: d.template!.rev }];
      break;
    default:
      return skip("mode");
  }

  if (same(n, d)) return already();
  const r = parsePlanDraft(n.template === undefined ? canonical(n) : n);
  if (!r.success) return skip("invalid", r.issues);
  return { ok: true, doc: r.data, inverse, changed: true };
}

// ---- built mode (STEP2-C1) ------------------------------------------------------------------------------------------------------

/** The shared kinds that act on a built draft in their built form. */
const BUILT_FORMS = new Set<PlanOpKind>(["moveItem", "insertDay", "dropDay", "setNote"]);
/** The fields the recorded built operations change: their inverse snapshots the ones they did (restoreFields). */
const BUILT_FIELDS = ["picks", "bases", "edits", "notes", "nights", "lastBuild"] as const;
type BuiltField = (typeof BUILT_FIELDS)[number];
/**
 * The built operations recorded in `opLog` (STEP2-C1), changed or not; one already there is skipped, so a resend after a lost answer
 * is skipped whole (a move is relative: replayed, it lands elsewhere). Every operation that touches the placement, the picks, the
 * bases, the notes, the nights or the build is recorded, because skipping only some of them would let a replayed later one undo a
 * skipped one. The field setters that touch none of those (setTitle, setDates, setParty, setIdentity, setPace, setOrigin, setWhere,
 * setDriveDay) are last-write-wins and replay to the same result, so they are not recorded.
 */
const UNLOGGED = new Set<PlanOpKind>(["setTitle", "setDates", "setParty", "setIdentity", "setPace", "setOrigin", "setWhere", "setDriveDay"]);
function logged(n: PlanDraft, opId: string): PlanDraft {
  return canonical({ ...n, opLog: [...(n.opLog ?? []), opId].slice(-PLAN_EDIT.builtOpLog) });
}
/** Optional fields: null in restoreFields removes them. */
const OPTIONAL_FIELDS = new Set<BuiltField>(["notes"]);

/** One day of a built plan as the person sees it: its stops in order and their marks. */
export interface BuiltDay {
  day: number;
  /** the picks on this day, in order */
  refs: string[];
  /** "Kept on Day n" by a lock */
  locked: string[];
  /** placed by the person ("Moved by you", "Added by you" when the pick is `added`) */
  placed: string[];
  /** placed from our trip at a conversion ("From our trip") */
  fromTrip: string[];
  /** true when `edits` holds this day; false when its stops are the last build's */
  edited: boolean;
}

/**
 * The placement of a built draft, day by day (STEP2-C1): a day's `edits` entry where there is one, else the last build's stops of that
 * day that are still picks and on no edited day; days 1 to nights + 1 that neither names are empty. A pick on no day is in Did not fit
 * or not placed yet ("Your picks not on a day", edit-mode-spec 7.2 group 4). The one rule the page model and the re-flow read.
 */
export function builtDays(d: PlanDraft): BuiltDay[] {
  const picks = new Set(d.picks.map((p) => p.ref));
  const byDay = new Map<number, BuiltDay>();
  const seen = new Set<string>();
  for (const e of d.edits) {
    const refs = e.refs.filter((r) => picks.has(r));
    refs.forEach((r) => seen.add(r));
    byDay.set(e.day, { day: e.day, refs, locked: [...e.locked], placed: [...(e.placed ?? [])], fromTrip: [...(e.fromTrip ?? [])], edited: true });
  }
  for (const b of [...(d.lastBuild?.days ?? [])].sort((x, y) => x.day - y.day)) {
    if (byDay.has(b.day)) continue;
    const refs: string[] = [];
    for (const it of b.items) {
      if (!picks.has(it.ref) || seen.has(it.ref)) continue;
      seen.add(it.ref);
      refs.push(it.ref);
    }
    byDay.set(b.day, { day: b.day, refs, locked: [], placed: [], fromTrip: [], edited: false });
  }
  const last = d.nights === null ? 0 : d.nights + 1;
  for (let day = 1; day <= last; day++) if (!byDay.has(day)) byDay.set(day, { day, refs: [], locked: [], placed: [], fromTrip: [], edited: false });
  return [...byDay.values()].sort((a, b) => a.day - b.day);
}

/** The built day a pick is on, or null (not placed). */
export function builtDayOf(d: PlanDraft, ref: string): number | null {
  return builtDays(d).find((b) => b.refs.includes(ref))?.day ?? null;
}

/** The `edits` entry of `day`, written in full from the placement when the day has none yet (kept in day order). */
function entryFor(n: PlanDraft, day: number): PlanDayEdit {
  const found = n.edits.find((e) => e.day === day);
  if (found) return found;
  const e: PlanDayEdit = { day, refs: [...(builtDays(n).find((b) => b.day === day)?.refs ?? [])], locked: [] };
  const at = n.edits.findIndex((x) => x.day > day);
  n.edits.splice(at < 0 ? n.edits.length : at, 0, e);
  return e;
}

const without = (xs: readonly string[] | undefined, ref: string): string[] | undefined => (xs === undefined ? undefined : xs.filter((x) => x !== ref));
/** Takes a ref off a day entry (its order and every mark); says whether it was locked. */
function takeRef(e: PlanDayEdit, ref: string): boolean {
  const locked = e.locked.includes(ref);
  e.refs = e.refs.filter((x) => x !== ref);
  e.locked = e.locked.filter((x) => x !== ref);
  e.placed = without(e.placed, ref);
  e.fromTrip = without(e.fromTrip, ref);
  return locked;
}
/** Puts a ref into a day's order: first, after `afterRef`, or at the end. */
function putRef(e: PlanDayEdit, ref: string, afterRef?: string, first?: true): void {
  const at = first ? 0 : afterRef !== undefined ? e.refs.indexOf(afterRef) + 1 : e.refs.length;
  e.refs.splice(at, 0, ref);
}
function addMark(e: PlanDayEdit, mark: "locked" | "placed" | "fromTrip", ref: string): void {
  const xs = e[mark] ?? [];
  if (!xs.includes(ref)) xs.push(ref);
  e[mark] = xs;
}
/** The person placed `ref` on this day: placed, no longer "From our trip". */
function markPlaced(e: PlanDayEdit, ref: string): void {
  addMark(e, "placed", ref);
  e.fromTrip = without(e.fromTrip, ref);
}
/** Empty marks are absent, so an entry reads as the builder writes it. */
function tidy(n: PlanDraft): void {
  for (const e of n.edits) {
    if (e.placed !== undefined && !e.placed.length) delete e.placed;
    if (e.fromTrip !== undefined && !e.fromTrip.length) delete e.fromTrip;
  }
  if (n.notes !== undefined && !Object.keys(n.notes).length) delete n.notes;
}

/** Renumbers the built days (null drops one) in `edits`, the day notes and the last build; `edits` and the build stay in day order. */
function remapDays(n: PlanDraft, f: (day: number) => number | null): void {
  n.edits = n.edits.flatMap((e) => {
    const k = f(e.day);
    return k === null ? [] : [{ ...e, day: k }];
  });
  n.edits.sort((a, b) => a.day - b.day);
  if (n.notes !== undefined) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(n.notes)) {
      if (!/^\d+$/.test(k)) out[k] = v;
      else {
        const m = f(Number(k));
        if (m !== null) out[String(m)] = v;
      }
    }
    n.notes = out;
  }
  if (n.lastBuild !== null) {
    const days = n.lastBuild.days.flatMap((b) => {
      const k = f(b.day);
      return k === null ? [] : [{ ...b, day: k }];
    });
    days.sort((a, b) => a.day - b.day);
    n.lastBuild = { ...n.lastBuild, days };
  }
}

/** Base nights add up to at most the plan's nights: take the excess from `prefer` first, then from the last base back. */
function trimBases(n: PlanDraft, prefer: string | null): void {
  let over = n.bases.reduce((s, b) => s + (b.nights ?? 0), 0) - (n.nights ?? 0);
  if (over <= 0) return;
  const order = [...n.bases].reverse();
  const first = order.findIndex((b) => b.town === prefer);
  if (first > 0) order.unshift(...order.splice(first, 1));
  for (const b of order) {
    if (over <= 0) break;
    const take = Math.min(over, b.nights ?? 0);
    if (b.nights !== null) b.nights -= take;
    over -= take;
  }
}

/** The built inverse: the fields `n` changed, as they were in `d`. */
function restoreOfFields(d: PlanDraft, n: PlanDraft, nextId: () => string): PlanOp[] {
  const o: Record<string, unknown> = {};
  for (const f of BUILT_FIELDS) if (!sameContent(d[f] ?? null, n[f] ?? null)) o[f] = d[f] === undefined ? null : structuredClone(d[f]);
  return Object.keys(o).length ? [{ kind: "restoreFields", id: nextId(), ...o } as PlanOp] : [];
}

const dayIssue = (path: string): PlanOpResult => skip("invalid", [`${path}: a day of the plan`]);

/** A built-mode operation (or a shared kind's built form) on a built draft. */
function applyBuilt(d: PlanDraft, op: PlanOp, nextId: () => string): PlanOpResult {
  const n: PlanDraft = structuredClone(d);
  const last = d.nights === null ? null : d.nights + 1;
  const isPick = (ref: string): boolean => n.picks.some((p) => p.ref === ref);
  const inDays = (day: number): boolean => last === null || day <= last;
  let inverse: PlanOp[] | null = null;

  switch (op.kind) {
    case "moveItem": {
      if (op.ref === undefined) return skip("mode");
      if (typeof op.toDay !== "number" || !inDays(op.toDay) || op.toDay > PLAN_LIMITS.days) return dayIssue("$.toDay");
      if (!isPick(op.ref)) return skip("gone");
      if (op.afterRef !== undefined && builtDayOf(n, op.afterRef) !== op.toDay) return skip("gone");
      const from = builtDayOf(n, op.ref);
      const src = from === null ? null : entryFor(n, from);
      const dst = entryFor(n, op.toDay);
      const locked = src ? takeRef(src, op.ref) : false;
      putRef(dst, op.ref, op.afterRef, op.first);
      markPlaced(dst, op.ref);
      if (locked) addMark(dst, "locked", op.ref);
      break;
    }
    case "addPick": {
      if (op.day !== undefined && !inDays(op.day)) return dayIssue("$.day");
      if (isPick(op.ref)) return op.day === undefined || builtDayOf(n, op.ref) === op.day ? { ok: true, doc: d, inverse: [], changed: false } : skip("duplicate");
      if (op.afterRef !== undefined && builtDayOf(n, op.afterRef) !== op.day) return skip("gone");
      const dst = op.day === undefined ? null : entryFor(n, op.day);
      n.picks.push({ ref: op.ref, slug: op.slug, name: op.name, must: op.must ?? false, added: true });
      if (dst) {
        putRef(dst, op.ref, op.afterRef);
        markPlaced(dst, op.ref);
      }
      break;
    }
    case "removePick": {
      if (!isPick(op.ref)) break; // already off the trip: nothing to do, nothing to report
      n.picks = n.picks.filter((p) => p.ref !== op.ref);
      for (const e of n.edits) takeRef(e, op.ref);
      if (n.notes) delete n.notes[op.ref];
      break;
    }
    case "swapItems": {
      if (!isPick(op.a) || !isPick(op.b)) return skip("gone");
      const da = builtDayOf(n, op.a);
      const db = builtDayOf(n, op.b);
      if (da === null || db === null) return skip("gone");
      const ea = entryFor(n, da);
      const eb = entryFor(n, db);
      const ia = ea.refs.indexOf(op.a);
      const ib = eb.refs.indexOf(op.b);
      if (ea === eb) {
        ea.refs[ia] = op.b;
        ea.refs[ib] = op.a;
      } else {
        const la = takeRef(ea, op.a);
        const lb = takeRef(eb, op.b);
        ea.refs.splice(ia, 0, op.b);
        eb.refs.splice(ib, 0, op.a);
        if (la) addMark(eb, "locked", op.a);
        if (lb) addMark(ea, "locked", op.b);
      }
      markPlaced(eb, op.a);
      markPlaced(ea, op.b);
      break;
    }
    case "replacePick": {
      const at = n.picks.findIndex((p) => p.ref === op.ref);
      if (at < 0) return isPick(op.with.ref) ? { ok: true, doc: d, inverse: [], changed: false } : skip("gone");
      if (isPick(op.with.ref)) return skip("duplicate");
      const day = builtDayOf(n, op.ref);
      const e = day === null ? null : entryFor(n, day); // before the pick goes, so the day keeps its order
      n.picks[at] = { ref: op.with.ref, slug: op.with.slug, name: op.with.name, must: false, added: true };
      if (e) {
        const i = e.refs.indexOf(op.ref);
        const locked = takeRef(e, op.ref);
        e.refs.splice(i, 0, op.with.ref);
        markPlaced(e, op.with.ref);
        if (locked) addMark(e, "locked", op.with.ref);
      }
      if (n.notes) delete n.notes[op.ref];
      break;
    }
    case "lock": {
      if (!isPick(op.ref)) return skip("gone");
      const day = builtDayOf(n, op.ref);
      if (day === null) return skip("gone");
      addMark(entryFor(n, day), "locked", op.ref);
      break;
    }
    case "unlock":
      for (const e of n.edits) e.locked = e.locked.filter((x) => x !== op.ref);
      break;
    case "release":
      for (const ref of op.refs) {
        for (const e of n.edits) {
          if (!e.refs.includes(ref)) continue;
          e.locked = e.locked.filter((x) => x !== ref);
          e.placed = without(e.placed, ref);
          e.fromTrip = without(e.fromTrip, ref);
        }
      }
      break;
    case "setMust": {
      const p = n.picks.find((x) => x.ref === op.ref);
      if (!p) return skip("gone");
      p.must = op.must;
      break;
    }
    case "insertDay": {
      if (last === null || op.after > last) return dayIssue("$.after");
      const base = d.lastBuild?.days.find((b) => b.day === op.after)?.base ?? null;
      remapDays(n, (x) => (x > op.after ? x + 1 : x));
      if (n.lastBuild !== null) {
        const days = [...n.lastBuild.days, { day: op.after + 1, base, move: false, items: [], returnMin: null, warnings: [], reasons: [] }];
        days.sort((a, b) => a.day - b.day);
        n.lastBuild = { ...n.lastBuild, days };
      }
      n.nights = d.nights! + 1;
      break;
    }
    case "dropDay": {
      const day = op.day;
      const to = op.to;
      if (typeof day !== "number" || last === null || day > last) return dayIssue("$.day");
      if (to !== undefined && (typeof to !== "number" || to > last)) return dayIssue("$.to");
      if (last < 2) return skip("invalid", ["$.day: a plan keeps one day"]);
      const stops = builtDays(n).find((b) => b.day === day)?.refs ?? [];
      const base = d.lastBuild?.days.find((b) => b.day === day)?.base ?? null;
      if (to !== undefined) {
        const src = n.edits.find((e) => e.day === day);
        const dst = entryFor(n, to);
        for (const ref of stops) {
          const locked = src ? src.locked.includes(ref) : false;
          if (!dst.refs.includes(ref)) dst.refs.push(ref);
          markPlaced(dst, ref);
          if (locked) addMark(dst, "locked", ref);
        }
      } else {
        const gone = new Set(stops);
        n.picks = n.picks.filter((p) => !gone.has(p.ref));
        if (n.notes) for (const ref of stops) delete n.notes[ref];
      }
      remapDays(n, (x) => (x === day ? null : x > day ? x - 1 : x));
      n.nights = d.nights! - 1;
      trimBases(n, base);
      break;
    }
    case "moveDay": {
      const b = d.lastBuild;
      if (b === null) return skip("invalid", ["$: days reorder after a build"]);
      if (!inDays(op.day) || !inDays(op.to)) return dayIssue("$.to");
      const lo = Math.min(op.day, op.to);
      const hi = Math.max(op.day, op.to);
      const run = b.days.filter((x) => x.day >= lo && x.day <= hi);
      const town = run[0]?.base ?? null;
      if (run.length !== hi - lo + 1 || town === null || run.some((x) => x.base !== town || x.move)) return skip("invalid", ["$.to: inside one base's run"]);
      const from = op.day;
      const dest = op.to;
      remapDays(n, (x) => (x === from ? dest : from < dest ? (x > from && x <= dest ? x - 1 : x) : x >= dest && x < from ? x + 1 : x));
      break;
    }
    case "setNote": {
      if (!PLAN_BUILT_NOTE_KEY_RE.test(op.key)) return skip("invalid", ["$.key: the trip, a day or a pick"]);
      const old = n.notes?.[op.key] ?? null;
      const notes = { ...(n.notes ?? {}) };
      if (op.text === null) delete notes[op.key];
      else notes[op.key] = op.text;
      n.notes = notes;
      inverse = [{ kind: "setNote", id: nextId(), key: op.key, text: old }];
      break;
    }
    case "setPace":
      n.pace = op.pace;
      inverse = [{ kind: "setPace", id: nextId(), pace: d.pace }];
      break;
    case "setNights": {
      n.nights = op.nights;
      const end = op.nights + 1;
      remapDays(n, (x) => (x > end ? null : x));
      trimBases(n, null);
      break;
    }
    case "setBase": {
      const at = n.bases.findIndex((b) => b.town === op.town);
      if (op.base === null) {
        if (at >= 0) n.bases.splice(at, 1);
      } else if (at >= 0) n.bases[at] = op.base;
      else n.bases.push(op.base);
      break;
    }
    case "setOrigin":
      n.origin = op.origin;
      inverse = [{ kind: "setOrigin", id: nextId(), origin: d.origin }];
      break;
    case "setWhere":
      n.where = op.where;
      inverse = [{ kind: "setWhere", id: nextId(), where: d.where }];
      break;
    case "setDriveDay":
      if (op.driveDayMin === null) delete n.driveDayMin;
      else n.driveDayMin = op.driveDayMin;
      inverse = [{ kind: "setDriveDay", id: nextId(), driveDayMin: d.driveDayMin ?? null }];
      break;
    case "setBuild":
      n.lastBuild = op.lastBuild;
      inverse = [{ kind: "setBuild", id: nextId(), lastBuild: d.lastBuild }];
      break;
    case "restoreFields": {
      const fields = n as unknown as Record<BuiltField, unknown>;
      for (const f of BUILT_FIELDS) {
        const v = op[f];
        if (v === undefined) continue;
        if (v === null && OPTIONAL_FIELDS.has(f)) delete fields[f];
        else fields[f] = structuredClone(v);
      }
      break;
    }
    default:
      return skip("mode");
  }

  tidy(n);
  const out = canonical(n);
  const log = !UNLOGGED.has(op.kind);
  if (sameContent(out, d)) return log ? { ok: true, doc: logged(d, op.id), inverse: [], changed: true } : { ok: true, doc: d, inverse: [], changed: false };
  const r = parsePlanDraft(log ? logged(out, op.id) : out);
  if (!r.success) return skip("invalid", r.issues);
  return { ok: true, doc: r.data, inverse: inverse ?? restoreOfFields(d, r.data, nextId), changed: true };
}

/** `convert` (template to built in place) and `toTemplate` (back, or a fresh copy of our trip), each the other's inverse. */
function applyBridge(d: PlanDraft, op: Extract<PlanOp, { kind: "convert" | "toTemplate" }>, nextId: () => string): PlanOpResult {
  let out: PlanDraft;
  let inverse: PlanOp[];
  if (op.kind === "convert") {
    const t = d.template!;
    const { template: _t, notes: _n, driveDayMin: _m, convertedAt: _c, opLog: _l, ...rest } = d;
    out = canonical({
      ...structuredClone(rest),
      where: op.where ?? d.where,
      nights: op.nights ?? d.nights,
      pace: op.pace ?? d.pace,
      picks: op.picks,
      bases: op.bases,
      edits: op.edits,
      origin: op.origin !== undefined ? op.origin : d.origin,
      seed: t.trip,
      lastBuild: op.lastBuild ?? null,
      ...(op.notes !== undefined && Object.keys(op.notes).length ? { notes: op.notes } : {}),
      ...(op.driveDayMin !== undefined ? { driveDayMin: op.driveDayMin } : {}),
      convertedAt: op.at,
    });
    if (d.where.mode !== "trip" || d.nights === null) return skip("invalid", ["$: a template draft in trip mode with its nights (R1)"]);
    inverse = [{ kind: "toTemplate", id: nextId(), template: structuredClone(t), nights: d.nights, cc: d.where.cc, pace: d.pace }];
  } else {
    if (d.convertedAt === undefined || d.seed !== op.template.trip) return skip("invalid", ["$.template: the trip this one was converted from"]);
    const { notes: _n, driveDayMin: _m, convertedAt: _c, opLog: _l, ...rest } = d;
    out = canonical({
      ...structuredClone(rest),
      where: { mode: "trip", cc: op.cc, regions: [] },
      nights: op.nights,
      pace: op.pace ?? op.template.profile?.pace ?? d.pace,
      picks: [],
      bases: [],
      edits: [],
      origin: null,
      seed: null,
      lastBuild: null,
      template: structuredClone(op.template),
    });
    inverse = [
      {
        kind: "convert",
        id: nextId(),
        at: d.convertedAt,
        picks: structuredClone(d.picks),
        bases: structuredClone(d.bases),
        edits: structuredClone(d.edits),
        lastBuild: structuredClone(d.lastBuild),
        ...(d.notes !== undefined ? { notes: structuredClone(d.notes) } : {}),
        ...(d.nights !== null ? { nights: d.nights } : {}),
        pace: d.pace,
        origin: structuredClone(d.origin),
        where: structuredClone(d.where),
        ...(d.driveDayMin !== undefined ? { driveDayMin: d.driveDayMin } : {}),
      },
    ];
  }
  if (sameContent(out, d)) return { ok: true, doc: d, inverse: [], changed: false };
  const r = parsePlanDraft(out);
  if (!r.success) return skip("invalid", r.issues);
  return { ok: true, doc: r.data, inverse, changed: true };
}

export interface ApplyOpsResult {
  doc: PlanDraft;
  /** the operations that changed the draft or were already in it, in order */
  applied: PlanOp[];
  /** the operations not applied, each with its reason (4.4 step 6: listed, never silent) */
  skipped: { op: PlanOp; reason: PlanSkipReason }[];
  /** undoes every applied operation, last first */
  inverse: PlanOp[];
}

/** Applies operations in order; a skipped one leaves the draft as it was and the rest still apply. */
export function applyOps(d: PlanDraft, ops: readonly PlanOp[], opts: { newId?: () => string } = {}): ApplyOpsResult {
  let doc = d;
  const applied: PlanOp[] = [];
  const skipped: ApplyOpsResult["skipped"] = [];
  const inverses: PlanOp[][] = [];
  for (const op of ops) {
    const r = applyOp(doc, op, opts);
    if (!r.ok) {
      skipped.push({ op, reason: r.reason });
      continue;
    }
    doc = r.doc;
    applied.push(op);
    inverses.unshift(r.inverse);
  }
  return { doc, applied, skipped, inverse: inverses.flat() };
}

/**
 * The conflict rebase (4.4 step 3): the device's pending operations, in order, onto the server's latest document. Returns the draft
 * to send with the server's revision as its base, and what was skipped (target gone, a duplicate, a rule) for the notice of step 6.
 * Idempotent on operation ids: an operation the server document already holds (another tab sent it) changes nothing.
 */
export function rebase(serverDoc: PlanDraft, pending: readonly PlanOp[]): { doc: PlanDraft; applied: PlanOp[]; skipped: { op: PlanOp; reason: PlanSkipReason }[] } {
  const { doc, applied, skipped } = applyOps(serverDoc, pending);
  return { doc, applied, skipped };
}

/** The draft with `updatedAt` set (never before `createdAt`): what the caller does once before it saves or sends. */
export function touchDraft(d: PlanDraft, at: Date): PlanDraft {
  const iso = at.toISOString();
  return { ...d, updatedAt: Date.parse(iso) < Date.parse(d.createdAt) ? d.createdAt : iso };
}
