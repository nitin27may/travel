// The edit operations on one editable trip document (edit-my-trip.md 4.4 item 1, EM5; task EM-C). Every change a person makes to a
// copy is one operation with an id; applying it returns the new draft and its INVERSE (a short list of operations that undo it), so
// undo, redo and the conflict rebase all use the same functions. Pure: no clock, no storage, no randomness (inverse ids are derived
// from the operation's id unless the caller passes `newId`).
//
// The set (4.4): setTitle, setDates, setParty, setVariant, setNote, setWindow, addPlace, removePlace, moveItem, insertDay, dropDay,
// addMaybe, reset; and two entry-level forms the inverses use, deleteEntry and restoreEntry. Most need a template draft (`mode`
// otherwise); setTitle, setDates and setParty (without a profile) apply to a built draft too.
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
import {
  type Checked,
  parsePlanDraft,
  planAdded,
  planDayOp,
  planDayRef,
  planDraft,
  type PlanDraft,
  planIssuesOf,
  planMaybe,
  planMoved,
  planNoteText,
  planOpId,
  planProfile,
  planRef,
  planRemoved,
  planScheduleId,
  planTemplateDay,
  type PlanTemplate,
  type PlanTemplateList,
  planTravellers,
  planWindowId,
  PLAN_NOTE_KEY_RE,
  PLAN_PACES,
  PLAN_TEMPLATE_LISTS,
} from "../schema/plan-draft.ts";

const id = planOpId;
const variant = z.enum(["A", "B", "C"]);

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
  /** a note on the trip, a published day or an inserted day; null removes it */
  z.strictObject({ kind: z.literal("setNote"), id, key: z.string().regex(PLAN_NOTE_KEY_RE), text: planNoteText.nullable() }),
  z.strictObject({ kind: z.literal("setWindow"), id, window: planWindowId.nullable() }),
  /** a catalogue place onto a day; the entry it makes carries this operation's id */
  z.strictObject({ kind: z.literal("addPlace"), id, day: planDayRef, ref: planRef, after: planScheduleId.optional() }),
  /** a published stop (`day` and `item`) or a place the person added (`added`: its entry's operation id); exactly one (a rule) */
  z.strictObject({ kind: z.literal("removePlace"), id, day: planTemplateDay.optional(), item: planScheduleId.optional(), added: planOpId.optional() }),
  /** a published stop (`day` and `item`) or an added place (`added`) to `toDay`, after `after` (a published stop: absent is the start) */
  z.strictObject({
    kind: z.literal("moveItem"),
    id,
    day: planTemplateDay.optional(),
    item: planScheduleId.optional(),
    added: planOpId.optional(),
    toDay: planDayRef,
    after: planScheduleId.optional(),
  }),
  z.strictObject({ kind: z.literal("insertDay"), id, after: z.number().int().min(0).max(99) }),
  /** a published day (a number), or an inserted day (its operation id) with what was put on it */
  z.strictObject({ kind: z.literal("dropDay"), id, day: planDayRef }),
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
]);
export type PlanOp = z.infer<typeof planOp>;
export type PlanOpKind = PlanOp["kind"];
export const PLAN_OP_KINDS = planOp.options.map((o) => o.shape.kind.value) as readonly PlanOpKind[];

/** The operations that need a template draft. */
const TEMPLATE_ONLY = new Set<PlanOpKind>(["setVariant", "setNote", "setWindow", "addPlace", "removePlace", "moveItem", "insertDay", "dropDay", "addMaybe", "reset", "deleteEntry", "restoreEntry"]);

/** Why an operation was not applied. */
export type PlanSkipReason =
  /** the operation does not parse or breaks its own rule */
  | "invalid-op"
  /** it needs a template draft */
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
  if ((op.kind === "removePlace" || op.kind === "moveItem") && !oneTarget(op)) return ["$: a published stop (day and item) or an added place, not both"];
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
  if (TEMPLATE_ONLY.has(op.kind) && d.template === undefined) return skip("mode");
  if (op.kind === "setParty" && d.template === undefined && op.profile !== undefined && op.profile !== null) return skip("mode");
  const n: PlanDraft = structuredClone(d);
  const t = n.template as PlanTemplate; // present for every TEMPLATE_ONLY kind (checked above)
  const nextId = idMaker(op, opts.newId);
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
        inverse = [restoreOf(nextId, f)];
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
      if (typeof op.day === "number") {
        if (findEntry(t, op.id)) return already();
        if (t.days.some((x) => x.kind === "drop" && x.day === op.day)) return already();
        t.days.push({ op: op.id, kind: "drop", day: op.day });
        n.nights = (n.nights ?? 0) - 1;
        inverse = [deleteOf(nextId, op.id)];
        break;
      }
      const day = op.day;
      const ins = findEntry(t, day);
      if (!ins || ins.list !== "days") return skip("gone");
      t.days.splice(ins.index, 1);
      const added = takeWhere(t, "added", (a) => a.day === day);
      const moved = takeWhere(t, "moved", (m) => m.toDay === day);
      const note = t.notes[day];
      delete t.notes[day];
      n.nights = (n.nights ?? 0) - 1;
      inverse = [
        restoreOf(nextId, ins),
        ...added.map((f) => restoreOf(nextId, f)),
        ...moved.map((f) => restoreOf(nextId, f)),
        ...(note !== undefined ? [{ kind: "setNote", id: nextId(), key: day, text: note } as PlanOp] : []),
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
      const notes = all ? Object.entries(d.template!.notes).filter(([k]) => inserted.includes(k)) : [];
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
  }

  if (same(n, d)) return already();
  const r = parsePlanDraft(n);
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
