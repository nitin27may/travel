import { listRoute } from '@/lib/server/plans';

// The signed-in person's copies and plans, as light rows (edit-my-trip 4.1; every rule is in lib/server/plans.ts). Private, never cached.
export const dynamic = 'force-dynamic';

export function GET(request: Request): Promise<Response> {
  return listRoute(request);
}
