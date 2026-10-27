// The device side of account sync (edit-my-trip.md 4.3 to 4.7; task EM-C): the OUTBOX of pending operations a signed-in device holds
// until the account confirms them, the conflict step, and the row state the Mine chips show. Pure: the browser's storage, the clock
// and the network are passed in by the caller (EM-2's Mine sync module); nothing here names a storage key (the account-hashed
// keys of 4.3 are EM-2's, in the one keys module).
//
// The outbox is household data like the drafts it edits: it is cleared at sign-out (with the person's consent when it is not empty,
// 4.6) and never leaves the device except as the documents it produces.
import { z } from "zod";
import { PLAN_SYNC } from "../config/plans.ts";
import { type Checked, type PlanDraft, planDraftId, planIssuesOf } from "../schema/plan-draft.ts";
import { type PlanOp, planOp, planOpRules, type PlanSkipReason, rebase } from "./ops.ts";

export const PLAN_OUTBOX_SCHEMA = "plan-outbox/1";

/** One pending change: an operation on one draft, with the account revision it was made on (null: the draft is not in the account yet). */
export const planPendingChange = z.strictObject({
  draft: planDraftId,
  op: planOp,
  base: z.number().int().min(0).nullable(),
  /** when it was made (UTC, `Z`): the order of a draft's changes is the list's, this is for the "not synced since" line only */
  at: z.iso.datetime(),
});
export const planOutbox = z.strictObject({
  schema: z.literal(PLAN_OUTBOX_SCHEMA),
  items: z.array(planPendingChange).max(PLAN_SYNC.outboxOps),
});
export type PlanPendingChange = z.infer<typeof planPendingChange>;
export type PlanOutbox = z.infer<typeof planOutbox>;

export const emptyPlanOutbox = (): PlanOutbox => ({ schema: PLAN_OUTBOX_SCHEMA, items: [] });

/** The outbox's rules: each operation's own rules, and one operation id once per draft (a resend dedupes on it). Paths only. */
export function planOutboxRules(o: PlanOutbox): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  o.items.forEach((c, i) => {
    for (const r of planOpRules(c.op)) out.push(`$.items[${i}].op${r.slice(1)}`);
    const k = `${c.draft}\u0000${c.op.id}`;
    if (seen.has(k)) out.push(`$.items[${i}].op.id: once per draft`);
    seen.add(k);
  });
  return out;
}

/** The outbox: the schema, then the rules. */
export function parsePlanOutbox(x: unknown): Checked<PlanOutbox> {
  const r = planOutbox.safeParse(x);
  if (!r.success) return { success: false, issues: planIssuesOf(r.error) };
  const rules = planOutboxRules(r.data);
  return rules.length ? { success: false, issues: rules } : { success: true, data: r.data };
}

export type ReadPlanOutbox = { ok: true; outbox: PlanOutbox; fresh: boolean } | { ok: false; reason: "corrupt" | "newer" | "invalid"; issues: string[] };

/** Reads the stored text, as the other device lists: absent is empty; a bad or newer value is reported and never rewritten. */
export function readPlanOutbox(raw: string | null): ReadPlanOutbox {
  if (raw === null) return { ok: true, outbox: emptyPlanOutbox(), fresh: true };
  let x: unknown;
  try {
    x = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "corrupt", issues: ["$: not JSON"] };
  }
  const s = x && typeof x === "object" && !Array.isArray(x) ? (x as { schema?: unknown }).schema : undefined;
  const m = typeof s === "string" ? /^plan-outbox\/(\d+)$/.exec(s) : null;
  if (m && Number(m[1]) > 1) return { ok: false, reason: "newer", issues: [`$.schema: plan-outbox/${m[1]}`] };
  const r = parsePlanOutbox(x);
  return r.success ? { ok: true, outbox: r.data, fresh: false } : { ok: false, reason: "invalid", issues: r.issues };
}

export type EnqueueResult = { ok: true; outbox: PlanOutbox; /** false: this operation was already queued */ added: boolean } | { ok: false; reason: "full" | "invalid"; issues: string[] };

