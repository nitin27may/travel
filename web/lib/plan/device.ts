// The builder's drafts as Mine reads them (STEP2-P2, one device list, EM-5): `plan-drafts/1` under `PLANS_KEY`. The row facts Mine
// draws, and remove / put back. It sits in the builder's folder because it parses the plan document; Mine reaches it only through one
// dynamic import in MineShell (the X6 extension point), and only when the key holds something, so Zod for the document stays out of the
// page's start chunk. A failed read never writes. Pure over a `StorageLike`.
import type { StorageLike } from '@travel/core/schema/copies.ts';
import { PLAN_DRAFTS_SCHEMA, readPlanDrafts, type PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { PLANS_KEY } from './keys';
import { draftTitle } from '@/lib/trip-edit/title';

/** What a Mine row needs of a draft; nothing of the plan itself leaves this file. */
export interface DeviceDraft {
  id: string;
  /** the person's own title or, for a plan the builder made, its derived one; null for a copy without a title (the row then names it) */
  title: string | null;
  /** a copy's public trip (template mode); null for a built plan */
  slug: string | null;
  /** Day 1, or null for "No date" */
  start: string | null;
  days: number | null;
  /** the trip's own party when it has one */
  adults: number | null;
  children: number[];
  /** the draft has a build: it opens as a trip. Without one it is a "Draft · ready to build" and opens in the builder. */
  built: boolean;
  updatedAt: string;
  identity: string | null;
}

export type DeviceDrafts = { ok: true; items: DeviceDraft[] } | { ok: false; reason: 'corrupt' | 'newer' | 'invalid' };

const get = (s: StorageLike): string | null => {
  try {
    return s.getItem(PLANS_KEY);
  } catch {
    return null;
  }
};

/** True when the key holds anything: Mine loads this file only then. */
export const hasDeviceDrafts = (s: StorageLike): boolean => get(s) !== null;

function rowOf(d: PlanDraft): DeviceDraft {
  return {
    id: d.id,
    // a template copy is named from its public trip by Mine; a plan the builder made carries its derived name (RB-015, one name everywhere)
    title: d.template ? d.title : draftTitle(d),
    slug: d.template?.trip ?? null,
    start: d.start ?? null,
    days: d.nights === null ? null : d.nights + 1,
    adults: d.travellers?.adults ?? null,
    children: d.travellers ? [...d.travellers.children] : [],
    built: d.lastBuild !== null || d.template !== undefined,
    updatedAt: d.updatedAt,
    identity: d.identity ?? null,
  };
}

export function readDeviceDrafts(s: StorageLike): DeviceDrafts {
  const r = readPlanDrafts(get(s));
  return r.ok ? { ok: true, items: r.list.items.map(rowOf) } : { ok: false, reason: r.reason };
}

const write = (s: StorageLike, items: PlanDraft[]): boolean => {
  try {
    if (items.length) s.setItem(PLANS_KEY, JSON.stringify({ schema: PLAN_DRAFTS_SCHEMA, items }));
    else s.removeItem(PLANS_KEY);
    return true;
  } catch {
    return false;
  }
};

/** Removes one draft. `restore` puts it back where it was (Undo). Nothing is written when the list cannot be read or has no such draft. */
export function removeDeviceDraft(s: StorageLike, id: string): { ok: true; restore: () => boolean } | { ok: false } {
  const r = readPlanDrafts(get(s));
  if (!r.ok) return { ok: false };
  const at = r.list.items.findIndex((d) => d.id === id);
  if (at < 0) return { ok: false };
  const gone = r.list.items[at]!;
  if (!write(s, r.list.items.filter((d) => d.id !== id))) return { ok: false };
  return {
    ok: true,
    restore: () => {
      const now = readPlanDrafts(get(s));
      if (!now.ok || now.list.items.some((d) => d.id === id)) return false;
      const items = [...now.list.items];
      items.splice(Math.min(at, items.length), 0, gone);
      return write(s, items);
    },
  };
}
