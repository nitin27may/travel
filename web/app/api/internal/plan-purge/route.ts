import { purgeRoute } from '@/lib/server/plan-purge';

// The daily purge of removed plans' tombstones (Vercel Cron; every rule is in lib/server/plan-purge.ts). Off unless PLAN_PURGE_ENABLED=1
// and the request carries the CRON_SECRET bearer: otherwise 404.
export const dynamic = 'force-dynamic';

export function GET(request: Request): Promise<Response> {
  return purgeRoute(request);
}
