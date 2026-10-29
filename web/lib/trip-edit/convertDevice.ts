// A device copy that becomes the person's own built trip (STEP2-B3; edit-mode-spec 13.2) changes lists: a copy lives in `copies/2`, a built
// trip in the builder's list `plan-drafts/1`. `convert` and its inverse `toTemplate` are one operation each on the document; this moves
// the stored item with them, under the same id, so Undo puts the copy back exactly (the original item is kept in a side envelope until
// the trip is a copy again or is removed). Storage only, no plan code: `open.ts` calls it from `saveOps`, and the start chunk imports it.
import { COPIES_KEY, readCopies, updateCopies, type CopyItem, type StorageLike } from '@travel/core/schema/copies.ts';
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { plansItems, putPlansItems } from './built';
import { storeDeviceEdits } from './deviceEdits';
import { takeDeviceEntry } from './deviceStore';

/** The copy items a conversion took out of `copies/2`, by trip id: what Undo and "Reset to our plan" put back. */
export const CONVERTED_KEY = 'travel.trip-edit.converted';
const KEEP = 12;

interface Side {
  v: 1;
  items: Record<string, { copy: CopyItem }>;
}

const readSide = (s: StorageLike): Side => {
  try {
    const raw = s.getItem(CONVERTED_KEY);
    const p = raw ? (JSON.parse(raw) as Side) : null;
    if (p && p.v === 1 && p.items && typeof p.items === 'object' && !Array.isArray(p.items)) return p;
  } catch {
    /* an unreadable side envelope is an empty one */
  }
  return { v: 1, items: {} };
};
const writeSide = (s: StorageLike, side: Side): void => {
  try {
    const keys = Object.keys(side.items);
    for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) delete side.items[k];
    if (Object.keys(side.items).length) s.setItem(CONVERTED_KEY, JSON.stringify(side));
    else s.removeItem(CONVERTED_KEY);
  } catch {
    /* best effort: without it Undo rebuilds the copy item from the document */
  }
};

export type MoveResult = { ok: true } | { ok: false; reason: 'newer' | 'storage' | 'full' };

const plansList = (s: StorageLike): { items: unknown[] } | 'newer' => {
  const l = plansItems(s);
  return l === 'newer' ? l : { items: l };
};
const putPlans = putPlansItems;

/** The copy `id` becomes the built document `doc`: written to the builder's list first, then taken out of the copies. Nothing is lost if the second write fails. */
export function copyToBuilt(s: StorageLike, id: string, doc: PlanDraft, now: Date = new Date()): MoveResult {
  const list = plansList(s);
  if (list === 'newer') return { ok: false, reason: 'newer' };
  const r = readCopies(s.getItem(COPIES_KEY));
  if (!r.ok) return { ok: false, reason: r.reason === 'newer' ? 'newer' : 'storage' };
  const copy = r.envelope.items.find((c) => c.id === id);
  if (!copy) return { ok: false, reason: 'storage' };
  const stored = { ...doc, updatedAt: now.toISOString() };
  const w = putPlans(s, [stored, ...list.items.filter((x) => !(typeof x === 'object' && x !== null && (x as { id?: unknown }).id === id))]);
  if (!w.ok) return w;
  const out = updateCopies(s, (env) => ({ envelope: { ...env, items: env.items.filter((c) => c.id !== id) }, value: null }));
  if (!out.ok) {
    putPlans(s, list.items);
    return { ok: false, reason: out.reason === 'newer' ? 'newer' : out.reason === 'quota' ? 'full' : 'storage' };
  }
  const side = readSide(s);
  takeDeviceEntry(s, id); // the template lists come back from the document when the copy does
  side.items[id] = { copy };
  writeSide(s, side);
  return { ok: true };
}

/** The built document `doc` is a copy again (Undo of the conversion, or Reset to our plan): the stored copy item comes back with the document's choices written over it. */
export function builtToCopy(s: StorageLike, doc: PlanDraft, withDoc: (copy: CopyItem, d: PlanDraft) => CopyItem): MoveResult {
  const t = doc.template;
  if (!t) return { ok: false, reason: 'storage' };
  const list = plansList(s);
  if (list === 'newer') return { ok: false, reason: 'newer' };
  const side = readSide(s);
  const kept = side.items[doc.id];
  const base: CopyItem = kept?.copy ?? {
    id: doc.id,
    slug: t.trip,
    title: doc.title ?? t.trip,
    days: doc.nights === null ? null : doc.nights + 1,
    cc: doc.where.mode === 'trip' ? doc.where.cc : null,
    photo: null,
    start: doc.start ?? null,
    adults: doc.travellers?.adults ?? 2,
    children: doc.travellers ? [...doc.travellers.children] : [],
    profile: t.profile,
    overrides: t.overrides,
    added: [],
    copiedAt: doc.createdAt,
    ...(t.rev ? { rev: t.rev } : {}),
    ...(doc.identity ? { identity: doc.identity } : {}),
  };
  const copy = withDoc(base, doc);
  const add = updateCopies(s, (env) => ({ envelope: { ...env, items: [copy, ...env.items.filter((c) => c.id !== doc.id)] }, value: null }));
  if (!add.ok) return { ok: false, reason: add.reason === 'newer' ? 'newer' : add.reason === 'quota' ? 'full' : 'storage' };
  const w = putPlans(s, list.items.filter((x) => !(typeof x === 'object' && x !== null && (x as { id?: unknown }).id === doc.id)));
  if (!w.ok) {
    updateCopies(s, (env) => ({ envelope: { ...env, items: env.items.filter((c) => c.id !== doc.id) }, value: null }));
    return w;
  }
  delete side.items[doc.id];
  writeSide(s, side);
  const live = readCopies(s.getItem(COPIES_KEY));
  storeDeviceEdits(s, doc.id, doc, live.ok ? live.envelope.items.map((c) => c.id) : [doc.id]);
  return { ok: true };
}
