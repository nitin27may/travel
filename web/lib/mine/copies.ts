import {
  addCopy,
  COPIES_KEY,
  DEVICE_COPY_CAP,
  LEGACY_MOVED_KEY,
  moveLegacyCopies,
  restoreCopy,
  removeCopy,
  updateCopies,
} from '@travel/core/schema/copies.ts';
import type { AddResult, CopyInput, CopyItem, MoveResult, StorageLike } from '@travel/core/schema/copies.ts';
import { notifyMineChanged } from './dot';

/**
 * My trips on this device (NAV-2): every read and write of the copies envelope that Mine and the copy sheet make. All writes go through
 * the core's compare-and-set `updateCopies` (never `setItem` on the envelope); a `newer` or `corrupt` envelope is refused and left as it
 * is. Pure over a `StorageLike` so a test passes a memory store; the callers pass `mineStorage().storage`.
 */
export { COPIES_KEY, DEVICE_COPY_CAP, LEGACY_MOVED_KEY };

const newId = (): string => crypto.randomUUID();

/** Why a write did not happen. `newer` and `corrupt` and `invalid` are the error state of nav 3.1 (nothing written). */
export type WriteFailure = 'corrupt' | 'newer' | 'invalid' | 'changed' | 'quota' | 'blocked' | 'unverified' | 'refused';

/** Moves the old key's drafts once per device (core guards it with LEGACY_MOVED_KEY). Returns the result for the "did not fit" note. */
export function moveLegacyOnce(storage: StorageLike, now: Date = new Date()): MoveResult {
  return moveLegacyCopies(storage, { newId, now });
}

// ---- adding (the copy sheet) ----

export type SaveOutcome =
  | { kind: 'added'; item: CopyItem; replaced: CopyItem | null }
  | { kind: 'exists'; existing: CopyItem }
  | { kind: 'cap' }
  | { kind: 'failed'; reason: WriteFailure };

/** Adds a copy, or with `replace` takes the place of the copy of the same trip. Calls `notifyMineChanged` after a write. */
export function saveCopy(storage: StorageLike, input: CopyInput, opts: { replace?: boolean; now?: Date } = {}): SaveOutcome {
  const r = updateCopies<AddResult>(storage, (env) => {
    const a = addCopy(env, input, { now: opts.now ?? new Date(), newId, replace: opts.replace });
    return a.ok ? { envelope: a.envelope, value: a } : { envelope: null, value: a };
  });
  if (r.ok) {
    notifyMineChanged();
    const a = r.value;
    if (a.ok) return { kind: 'added', item: a.item, replaced: a.replaced };
    return { kind: 'failed', reason: 'invalid' };
  }
  const a = r.value;
  if (r.reason === 'refused' && a && !a.ok) {
    if (a.reason === 'exists') return { kind: 'exists', existing: a.existing };
    if (a.reason === 'cap') return { kind: 'cap' };
    return { kind: 'failed', reason: 'invalid' };
  }
  return { kind: 'failed', reason: r.reason };
}

/** Undo of a copy: removes the new item and puts back the one it replaced. */
export function undoSave(storage: StorageLike, item: CopyItem, replaced: CopyItem | null): boolean {
  const r = updateCopies(storage, (env) => {
    const items = env.items.filter((x) => x.id !== item.id);
    if (replaced && !items.some((x) => x.slug === replaced.slug)) items.push(replaced);
    return { envelope: { ...env, items }, value: null };
  });
  if (r.ok) notifyMineChanged();
  return r.ok;
}

// ---- removing, restoring, changing (Mine) ----

export function removeById(storage: StorageLike, id: string): { ok: true; removed: CopyItem } | { ok: false; reason: WriteFailure } {
  const r = updateCopies(storage, (env) => {
    const x = removeCopy(env, id);
    return x.removed ? { envelope: x.envelope, value: x.removed } : { envelope: null, value: null };
  });
  if (r.ok && r.value) {
    notifyMineChanged();
    return { ok: true, removed: r.value };
  }
  return { ok: false, reason: r.ok ? 'refused' : r.reason };
}

/** Undo of Remove. False when the trip was copied again meanwhile or the cap is full (the toast then says so). */
export function undoRemove(storage: StorageLike, item: CopyItem): boolean {
  const r = updateCopies(storage, (env) => {
    const x = restoreCopy(env, item);
    return x.ok ? { envelope: x.envelope, value: null } : { envelope: null, value: null };
  });
  if (r.ok) notifyMineChanged();
  return r.ok;
}

export interface DatesChange {
  start: string;
  adults: number;
  children: number[];
}

/** Change dates: the same id and the same `copiedAt`, the row replaced in place. Returns the item before, for Undo. */
export function changeDates(storage: StorageLike, id: string, c: DatesChange): { ok: true; before: CopyItem; after: CopyItem } | { ok: false; reason: WriteFailure } {
  const r = updateCopies(storage, (env) => {
    const before = env.items.find((x) => x.id === id);
    if (!before) return { envelope: null, value: null };
    const after: CopyItem = { ...before, start: c.start, adults: c.adults, children: c.children };
    return { envelope: { ...env, items: env.items.map((x) => (x.id === id ? after : x)) }, value: { before, after } };
  });
  if (r.ok && r.value) {
    notifyMineChanged();
    return { ok: true, ...r.value };
  }
  return { ok: false, reason: r.ok ? 'refused' : r.reason };
}

/** Undo of Change dates: puts the earlier item back in the same place. */
export function undoChange(storage: StorageLike, before: CopyItem): boolean {
  const r = updateCopies(storage, (env) => ({ envelope: { ...env, items: env.items.map((x) => (x.id === before.id ? before : x)) }, value: null }));
  if (r.ok) notifyMineChanged();
  return r.ok;
}

// ---- the party in words (the rows and the copy sheet's done step) ----

const num = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** "2 adults, 1 child" */
export function partyText(c: Pick<CopyItem, 'adults' | 'children'>): string {
  return [num(c.adults, 'adult'), c.children.length ? num(c.children.length, 'child', 'children') : ''].filter(Boolean).join(', ');
}
