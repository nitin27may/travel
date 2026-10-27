import 'server-only';

// The daily tombstone purge (review-em-s B2 point 4 and S2; edit-my-trip 4.5 and 7: a removed plan's title is gone after 30 days even
// when its owner never writes again). Vercel Cron calls `GET /api/internal/plan-purge` once a day with `Authorization: Bearer
// <CRON_SECRET>` (Vercel sends the header itself when the project has a CRON_SECRET). The handler runs migration 0013's
// `plan_draft_purge()` on the runtime pool's own connection, which logs in as the database owner (core/src/db/client.ts: the app
// drops to `travel_app` only inside withUserTransaction), because the function is closed to the app role.
//
// OFF until 0013 is applied and the owner switches it on: `PLAN_PURGE_ENABLED=1` and a CRON_SECRET of 32 or more characters, both in
// Vercel Production, and the cron entry in vercel.json (docs/v2/features/edit-my-trip.md 4.5, "The purge job"). Off, or without the
// right header, the route answers 404 with nothing read, so its existence says nothing. Logs a count only, never a row.
import { timingSafeEqual } from 'node:crypto';
import { getPool } from '@travel/core/db/client.ts';
import { purgeAllTombstones, type PurgeExecutor } from '@travel/core/db/plans.ts';
import { safeError } from './safe-error';

export const PURGE_SECRET_MIN = 32;

export interface PurgeDeps {
  env(): { PLAN_PURGE_ENABLED?: string; CRON_SECRET?: string };
  /** an owner connection (the runtime pool) */
  owner(): Promise<PurgeExecutor>;
}

const PRIVATE = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } as const;
const answer = (status: number, body: unknown): Response => Response.json(body, { status, headers: PRIVATE });

/** Constant-time compare of the Authorization header against `Bearer <secret>`. */
export function authorised(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < PURGE_SECRET_MIN || !header) return false;
  const want = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function purgeRoute(request: Request, deps: PurgeDeps = defaultPurgeDeps()): Promise<Response> {
  const env = deps.env();
  if (env.PLAN_PURGE_ENABLED !== '1' || !authorised(request.headers.get('authorization'), env.CRON_SECRET)) return answer(404, { code: 'NOT_FOUND' });
  try {
    const purged = await purgeAllTombstones(await deps.owner());
    console.info('[plan-purge]', JSON.stringify({ outcome: 'purged', purged }));
    return answer(200, { purged });
  } catch (e) {
    console.error('[plan-purge]', JSON.stringify({ outcome: 'failed', error: safeError(e) }));
    return answer(503, { code: 'SERVICE_UNAVAILABLE' });
  }
}

export function defaultPurgeDeps(): PurgeDeps {
  return {
    env: () => ({ PLAN_PURGE_ENABLED: process.env.PLAN_PURGE_ENABLED, CRON_SECRET: process.env.CRON_SECRET }),
    owner: () => getPool(),
  };
}
