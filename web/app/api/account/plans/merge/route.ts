import { mergeRoute } from '@/lib/server/plans';

// The sign-in merge: the device's copies into the account, idempotent on each copy's id (edit-my-trip 4.2; every rule is in
// lib/server/plans.ts). Private, never cached.
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return mergeRoute(request);
}
