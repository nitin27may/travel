// The towns around a public place, for the trip builder's "where the trip sleeps" (TB-W2). Its own module, imported on the first call by
// data.ts `townsAround`, so no public page carries it (the +0 B rule). The request is the API's `towns` read (nearby spec 5.6): a place's
// public slug and a radius, never a point of the visitor's. Null when this build has no such endpoint (the static files, a 404 or 501).
import type { Town, TownList } from '@travel/core/schema/api/index.ts';

export async function townsAround(q: { place: string; r: number }, signal?: AbortSignal): Promise<Town[] | null> {
  if (process.env.NEXT_PUBLIC_DATA_ADAPTER === 'static') return null;
  const p = new URLSearchParams({ near: `place:${q.place}`, r: String(q.r) });
  const res = await fetch(`/api/v1/towns/?${p}`, signal ? { signal } : undefined);
  if (res.status === 404 || res.status === 501) {
    await res.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!res.ok) throw new Error(`towns: ${res.status}`);
  const data = (await res.json()) as TownList;
  return data.items;
}
