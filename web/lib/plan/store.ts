// The builder's two device stores (FLOW 6; ISO-3). Both go through the one door to localStorage (lib/storage/safe.ts).
//   - the list of documents, `plan-drafts/1` under the local key of keys.ts: the same document the account table will hold, and the list the
//     details page opens a built trip from. Read and written whole, never edited in place; a list from a newer site is left as it is.
//   - the screen state, under the UI key of keys.ts: the stage and the answers a document cannot hold yet (no start chosen), so a person who
//     leaves and comes back finds the stage they were on.
// No schema code (Zod) here: the start chunk is small, and the details page validates a document when it opens it.
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { PLAN_BUILDER_UI } from '@/lib/config/product';
import { readLocal, removeLocal, writeLocal } from '@/lib/storage/safe';
import type { FlowState } from './flow';
import { PLANS_CHANGED_EVENT, PLANS_LOCAL_KEY, PLANS_UI_KEY, PLAN_DRAFTS_SCHEMA_ID } from './keys';

export interface DraftList {
  /** newest first */
  drafts: PlanDraft[];
  /** `newer`: written by a later version of the site, read as empty and never overwritten */
  status: 'ok' | 'newer';
}

const bytes = (s: string): number => new TextEncoder().encode(s).length;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isDraft = (x: unknown): x is PlanDraft => isObj(x) && typeof x.id === 'string' && x.schema === 'plan-draft/1' && isObj(x.where);

export function readDrafts(): DraftList {
  const raw = readLocal(PLANS_LOCAL_KEY);
  if (raw === null) return { drafts: [], status: 'ok' };
  try {
    const v: unknown = JSON.parse(raw);
    if (!isObj(v)) return { drafts: [], status: 'ok' };
    if (v.schema !== PLAN_DRAFTS_SCHEMA_ID) return { drafts: [], status: typeof v.schema === 'string' ? 'newer' : 'ok' };
    const items = Array.isArray(v.items) ? v.items.filter(isDraft) : [];
    return { drafts: [...items].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0)), status: 'ok' };
  } catch {
    return { drafts: [], status: 'ok' };
  }
}

export type SaveFailure = 'cap' | 'full' | 'blocked' | 'newer' | 'toolarge';
export type SaveResult = { ok: true } | { ok: false; reason: SaveFailure };

const notify = (): void => {
  try {
    window.dispatchEvent(new Event(PLANS_CHANGED_EVENT));
  } catch {
    /* no window: nothing to tell */
  }
};

/** Writes (adds or replaces by id) one document. A new id past the device cap is refused (FLOW X1) and so is a document over 16 KB. */
export function saveDraft(d: PlanDraft): SaveResult {
  const json = JSON.stringify(d);
  if (bytes(json) > PLAN_BUILDER_UI.draftBytes) return { ok: false, reason: 'toolarge' };
  const list = readDrafts();
  if (list.status === 'newer') return { ok: false, reason: 'newer' };
  const exists = list.drafts.some((x) => x.id === d.id);
  if (!exists && list.drafts.length >= PLAN_BUILDER_UI.deviceDrafts) return { ok: false, reason: 'cap' };
  const items = [d, ...list.drafts.filter((x) => x.id !== d.id)];
  const ok = writeLocal(PLANS_LOCAL_KEY, JSON.stringify({ schema: PLAN_DRAFTS_SCHEMA_ID, items }));
  if (!ok) return { ok: false, reason: readLocal(PLANS_LOCAL_KEY) === null && !probeWritable() ? 'blocked' : 'full' };
  notify();
  return { ok: true };
}

export function removeDraft(id: string): boolean {
  const list = readDrafts();
  if (list.status === 'newer') return false;
  const items = list.drafts.filter((x) => x.id !== id);
  const ok = items.length ? writeLocal(PLANS_LOCAL_KEY, JSON.stringify({ schema: PLAN_DRAFTS_SCHEMA_ID, items })) : removeLocal(PLANS_LOCAL_KEY);
  if (ok) notify();
  return ok;
}

/** True when this browser lets the site write at all (private modes and blocked storage do not). */
function probeWritable(): boolean {
  const k = `${PLANS_UI_KEY}.probe`;
  const ok = writeLocal(k, '1');
  if (ok) removeLocal(k);
  return ok;
}

// ---- the screen state ------------------------------------------------------------------------------------------------------------------

export function readFlow(): FlowState | null {
  const raw = readLocal(PLANS_UI_KEY);
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return isObj(v) && v.v === 1 && typeof v.id === 'string' && isObj(v.filters) && Array.isArray(v.picks) ? (v as unknown as FlowState) : null;
  } catch {
    return null;
  }
}

export function writeFlow(s: FlowState): boolean {
  return writeLocal(PLANS_UI_KEY, JSON.stringify(s));
}

export function clearFlow(): void {
  removeLocal(PLANS_UI_KEY);
}
