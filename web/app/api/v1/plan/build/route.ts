import { handlePlan } from '../shared';

export function POST(req: Request) {
  return handlePlan('build', req);
}
