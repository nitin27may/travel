import type { NearPage, NearQuery, NearRow, PlaceQuery } from '@travel/core/schema/api/index.ts';
import { toNearCell } from '@travel/core/config/nearby.ts';
import type { NearRead } from './contract';

// The near read of the ApiAdapter (N2; store.ts A41), in its own chunk: api.ts imports it on the first `nearPage` call, so the public
// pages, which never ask for it, carry none of it. Two parts: the browser's request (`fetchNear`) and the adapter's method (`nearPageOf`),
// which rounds the asker's point to the near cell BEFORE any URL exists, so the point never leaves the device finer than the cell.

/** The few helpers of api.ts the request needs, passed in so this chunk does not import api.ts back (and makes no request itself: P9's boundary is api.ts). */
export interface NearHelpers {
  get(url: string, signal?: AbortSignal): Promise<Response>;
  at(path: string, params?: URLSearchParams): string;
  check(method: string, data: unknown): Promise<void>;
  list(q: PlaceQuery, page: { page?: number; pageSize?: number }): URLSearchParams;
}

/** `GET /api/v1/near/`: the list keys, then the centre and radius (httpCodec toSearchParams' order). Null on a 501; throws on another failure. */
export async function fetchNear(q: NearQuery, page: { page?: number; pageSize?: number }, signal: AbortSignal | undefined, h: NearHelpers): Promise<NearPage | null> {
  const p = h.list(q, page);
  if (q.near) p.set('near', q.near);
  if (q.city) p.set('city', q.city);
  if (q.r !== undefined) p.set('r', String(q.r));
  const r = await h.get(h.at('/near', p), signal);
  if (r.status === 501) {
    // release the connection: an unread body leaves the request in flight
    await r.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!r.ok) throw new Error(`near: ${r.status}`);
  const data = (await r.json()) as NearPage;
  await h.check('near', data);
  return data;
}

/** The DataClient's `nearPage` over a near call: the centre as the API's key, a point rounded to the cell first; null for any failure. */
export async function nearPageOf(
  call: (q: NearQuery, page: { page?: number; pageSize?: number }, signal?: AbortSignal) => Promise<NearPage | null>,
  q: NearRead,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<{ items: NearRow[]; total: number; nextPage: number | null } | null> {
  const c = q.centre;
  const centre: Pick<NearQuery, 'near' | 'city'> = 'point' in c ? { near: `point:${toNearCell(c.point.lat)},${toNearCell(c.point.lon)}` } : 'place' in c ? { near: `place:${c.place}` } : { city: c.town };
  try {
    const got = await call({ ...centre, r: q.r, ...(q.kinds?.length ? { facets: { kind: [...q.kinds] } } : {}) }, { page, pageSize }, signal);
    return got ? { items: got.items, total: got.total, nextPage: got.nextPage ?? null } : null;
  } catch {
    return null;
  }
}