/** Queues one change (4.3: the outbox first, then the server). The same operation id on the same draft is queued once. */
export function enqueue(o: PlanOutbox, change: PlanPendingChange): EnqueueResult {
  if (o.items.some((c) => c.draft === change.draft && c.op.id === change.op.id)) return { ok: true, outbox: o, added: false };
  if (o.items.length >= PLAN_SYNC.outboxOps) return { ok: false, reason: "full", issues: [`$.items: at most ${PLAN_SYNC.outboxOps} changes`] };
  const next: PlanOutbox = { ...o, items: [...o.items, change] };
  const r = parsePlanOutbox(next);
  return r.success ? { ok: true, outbox: r.data, added: true } : { ok: false, reason: "invalid", issues: r.issues };
}

/** A draft's pending operations, in the order they were made. */
export const pendingFor = (o: PlanOutbox, draft: string): PlanOp[] => o.items.filter((c) => c.draft === draft).map((c) => c.op);

/** After the server accepted a document holding these operations: they leave the outbox (others, made meanwhile, stay). */
export function confirm(o: PlanOutbox, draft: string, opIds: readonly string[]): PlanOutbox {
  const done = new Set(opIds);
  return { ...o, items: o.items.filter((c) => c.draft !== draft || !done.has(c.op.id)) };
}

/** A draft's changes leave the outbox: it was removed on another device (4.5), or the person chose "Sign out and discard it". */
export function discardDraft(o: PlanOutbox, draft: string): { outbox: PlanOutbox; discarded: PlanPendingChange[] } {
  return { outbox: { ...o, items: o.items.filter((c) => c.draft !== draft) }, discarded: o.items.filter((c) => c.draft === draft) };
}

/** Pending changes per draft, in first-change order: the sign-out dialog's "1 change to <trip> is not in your account yet" (4.6). */
export function pendingCounts(o: PlanOutbox): { draft: string; count: number }[] {
  const m = new Map<string, number>();
  for (const c of o.items) m.set(c.draft, (m.get(c.draft) ?? 0) + 1);
  return [...m].map(([draft, count]) => ({ draft, count }));
}

/**
 * The conflict step (4.4 step 3): the server answered 409 with its document and revision. The device's pending operations for this
 * draft are rebased onto it; the result is sent again with the server's revision as `base`. `skipped` feeds the notice of step 6.
 * `round` counts the 409s of this send; at PLAN_SYNC.rebaseRounds the caller stops and shows "Not synced · Retry" (`giveUp`).
 */
export function onConflict(
  server: { revision: number; doc: PlanDraft },
  pending: readonly PlanOp[],
  round: number,
): { doc: PlanDraft; base: number; skipped: { op: PlanOp; reason: PlanSkipReason }[]; giveUp: boolean } {
  const r = rebase(server.doc, pending);
  return { doc: r.doc, base: server.revision, skipped: r.skipped, giveUp: round >= PLAN_SYNC.rebaseRounds };
}

/** The row states of Mine (4.7), the quiet default first. */
export const PLAN_ROW_STATES = ["quiet", "syncing", "offline", "retry", "device"] as const;
export type PlanRowState = (typeof PLAN_ROW_STATES)[number];

/**
 * A row's state (4.7). Signed out, every row is quiet (the card says they are on this device). Signed in: a device copy the merge did
 * not take is `device`; a row whose last round failed is `retry`; pending changes offline are `offline`; pending changes being sent
 * for over a second are `syncing` (the caller passes `sendingMs`); otherwise quiet ("in your account"). Never colour alone: the chip's
 * words are EM-2's.
 */
export function planRowState(s: { signedIn: boolean; onDeviceOnly: boolean; pending: number; online: boolean; failed: boolean; sendingMs: number | null }): PlanRowState {
  if (!s.signedIn) return "quiet";
  if (s.onDeviceOnly) return "device";
  if (s.failed) return "retry";
  if (s.pending > 0 && !s.online) return "offline";
  if (s.pending > 0 && s.sendingMs !== null && s.sendingMs > 1000) return "syncing";
  return "quiet";
}
