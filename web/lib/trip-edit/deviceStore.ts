// The device edits envelope (`travel.trip-edit.device`) and the tab's undo stacks (`travel.trip-edit.undo.<id>`) as storage only: read,
// take one entry out, put it back, prune to the live copies, clear the undo stacks. No schema code, so Mine's data chunk and the copy
// sheet can call it without pulling the plan document's Zod in (deviceEdits.ts lays an entry over a document and validates it there).
//
// Why it exists (review STEP2-ES ES-001, ES-002, ES-006): the notes, removals and moves a person keeps per copy must not outlive the copy
// on this device. A copy that is removed, replaced or merged into the account takes its entry with it; Undo of Remove puts it back.
import type { StorageLike } from '@travel/core/schema/copies.ts';
import { removeSessionWithPrefix } from '@/lib/storage/safe';
import { DEVICE_EDITS_KEY, undoKey } from './keys';

/** One copy's entry as stored. Opaque here: deviceEdits.ts validates it when it is laid over a document. */
export type DeviceEntry = Record<string, unknown>;
export interface DeviceEnvelope {
  v: 1;
  items: Record<string, DeviceEntry>;
}

export function readDeviceEnvelope(storage: StorageLike): DeviceEnvelope {
  try {
    const raw = storage.getItem(DEVICE_EDITS_KEY);
    const p = raw ? (JSON.parse(raw) as DeviceEnvelope) : null;
    if (p && p.v === 1 && p.items && typeof p.items === 'object' && !Array.isArray(p.items)) return p;
  } catch {
    /* an unreadable envelope is an empty one */
  }
  return { v: 1, items: {} };
}

/** Writes the envelope; an empty one is removed. False when storage refused (full or blocked). */
export function writeDeviceEnvelope(storage: StorageLike, env: DeviceEnvelope): boolean {
  try {
    if (Object.keys(env.items).length) storage.setItem(DEVICE_EDITS_KEY, JSON.stringify(env));
    else storage.removeItem(DEVICE_EDITS_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Removes one copy's entry and returns it (for an Undo), or null when there was none. */
export function takeDeviceEntry(storage: StorageLike, id: string): DeviceEntry | null {
  const env = readDeviceEnvelope(storage);
  const entry = env.items[id];
  if (!entry) return null;
  delete env.items[id];
  writeDeviceEnvelope(storage, env);
  return entry;
}

/** Puts an entry back (Undo of Remove or of a replace). Never overwrites an entry written since. */
export function restoreDeviceEntry(storage: StorageLike, id: string, entry: DeviceEntry | null | undefined): void {
  if (!entry) return;
  const env = readDeviceEnvelope(storage);
  if (env.items[id]) return;
  env.items[id] = entry;
  writeDeviceEnvelope(storage, env);
}

/** Drops every entry whose copy is not in `liveIds`. Returns how many were dropped. */
export function pruneDeviceEdits(storage: StorageLike, liveIds: readonly string[]): number {
  const env = readDeviceEnvelope(storage);
  const live = new Set(liveIds);
  const gone = Object.keys(env.items).filter((k) => !live.has(k));
  if (!gone.length) return 0;
  for (const k of gone) delete env.items[k];
  writeDeviceEnvelope(storage, env);
  return gone.length;
}

/** The tab's undo stack of one trip goes (a removed copy). Through the one door to sessionStorage. */
export function clearUndoOf(id: string): void {
  removeSessionWithPrefix(undoKey(id));
}

/** Every undo stack in this tab goes (sign-out, a user switch): they hold previous notes and travellers. */
export function clearAllUndo(): void {
  removeSessionWithPrefix(undoKey(''));
}
