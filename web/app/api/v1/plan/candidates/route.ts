import { handlePlan } from '../shared';

export function GET(req: Request) {
  return handlePlan('candidates', req);
}
