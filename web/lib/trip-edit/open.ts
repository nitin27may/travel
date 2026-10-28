// Opening and saving a trip's document (STEP2-T1 step 2). Two homes, one answer:
//   - the account (signed in, `accountTrips` on): the EM-2 engine holds the confirmed document and the outbox; an edit goes to its
//     `edit()` (the outbox first, then the server) and the screen shows the document with the pending changes applied;
//   - the device: `travel.copies.local` (`copies/1`). The copy is read as a template `plan-draft/1` (core `copyToPlanDraft`), the
//     operations are applied to it, and the result is written back into the same copy item (its photo, id, copy date and the keys the
//     document does not hold stay as they were).
// Pure over a `StorageLike` and an account handle, so a test passes a memory store. No React; the hook is useTripDocument.ts.
import { applyOps, type PlanOp } from '@travel/core/plan/ops.ts';
import { copyToPlanDraft, type PlanTripFacts } from '@travel/core/plan/doc.ts';
import { COPIES_KEY, readCopies, updateCopies, type CopyItem, type StorageLike } from '@travel/core/schema/copies.ts';
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { isTripId } from './keys';

/** The slice of the EM-2 engine this module uses (a test passes a fake). */
export interface AccountHandle {
  view(id: string): PlanDraft | null;
  edit(id: string, ops: readonly PlanOp[]): { ok: true } | { ok: false; reason: string };
}

export type Where = 'device' | 'account';

export type OpenResult =
  | { kind: 'ok'; doc: PlanDraft; where: Where; copy: CopyItem | null }
  /** not on this device and not in this account; also another account's id (no existence signal, edit-mode-spec 15) */
  | { kind: 'missing' }
  /** a document written by a newer version of the site: read-only until a reload */
  | { kind: 'newer' };

export interface OpenDeps {
  storage: StorageLike;
  account?: AccountHandle | null;
  /** The trip's country and days for a copy that lacks them (a copy moved from the old key). */
  facts?: (slug: string) => PlanTripFacts | null;
}

/** The copy item with this id, from the device list. */
export function findCopy(storage: StorageLike, id: string): { kind: 'ok'; copy: CopyItem } | { kind: 'missing' } | { kind: 'newer' } {
  let raw: string | null;
  try {
    raw = storage.getItem(COPIES_KEY);
  } catch {
    return { kind: 'missing' };
  }
  const r = readCopies(raw);
  if (!r.ok) return r.reason === 'newer' ? { kind: 'newer' } : { kind: 'missing' };
  const copy = r.envelope.items.find((c) => c.id === id);
  return copy ? { kind: 'ok', copy } : { kind: 'missing' };
}

/** The document for `id`: the account's first, else the device's. */
export function openTrip(id: string, deps: OpenDeps): OpenResult {
  if (!isTripId(id)) return { kind: 'missing' };
  const acct = deps.account?.view(id) ?? null;
  if (acct) return { kind: 'ok', doc: acct, where: 'account', copy: null };
  const found = findCopy(deps.storage, id);
  if (found.kind !== 'ok') return found;
  const d = copyToPlanDraft(found.copy, { facts: deps.facts });
  if (!d.success) return { kind: 'missing' };
  return { kind: 'ok', doc: d.data, where: 'device', copy: found.copy };
}

/** The device copy with a document's choices written back: the keys a template document holds, over the item as it was. */
export function copyWithDraft(copy: CopyItem, d: PlanDraft): CopyItem {
  const t = d.template;
  if (!t) return copy;
  const added = t.added.flatMap((a) => (typeof a.day === 'number' && a.ref.startsWith('place/') ? [{ day: a.day, placeSlug: a.ref.slice('place/'.length) }] : []));
  return {
    ...copy,
    title: d.title ?? copy.title,
    start: d.start ?? copy.start,
    adults: d.travellers?.adults ?? copy.adults,
    children: d.travellers ? [...d.travellers.children] : copy.children,
    profile: t.profile,
    overrides: t.overrides,
    added,
  };
}

export type SaveResult = { ok: true } | { ok: false; reason: 'missing' | 'newer' | 'invalid' | 'storage' | 'full' };

/**
 * Applies operations to a trip and saves them. All or nothing: an operation that does not apply (its target is gone, a rule) refuses the
 * whole call and nothing is written. Signed in with the trip in the account, the engine takes them (outbox first); otherwise the
 * device copy is rewritten through the core's compare-and-set (`updateCopies`), never a bare `setItem`.
 */
export function saveOps(id: string, ops: readonly PlanOp[], deps: OpenDeps): SaveResult {
  const open = openTrip(id, deps);
  if (open.kind !== 'ok') return { ok: false, reason: open.kind };
  if (open.where === 'account') {
    const r = deps.account!.edit(id, ops);
    if (r.ok) return { ok: true };
    return { ok: false, reason: r.reason === 'full' ? 'full' : r.reason === 'storage' ? 'storage' : r.reason === 'unknown' ? 'missing' : 'invalid' };
  }
  const applied = applyOps(open.doc, ops);
  if (applied.skipped.length) return { ok: false, reason: 'invalid' };
  const copy = copyWithDraft(open.copy!, applied.doc);
  const w = updateCopies(deps.storage, (env) => ({ envelope: { ...env, items: env.items.map((c) => (c.id === id ? copy : c)) }, value: null }));
  if (w.ok) return { ok: true };
  return { ok: false, reason: w.reason === 'newer' ? 'newer' : w.reason === 'quota' ? 'full' : 'storage' };
}

/** The sync word of edit-mode-spec 12 (no "Saved": a copy is kept, not saved, patterns 3.7). */
export type SyncWord = 'In your account' | 'Syncing' | 'Not synced yet' | 'Not synced · Retry' | 'On this device';

export function syncWord(where: Where, state: 'quiet' | 'syncing' | 'offline' | 'retry' | 'device'): SyncWord {
  if (where === 'device') return 'On this device';
  if (state === 'syncing') return 'Syncing';
  if (state === 'offline') return 'Not synced yet';
  if (state === 'retry') return 'Not synced · Retry';
  if (state === 'device') return 'On this device';
  return 'In your account';
}
