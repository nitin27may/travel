import { handlePlan } from '../shared';

/** Public queries only (trip mode, no party band): cacheable. */
export function GET(req: Request) {
  return handlePlan('candidates', req);
}

/** RB-010: a query with a start or a party band, in the body; no-store. */
export function POST(req: Request) {
  return handlePlan('candidates', req);
}
