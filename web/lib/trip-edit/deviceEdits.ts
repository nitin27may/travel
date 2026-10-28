// What a device copy keeps beyond `copies/1` (STEP2-E1): the template lists the person's removals, moves, day operations, notes and
// Maybe entries live in, and the operation ids of their added places (so an undo stack that names an id survives a reload). One
// envelope under DEVICE_EDITS_KEY, validated when it is laid over the document: a bad entry is ignored, never thrown.
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { parsePlanDraft } from '@travel/core/schema/plan-draft.ts';
import type { StorageLike } from '@travel/core/schema/copies.ts';
import { readDeviceEnvelope, writeDeviceEnvelope, type DeviceEnvelope } from './deviceStore';

const LISTS = ['added', 'removed', 'moved', 'days', 'maybe'] as const;
export interface DeviceEdit {
  added: unknown[];
  removed: unknown[];
  moved: unknown[];
  days: unknown[];
  maybe: unknown[];
  notes: Record<string, string>;
}
const read = (storage: StorageLike): { v: 1; items: Record<string, DeviceEdit> } =>
  readDeviceEnvelope(storage) as unknown as { v: 1; items: Record<string, DeviceEdit> };

/** The document with the device's template lists laid over it. `added` is used only while its numbered days still name the same places as the copy. */
export function withDeviceEdits(storage: StorageLike, id: string, doc: PlanDraft): PlanDraft {
  const t = doc.template;
  const e = read(storage).items[id];
  if (!t || !e) return doc;
  // `copies/1` holds an added place only by a published day number, so a place added to a day the person inserted (its day is an operation id)
  // lives only here: compare the numbered ones with the copy's, and keep the rest (STEP2-INT)
  const mine = Array.isArray(e.added) ? (e.added as { day: unknown; ref: string }[]).filter((a) => typeof a.day === 'number') : [];
  const same = Array.isArray(e.added) && mine.length === t.added.length && mine.every((a, i) => a.day === t.added[i]!.day && a.ref === t.added[i]!.ref);
  const next = { ...doc, template: { ...t, added: same ? e.added : t.added, removed: e.removed, moved: e.moved, days: e.days, maybe: e.maybe, notes: e.notes ?? {} } };
  const r = parsePlanDraft(next);
  return r.success ? (r.data as PlanDraft) : doc;
}

/** Remembers a document's lists for its copy; an empty set is removed. Copies that are gone are dropped. Best effort: storage may be blocked. */
export function storeDeviceEdits(storage: StorageLike, id: string, doc: PlanDraft, liveIds: readonly string[]): void {
  const t = doc.template;
  if (!t) return;
  const env = read(storage);
  const empty = LISTS.every((l) => t[l].length === 0) && Object.keys(t.notes).length === 0;
  if (empty) delete env.items[id];
  else env.items[id] = { added: t.added, removed: t.removed, moved: t.moved, days: t.days, maybe: t.maybe, notes: t.notes };
  for (const k of Object.keys(env.items)) if (!liveIds.includes(k)) delete env.items[k];
  writeDeviceEnvelope(storage, env as unknown as DeviceEnvelope); // best effort: storage may be blocked
}
